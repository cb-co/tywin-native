import { createClient } from "#/lib/supabase/server";
import type { Database } from "@cigua/core/supabase/types";
import { getAccountFunding } from "#/lib/goals/queries";
import { addMonths } from "@cigua/core/budgets/month";
import { buildCardGroupLines, type CardGroupLine } from "./group-lines";
import { cardSpendDistribution, type SpendSlice } from "@cigua/core/accounts/card-spend";
import type { FeeLineRow } from "@cigua/core/accounts/card-fees";
import type { LineCashback } from "@cigua/core/accounts/cashback";
import { getCreditKinds } from "#/lib/statements/credit-kind-queries";
import { sumAccountTransferCosts, type TransferCostRow } from "./transfer-costs";
import { getExchangeRates, convertToBase } from "#/lib/fx";
import { netWorthTotal } from "./net-worth";
import { accountsNeedingAttention, type AttentionItem } from "./attention";
import { localDate } from "@cigua/core/period/cycle";

export type { CardGroupLine } from "./group-lines";
export type { SpendSlice } from "@cigua/core/accounts/card-spend";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type CardRow = Database["public"]["Views"]["card_status"]["Row"];
type LoanRow = Database["public"]["Views"]["loan_status"]["Row"];
export type CurrencyRow = Database["public"]["Tables"]["currencies"]["Row"];
export type CardGroupRow = Database["public"]["Tables"]["card_groups"]["Row"];
export type BankRow = Database["public"]["Tables"]["banks"]["Row"];
export type CardStatementRow = Database["public"]["Tables"]["card_statements"]["Row"];

export type AccountWithStatus = AccountRow & {
  balance: number | null;
  /** Committed to savings goals, in the account's own currency. */
  committed: number;
  /** balance − committed. Never negative unless the balance itself is. */
  available: number;
  cardStatus: CardRow | null;
  loanStatus: LoanRow | null;
};

export async function getAccountsWithStatus(): Promise<AccountWithStatus[]> {
  const supabase = await createClient();
  const [{ data: accounts }, { data: balances }, { data: cards }, { data: loans }, funding] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("is_archived", false)
        .order("sort_order")
        .order("created_at"),
      supabase.from("account_balances").select("*"),
      supabase.from("card_status").select("*"),
      supabase.from("loan_status").select("*"),
      getAccountFunding(),
    ]);

  const balByAcct = new Map((balances ?? []).map((b) => [b.account_id, b.balance]));
  const cardByAcct = new Map((cards ?? []).map((c) => [c.account_id, c]));
  const loanByAcct = new Map((loans ?? []).map((l) => [l.account_id, l]));

  return (accounts ?? []).map((a) => {
    const balance = balByAcct.get(a.id) ?? a.starting_balance;
    const f = funding.get(a.id);
    return {
      ...a,
      balance,
      committed: f?.committed ?? 0,
      available: f?.available ?? balance,
      cardStatus: cardByAcct.get(a.id) ?? null,
      loanStatus: loanByAcct.get(a.id) ?? null,
    };
  });
}

export async function getAccountById(id: string): Promise<AccountWithStatus | null> {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!account) return null;

  const [{ data: balance }, { data: card }, { data: loan }, funding] = await Promise.all([
    supabase.from("account_balances").select("balance").eq("account_id", id).maybeSingle(),
    supabase.from("card_status").select("*").eq("account_id", id).maybeSingle(),
    supabase.from("loan_status").select("*").eq("account_id", id).maybeSingle(),
    getAccountFunding(),
  ]);

  const resolved = balance?.balance ?? account.starting_balance;
  const f = funding.get(id);

  return {
    ...account,
    balance: resolved,
    committed: f?.committed ?? 0,
    available: f?.available ?? resolved,
    cardStatus: card ?? null,
    loanStatus: loan ?? null,
  };
}

export async function getCurrencies(): Promise<CurrencyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("currencies").select("*").order("code");
  return data ?? [];
}

export async function getCardGroups(): Promise<CardGroupRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("card_groups").select("*").order("name");
  return data ?? [];
}

export async function getBanks(): Promise<BankRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("banks").select("*").order("name");
  return data ?? [];
}

export async function getCardStatements(accountId: string): Promise<CardStatementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_statements")
    .select("*")
    .eq("account_id", accountId)
    .order("period_end", { ascending: false });
  return data ?? [];
}

/**
 * How many lines of each statement still have no category, and which import to
 * send someone to. Keyed by statement id so the panel can render a count per row.
 *
 * Statements with no import (added by hand) are absent from the result: there is
 * no import to triage.
 */
export async function getPendingTriageCounts(
  accountId: string,
): Promise<Record<string, { importId: string; count: number }>> {
  const supabase = await createClient();
  const { data: statements } = await supabase
    .from("card_statements")
    .select("id,import_id")
    .eq("account_id", accountId)
    .not("import_id", "is", null);
  if (!statements || statements.length === 0) return {};

  const { data: lines } = await supabase
    .from("card_statement_lines")
    .select("statement_id,transaction:transactions!card_statement_lines_transaction_id_fkey(category_id)")
    .in("statement_id", statements.map((s) => s.id));

  const counts: Record<string, { importId: string; count: number }> = {};
  for (const s of statements) {
    const n = (lines ?? []).filter(
      (l) => l.statement_id === s.id && l.transaction && l.transaction.category_id === null,
    ).length;
    if (n > 0) counts[s.id] = { importId: s.import_id!, count: n };
  }
  return counts;
}

/**
 * One card's fee lines for one calendar year, ready for summarizeCardFees.
 *
 * Scoped to a single account and needs no FX at all, since the detail page
 * speaks that card's own currency throughout. The classification lives in
 * card-fees.ts, which keeps it testable without a database.
 *
 * Credits come along only to catch reversals — see reversalTarget.
 */
export async function getAccountFeeLines(
  accountId: string,
  year: number,
): Promise<FeeLineRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_statement_lines")
    .select("description,amount,kind,posted_on")
    .eq("account_id", accountId)
    .in("kind", ["fee", "credit"])
    .gte("posted_on", `${year}-01-01`)
    .lte("posted_on", `${year}-12-31`);
  return (data ?? []).map((r) => ({
    description: r.description ?? "",
    amount: Number(r.amount ?? 0),
    kind: r.kind as "fee" | "credit",
    posted_on: r.posted_on ?? "",
  }));
}

/** Cashback per statement id, summed from the credit lines credit-kind.ts calls cashback. */
export async function getStatementLineCashback(statementIds: string[]): Promise<LineCashback> {
  if (statementIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_statement_lines")
    .select("id,statement_id,account_id,description,mcc,amount")
    .in("statement_id", statementIds)
    .eq("kind", "credit");
  const lines = data ?? [];
  const kinds = await getCreditKinds(supabase, lines);
  const sums = new Map<string, number>();
  for (const l of lines) {
    if (kinds.get(l.id) !== "cashback") continue;
    sums.set(l.statement_id, (sums.get(l.statement_id) ?? 0) + Math.abs(Number(l.amount)));
  }
  return sums;
}

/**
 * What a card was charged for in `month`, grouped by category, in the card's
 * own currency.
 *
 * Scoped by `account_id`, so a payment made *to* the card never lands here:
 * settling a balance is not spending. See lib/accounts/card-spend.ts for the
 * inclusion rules the grouping applies on top of this window.
 */
export async function getCardSpendByCategory(
  accountId: string,
  month: string,
  uncategorizedLabel: string,
): Promise<SpendSlice[]> {
  const supabase = await createClient();
  const [{ data: rows }, { data: categories }] = await Promise.all([
    supabase
      .from("transactions")
      .select("category_id,total_amount")
      .eq("account_id", accountId)
      .eq("type", "expense")
      .gte("occurred_at", month)
      .lt("occurred_at", addMonths(month, 1)),
    supabase.from("categories").select("id,name,color,emoji"),
  ]);
  return cardSpendDistribution(rows ?? [], categories ?? [], uncategorizedLabel);
}

/**
 * Fees and tax this account paid in `year`, across every transaction type.
 *
 * Not payments only: the trigger that fills fee_amount/tax_amount runs on any
 * type, so an expense from a checking account carries both.
 *
 * Paged because PostgREST caps a request at `max_rows` (1000, see
 * supabase/config.toml) silently — a busy account would under-report with no
 * signal that it had.
 */
export async function getAccountTransferCosts(
  accountId: string,
  year: number,
): Promise<{ fees: number; tax: number }> {
  const supabase = await createClient();
  const PAGE_SIZE = 1000;
  const rows: TransferCostRow[] = [];
  let offset = 0;
  for (;;) {
    const { data } = await supabase
      .from("transactions")
      .select("fee_amount,tax_amount")
      .eq("account_id", accountId)
      .gte("occurred_at", `${year}-01-01`)
      .lt("occurred_at", `${year + 1}-01-01`)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return sumAccountTransferCosts(rows);
}

export type AccountCostOfCarry = { periodEnd: string; apr: number | null; costOfCarry: number };

/** This card's cost of carry from its newest statement, or null when there is
 *  no statement or the statement printed no figure. The view already picks the
 *  latest statement per line — see card_cost_of_carry. */
export async function getAccountCostOfCarry(accountId: string): Promise<AccountCostOfCarry | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_cost_of_carry")
    .select("period_end,interest_rate_annual,cost_of_carry")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!data || data.cost_of_carry === null) return null;
  return {
    periodEnd: data.period_end ?? "",
    apr: data.interest_rate_annual === null ? null : Number(data.interest_rate_annual),
    costOfCarry: Number(data.cost_of_carry),
  };
}

/** What was paid INTO this card during `month` (a "YYYY-MM-01" string), in the
 *  card's own currency — `to_amount` when the payment crossed currencies. */
export async function getCardPaymentsInMonth(accountId: string, month: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("amount,to_amount")
    .eq("type", "payment")
    .eq("to_account_id", accountId)
    .gte("occurred_at", month)
    .lt("occurred_at", addMonths(month, 1));
  const total = (data ?? []).reduce((s, r) => s + Number(r.to_amount ?? r.amount ?? 0), 0);
  return Math.round(total * 100) / 100;
}

export type CardGroupSibling = {
  id: string;
  currency: string;
  welcome_bonus_goal_amount: number | null;
  welcome_bonus_goal_currency: string | null;
  welcome_bonus_due_date: string | null;
  updated_at: string;
};

const SIBLING_COLUMNS =
  "id, currency, welcome_bonus_goal_amount, welcome_bonus_goal_currency, welcome_bonus_due_date, updated_at";

/** `accountId` plus every other account sharing its card_group_id (or just
 *  itself, if it isn't in a group). Used to resolve the "effective" welcome
 *  bonus goal across a card's currency lines and to sum spend across all of
 *  them. */
export async function getCardGroupSiblings(accountId: string): Promise<CardGroupSibling[]> {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select(`${SIBLING_COLUMNS}, card_group_id`)
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return [];
  if (!account.card_group_id) return [account];

  const { data: siblings } = await supabase
    .from("accounts")
    .select(SIBLING_COLUMNS)
    .eq("card_group_id", account.card_group_id)
    .eq("type", "credit_card");
  return siblings ?? [account];
}

/** The lines of `accountId`'s card, for the detail page's rail.
 *
 *  Empty for a card that belongs to no group — there is nothing to navigate
 *  between, and the rail renders nothing. */
export async function getCardGroupLines(accountId: string): Promise<CardGroupLine[]> {
  const supabase = await createClient();
  const { data: account } = await supabase.from("accounts").select("card_group_id").eq("id", accountId).maybeSingle();
  if (!account?.card_group_id) return [];

  // Archived lines are filtered in `buildCardGroupLines`, not here: the rule keeps
  // the current line whatever its state, and that is a projection decision the
  // pure helper owns and tests.
  const { data: rows } = await supabase
    .from("accounts")
    .select("id, card_line, is_archived")
    .eq("card_group_id", account.card_group_id)
    .eq("type", "credit_card");
  if (!rows) return [];

  return buildCardGroupLines(rows, accountId);
}

/** Net worth in `baseCurrency`, computed the same way Overview computes it.
 *
 * Deliberately re-fetches `account_balances`/`card_status`/`loan_status`
 * rather than reusing `getAccountsWithStatus`'s own fetch of the same views:
 * the net-worth formula intentionally includes archived-account handling
 * that differs from `getAccountsWithStatus`'s filter, so the two cannot
 * share one fetch without changing the net-worth number. Do not "simplify"
 * this into one shared query. */
export async function getNetWorth(baseCurrency: string): Promise<number> {
  const supabase = await createClient();
  const [{ data: balances }, { data: cards }, { data: loans }, rates] = await Promise.all([
    supabase.from("account_balances").select("*"),
    supabase.from("card_status").select("*"),
    supabase.from("loan_status").select("*"),
    getExchangeRates(baseCurrency),
  ]);
  const toBase = (amount: number, currency: string) => convertToBase(amount, currency, baseCurrency, rates);
  return netWorthTotal(balances ?? [], cards ?? [], loans ?? [], baseCurrency, toBase);
}

/**
 * Cards that need a decision: overdue, due soon, or still carrying
 * uncategorised statement lines. Walks every card account's newest
 * statement rather than every statement, since only the newest one's due
 * date and overdue figures are still actionable. The triage-count half of
 * this mirrors `getPendingTriageCounts` exactly, just unscoped across every
 * card account instead of one.
 */
export async function getAccountsAttention(): Promise<AttentionItem[]> {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, currency, color, brand, last4")
    .eq("is_archived", false)
    .eq("type", "credit_card");
  if (!accounts || accounts.length === 0) return [];

  const ids = accounts.map((a) => a.id);
  const { data: statements } = await supabase
    .from("card_statements")
    .select("id, account_id, import_id, due_date, overdue_amount, overdue_installments, period_end")
    .in("account_id", ids)
    .order("period_end", { ascending: false });

  // Only the newest statement per account — an older one's due date is moot.
  const newestByAccount = new Map<string, NonNullable<typeof statements>[number]>();
  for (const s of statements ?? []) {
    if (!newestByAccount.has(s.account_id)) newestByAccount.set(s.account_id, s);
  }

  // Pending triage, scoped to statements that actually have an import — same
  // guard getPendingTriageCounts uses, same reason (a hand-added statement
  // has no import to triage). Only the newest statement per account: that is
  // the only one `triageCountByStatement` is ever read for below, so fetching
  // every historical statement's lines here would join thousands of rows on
  // an account with years of history to use a small fraction of them.
  const importedStatementIds = [...newestByAccount.values()]
    .filter((s) => s.import_id !== null)
    .map((s) => s.id);
  const { data: lines } = importedStatementIds.length
    ? await supabase
        .from("card_statement_lines")
        .select("statement_id,transaction:transactions!card_statement_lines_transaction_id_fkey(category_id)")
        .in("statement_id", importedStatementIds)
    : { data: [] };

  const triageCountByStatement = new Map<string, number>();
  for (const l of lines ?? []) {
    if (l.transaction && l.transaction.category_id === null) {
      triageCountByStatement.set(l.statement_id, (triageCountByStatement.get(l.statement_id) ?? 0) + 1);
    }
  }

  // Local date, not UTC: the Dominican Republic is UTC-4, so in the evening
  // (UTC has already rolled to tomorrow) a card due literally today could
  // silently fail the dueDate >= today check below and drop off the ledger
  // on the exact day it matters. Same reasoning as lib/period/cycle.ts's own
  // doc comment on localDate, used the same way by lib/overview/queries.ts.
  const today = localDate();
  const inputs = accounts.map((a) => {
    const statement = newestByAccount.get(a.id);
    return {
      id: a.id,
      name: a.name,
      currency: a.currency,
      color: a.color,
      brand: a.brand,
      last4: a.last4,
      dueDate: statement?.due_date ?? null,
      overdueAmount: statement?.overdue_amount ?? null,
      overdueInstallments: statement?.overdue_installments ?? null,
      pendingTriageCount: statement ? triageCountByStatement.get(statement.id) ?? 0 : 0,
    };
  });

  return accountsNeedingAttention(inputs, today);
}
