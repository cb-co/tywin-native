import type { QuickAddAccount, QuickAddCategory, QuickAddBudgetGroup } from "@cigua/core/transactions/types";
export type { QuickAddAccount, QuickAddCategory, QuickAddBudgetGroup };
import { createClient } from "#/lib/supabase/server";
import type { CurrencyRow } from "#/lib/accounts/queries";
import { getExchangeRates } from "#/lib/fx";
import { baseCurrencyOf } from "@cigua/core/profile";
import { rankCategoryIds, recentSourceAccountId, type RecentRow } from "@cigua/core/transactions/defaults";
import { searchTerms } from "./search";
import { isStatementCredit } from "@cigua/core/transactions/display";
import { getCreditKinds } from "#/lib/statements/credit-kind-queries";
import type { CreditKind } from "#/lib/statements/credit-kind";

type Client = Awaited<ReturnType<typeof createClient>>;

const TXN_SELECT =
  "*, account:accounts!transactions_account_id_fkey(id,name,currency,type), to_account:accounts!transactions_to_account_id_fkey(id,name,currency,type), category:categories!transactions_category_id_fkey(id,name,emoji,color)";

function selectTransactions(supabase: Client) {
  return supabase.from("transactions").select(TXN_SELECT);
}

type TxnRow = NonNullable<Awaited<ReturnType<typeof selectTransactions>>["data"]>[number];

export type TransactionWithRefs = TxnRow & {
  /** Set on statement credits only. */
  credit_kind: CreditKind | null;
};

async function withCreditKinds(supabase: Client, rows: TxnRow[]): Promise<TransactionWithRefs[]> {
  const lineIds = rows.flatMap((r) =>
    isStatementCredit(r) && r.statement_line_id ? [r.statement_line_id] : [],
  );
  if (lineIds.length === 0) return rows.map((r) => ({ ...r, credit_kind: null }));
  const { data } = await supabase
    .from("card_statement_lines")
    .select("id,account_id,description,mcc")
    .in("id", lineIds);
  const kinds = await getCreditKinds(supabase, data ?? []);
  return rows.map((r) => ({
    ...r,
    credit_kind: (r.statement_line_id && kinds.get(r.statement_line_id)) || null,
  }));
}

/** Rows per page. Big enough that a statement import doesn't need three
 *  scrolls, small enough that the first paint isn't a month of rows. */
export const TRANSACTIONS_PAGE_SIZE = 50;

export type TxnFilters = {
  type?: string;
  /** Alternative to `type`: match any of these (an IN filter). The two are
   *  never passed together. */
  types?: string[];
  accountId?: string;
  /** `null` filters for the uncategorized/deleted-category bucket
   *  (`category_id IS NULL`) rather than leaving the filter off. */
  categoryId?: string | null;
  /** Alternative to `categoryId`: match any of these (`null` included means
   *  "or uncategorized"). Never passed together with `categoryId`. */
  categoryIds?: (string | null)[];
  search?: string;
  /** Inclusive `YYYY-MM-DD` bounds on `occurred_at`. */
  from?: string;
  to?: string;
};

/** Keyset position: the last row of the page just handed out. */
export type TxnCursor = { occurredAt: string; id: string };

export type TransactionPage = {
  rows: TransactionWithRefs[];
  /** Null once the ledger has been read to its end. */
  nextCursor: TxnCursor | null;
};

type TxnQuery = ReturnType<typeof selectTransactions>;

function applyTxnFilters(q: TxnQuery, f: TxnFilters): TxnQuery {
  if (f.type) q = q.eq("type", f.type as "expense" | "income" | "payment");
  if (f.types) q = q.in("type", f.types as ("expense" | "income" | "payment")[]);
  // A payment shows up on both of its accounts, so filtering by account has
  // to match either leg — the same rule the ledger applied client-side.
  if (f.accountId) q = q.or(`account_id.eq.${f.accountId},to_account_id.eq.${f.accountId}`);
  if (f.categoryId !== undefined) {
    q = f.categoryId === null ? q.is("category_id", null) : q.eq("category_id", f.categoryId);
  }
  if (f.categoryIds) {
    const real = f.categoryIds.filter((id): id is string => id !== null);
    const hasNull = f.categoryIds.includes(null);
    if (real.length > 0 && hasNull) q = q.or(`category_id.in.(${real.join(",")}),category_id.is.null`);
    else if (real.length > 0) q = q.in("category_id", real);
    else if (hasNull) q = q.is("category_id", null);
  }

  const terms = searchTerms(f.search ?? "");
  if (terms.length > 0) q = q.or(terms.join(","));

  // occurred_at is a calendar date stored at UTC midnight, so the bounds a
  // native date input produces are compared in UTC too — anything local would
  // drop the first or last day of the range for users off UTC.
  if (f.from) q = q.gte("occurred_at", `${f.from}T00:00:00.000Z`);
  if (f.to) q = q.lte("occurred_at", `${f.to}T23:59:59.999Z`);

  return q;
}

/**
 * One page of the ledger, newest first.
 *
 * Keyset rather than offset: the ledger is read newest-first while new rows
 * are inserted at that same end, and an offset would show a row twice or skip
 * one every time that happens mid-scroll.
 */
export async function getTransactions(
  filters: TxnFilters = {},
  cursor?: TxnCursor | null,
  pageSize: number = TRANSACTIONS_PAGE_SIZE,
): Promise<TransactionPage> {
  const supabase = await createClient();
  let q = applyTxnFilters(selectTransactions(supabase), filters)
    .order("occurred_at", { ascending: false })
    // occurred_at alone is not a total order — it has no time-of-day component,
    // so a single day holds many rows and the cursor would stall on it forever.
    .order("id", { ascending: false })
    // Reading one extra row is the only honest "is there more?" signal: a page
    // that comes back exactly full is otherwise indistinguishable from the last.
    .limit(pageSize + 1);

  if (cursor) {
    const at = new Date(cursor.occurredAt).toISOString();
    q = q.or(`occurred_at.lt.${at},and(occurred_at.eq.${at},id.lt.${cursor.id})`);
  }

  const { data } = await q;
  const rows = data ?? [];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page.at(-1);

  return {
    rows: await withCreditKinds(supabase, page),
    nextCursor: hasMore && last ? { occurredAt: last.occurred_at, id: last.id } : null,
  };
}

/** Transactions touching an account as either source or destination. */
export async function getAccountTransactions(accountId: string): Promise<TransactionWithRefs[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select(TXN_SELECT)
    .or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`)
    .order("occurred_at", { ascending: false })
    .limit(100);
  return withCreditKinds(supabase, data ?? []);
}



export type QuickAddData = {
  accounts: QuickAddAccount[];
  categories: QuickAddCategory[];
  /** Empty for a user who has never made a group, which is what keeps the
   *  transaction form free of the override field for everybody else. */
  budgetGroups: QuickAddBudgetGroup[];
  currencies: CurrencyRow[];
  baseCurrency: string;
  /** Source account of the most recent expense/payment, for pre-selecting it
   *  on open. Null once there's no history to draw one from. */
  recentAccountId: string | null;
  /** Category ids, most-used first, for hoisting the chip rail. */
  categoryOrder: string[];
  /**
   * Market rates as units-per-1-base. Used only to offer a suggested rate on a
   * cross-currency payment — the rate a transaction is stored with is derived
   * server-side at insert, not from this.
   */
  rates: Record<string, number>;
};

export async function getQuickAddData(): Promise<QuickAddData> {
  const supabase = await createClient();
  const [
    { data: accounts },
    { data: categories },
    { data: budgetGroups },
    { data: currencies },
    { data: profile },
    { data: recent },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select(
        "id,name,currency,type,network_fee_optional,bank_id,transfer_tax_rate,network_fee_amount",
      )
      .eq("is_archived", false)
      .order("sort_order")
      .order("created_at"),
    supabase.from("categories").select("id,name,emoji,color,budget_group_id").order("sort_order"),
    supabase.from("budget_groups").select("id,name,emoji").order("sort_order"),
    supabase.from("currencies").select("*").order("code"),
    supabase.from("profiles").select("base_currency").maybeSingle(),
    /* Enough history to rank categories meaningfully without paying for a full
       scan. Ordered by id as a tiebreak because occurred_at is date-only, so
       several rows a day share a timestamp and the "most recent account" would
       otherwise be arbitrary among them. */
    supabase
      .from("transactions")
      .select("account_id,category_id,type")
      .in("type", ["expense", "payment"])
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(60),
  ]);

  const baseCurrency = baseCurrencyOf(profile);
  const recentRows = (recent ?? []) as RecentRow[];

  return {
    accounts: accounts ?? [],
    categories: categories ?? [],
    budgetGroups: budgetGroups ?? [],
    currencies: currencies ?? [],
    baseCurrency,
    recentAccountId: recentSourceAccountId(recentRows),
    categoryOrder: rankCategoryIds(recentRows),
    // Sequential on purpose — the base currency is the request. Cached for 12h
    // by lib/fx, so this is a network hop once a day, not once a modal.
    rates: await getExchangeRates(baseCurrency),
  };
}
