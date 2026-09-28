import { getTranslations } from "#/i18n";
import { z } from "zod";
import { createClient } from "#/lib/supabase/server";
import {
  transactionInput,
  TRANSACTION_TYPES,
  type TransactionInput,
} from "@cigua/core/transactions/schema";
import { resolveBaseRate } from "@cigua/core/transactions/money";
import { getTransactions, type TransactionPage } from "#/lib/transactions/queries";
import { getExchangeRates } from "#/lib/fx";
import { baseCurrencyOf } from "@cigua/core/profile";
import { dbError } from "#/lib/errors";

// Statement-sourced rows are editable only in category and notes — the
// imported line owns everything else. transactionInput requires a positive
// amount, a valid type/account, etc., which imported credit/refund rows
// (negative amount, echoed back by the form) can never satisfy. Validating
// those edits against the full schema before the statement guard runs was
// the bug: it rejected legitimate category/notes edits on such rows before
// they ever reached the restricted branch below.
const statementEdit = z.object({
  category_id: z.string().uuid().or(z.literal("")).or(z.literal("none")).optional(),
  notes: z.string().optional(),
  exclude_from_budget: z.boolean().default(false),
  /* The budget-group override belongs on this short list even though the rest
     of an imported row is the issuer's to own. It is not a fact about the
     charge — it is a decision about which bucket the charge counts against,
     which is exactly the decision a person makes while reviewing an import.
     Leaving it off meant the field the form renders on these rows would accept
     a change and then silently drop it. */
  budget_group_id: z.string().uuid().or(z.literal("")).or(z.literal("none")).optional(),
});

type Result = { error?: string; id?: string };

function toRow(v: TransactionInput) {
  const payment = v.type === "payment";
  return {
    type: v.type,
    account_id: v.account_id,
    to_account_id: payment ? v.to_account_id || null : null,
    category_id: v.type === "income" ? null : v.category_id || null,
    amount: v.amount,
    // Destination leg. Null on a same-currency payment — the DB mirrors `amount`.
    to_amount: payment ? v.to_amount ?? null : null,
    include_tax: v.include_tax,
    include_commission: v.include_commission,
    exclude_from_budget: v.type === "expense" ? v.exclude_from_budget : false,
    /* Null means inherit, not "no group" — see transactionInput. Income never
       carries one, matching the category rule directly above. */
    budget_group_id: v.type === "income" ? null : v.budget_group_id || null,
    occurred_at: new Date(v.occurred_at).toISOString(),
    description: v.description || null,
    notes: v.notes || null,
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** The stored row an edit is about to overwrite, loaded once.
 *
 *  Carries two things an edit is checked against: whether it came from a
 *  statement (those die only with their statement, and edits may touch only
 *  category and notes — the imported line owns the rest), and the account and
 *  currency it was written with, which together are immutable. */
async function statementGuard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<{
  row: {
    statement_line_id: string | null;
    category_id: string | null;
    notes: string | null;
    currency: string;
    account_id: string;
  } | null;
}> {
  const { data } = await supabase
    .from("transactions")
    .select("statement_line_id,category_id,notes,currency,account_id")
    .eq("id", id)
    .maybeSingle();
  return { row: data };
}

/**
 * The currencies a transaction straddles, read from the accounts themselves.
 *
 * `srcCurrency` is the transaction's currency — not a check on one the client
 * sent, but the only source of it. Every type settles in its account's
 * currency, so there is nothing for the user to pick and nothing that can
 * disagree. The base rate derived below is only as right as these are.
 */
async function currencyContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  v: TransactionInput,
): Promise<{ baseCurrency: string; srcCurrency: string | null; dstCurrency: string | null }> {
  const ids = [v.account_id, v.type === "payment" ? v.to_account_id : ""].filter(Boolean) as string[];
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("base_currency").maybeSingle(),
    supabase.from("accounts").select("id,currency").in("id", ids),
  ]);
  const byId = new Map((rows ?? []).map((r) => [r.id, r.currency]));
  return {
    baseCurrency: baseCurrencyOf(profile),
    srcCurrency: byId.get(v.account_id) ?? null,
    dstCurrency: v.type === "payment" && v.to_account_id ? byId.get(v.to_account_id) ?? null : null,
  };
}

/**
 * A payment between two currencies has no defensible default destination leg —
 * assuming 1:1 turns "send 100 USD to a DOP account" into 100 DOP received.
 * The DB trigger rejects it too, but with a Postgres exception; this returns
 * something a person can act on.
 */
function crossCurrencyLegMissing(
  v: TransactionInput,
  srcCurrency: string | null,
  dstCurrency: string | null,
): boolean {
  return (
    v.type === "payment" &&
    !!srcCurrency &&
    !!dstCurrency &&
    srcCurrency !== dstCurrency &&
    !(v.to_amount && v.to_amount > 0)
  );
}

/* Ledger paging ------------------------------------------------------------
 *
 * The filters below reach Postgres, not a client-side pass over rows already
 * fetched, so they arrive as untrusted input. RLS confines them to the caller's
 * own rows either way, but the account id is interpolated into a PostgREST
 * `or=` expression, so its shape is checked rather than assumed. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const txnFilters = z
  .object({
    type: z.enum(TRANSACTION_TYPES).optional(),
    accountId: z.string().uuid().optional(),
    // `null` (not just omitted) is a deliberate filter for the
    // uncategorized bucket — see TxnFilters.categoryId.
    categoryId: z.string().uuid().nullable().optional(),
    categoryIds: z.array(z.string().uuid().nullable()).optional(),
    search: z.string().max(200).optional(),
    from: z.string().regex(ISO_DAY).optional(),
    to: z.string().regex(ISO_DAY).optional(),
  })
  .default({});

const txnCursor = z
  .object({ occurredAt: z.string().datetime({ offset: true }), id: z.string().uuid() })
  .nullish();

/**
 * The next page of the ledger under the filters currently on screen.
 *
 * Returns an empty page rather than an error on bad input: this runs on scroll,
 * and a toast for a malformed cursor would be noise the user cannot act on.
 */
export async function loadTransactions(
  rawFilters: unknown,
  rawCursor?: unknown,
): Promise<TransactionPage> {
  const filters = txnFilters.safeParse(rawFilters ?? {});
  const cursor = txnCursor.safeParse(rawCursor ?? null);
  if (!filters.success || !cursor.success) return { rows: [], nextCursor: null };
  return getTransactions(filters.data, cursor.data ?? null);
}

export async function createTransaction(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };

  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { baseCurrency, srcCurrency, dstCurrency } = await currencyContext(supabase, parsed.data);
  // The account is where the currency comes from, so a missing one is fatal
  // now rather than a row denominated in a guess.
  if (!srcCurrency) return { error: t("accountNotFound") };
  if (crossCurrencyLegMissing(parsed.data, srcCurrency, dstCurrency))
    return { error: t("crossCurrencyRateRequired") };

  // Derived, never taken from the client: this only feeds base-currency
  // aggregates, so the market rate is the honest answer (see resolveBaseRate).
  const rates = srcCurrency === baseCurrency ? {} : await getExchangeRates(baseCurrency);
  const exchangeRate = resolveBaseRate({
    currency: srcCurrency,
    baseCurrency,
    amount: parsed.data.amount,
    toCurrency: dstCurrency,
    toAmount: parsed.data.to_amount,
    rates,
  });

  // currency + exchange_rate are set only on insert (immutable thereafter).
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      ...toRow(parsed.data),
      currency: srcCurrency,
      exchange_rate: exchangeRate,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: await dbError(error, "createTransaction") };
  return { id: data.id };
}

export async function updateTransaction(id: string, input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  // Statement-sourced rows: the imported line owns type/amount/account/date/
  // description; only the category and notes may change here. Check this
  // BEFORE running full transactionInput validation — that schema requires a
  // positive amount, but imported credit/refund rows carry a negative amount
  // (the form echoes it back unchanged), so it would reject a valid
  // category/notes edit before we ever got to the restricted branch.
  const { row } = await statementGuard(supabase, id);
  if (row?.statement_line_id) {
    const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const parsedEdit = statementEdit.safeParse({
      category_id: raw.category_id,
      notes: raw.notes,
      exclude_from_budget: raw.exclude_from_budget,
      budget_group_id: raw.budget_group_id,
    });
    if (!parsedEdit.success) return { error: parsedEdit.error.issues[0]?.message ?? t("invalidInput") };

    const categoryId = parsedEdit.data.category_id;
    const groupId = parsedEdit.data.budget_group_id;
    const { error } = await supabase
      .from("transactions")
      .update({
        category_id: !categoryId || categoryId === "none" ? null : categoryId,
        notes: parsedEdit.data.notes || null,
        exclude_from_budget: parsedEdit.data.exclude_from_budget,
        budget_group_id: !groupId || groupId === "none" ? null : groupId,
      })
      .eq("id", id);
    if (error) return { error: await dbError(error, "updateTransaction") };
    return { id };
  }

  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };

  const { srcCurrency, dstCurrency } = await currencyContext(supabase, parsed.data);
  if (!srcCurrency) return { error: t("accountNotFound") };
  if (crossCurrencyLegMissing(parsed.data, srcCurrency, dstCurrency))
    return { error: t("crossCurrencyRateRequired") };

  /* An edit may move the transaction to another account, but `currency` is
     immutable in the DB — so moving a USD row onto a DOP card would leave the
     row denominated in USD while `account_balances` takes `amount` out of the
     DOP card raw. That is precisely the mismatch the derived currency removes
     on insert, reachable through the back door. Reject it; re-entering the
     transaction is the honest fix, since the amount itself is wrong in the new
     currency anyway.

     Only when the account actually changes. A row written before the currency
     was derived may already disagree with its own account, and such a row must
     stay editable — otherwise its description and category are frozen forever
     by a mismatch the user never chose. */
  if (row && parsed.data.account_id !== row.account_id && row.currency !== srcCurrency)
    return { error: t("accountCurrencyImmutable", { currency: row.currency }) };

  // Never send currency/exchange_rate — the DB forbids changing them. The rate
  // an edit would imply is therefore moot; it stays whatever the insert derived.
  const { error } = await supabase.from("transactions").update(toRow(parsed.data)).eq("id", id);
  if (error) return { error: await dbError(error, "updateTransaction") };
  return { id };
}

export async function deleteTransaction(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { row } = await statementGuard(supabase, id);
  if (row?.statement_line_id) return { error: t("statementRowLocked") };

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteTransaction") };
  return {};
}
