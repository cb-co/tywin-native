import { isBankAccount, type AccountType } from "../accounts/meta";
import type { QuickAddAccount, QuickAddCategory } from "./types";
import type { TransactionType } from "./schema";

/** A recent transaction, narrowed to the columns the defaults actually read. */
export type RecentRow = {
  account_id: string | null;
  category_id: string | null;
  type: TransactionType;
};

/** Category ids, most-used first.
 *
 *  Expenses only: income carries no category at all, and a payment defaults to
 *  the "none" sentinel, so counting either would rank noise above the
 *  categories a person actually picks. */
export function rankCategoryIds(recent: RecentRow[]): string[] {
  const counts = new Map<string, number>();
  for (const r of recent) {
    if (r.type !== "expense" || !r.category_id) continue;
    counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** The source account of the newest row that has one.
 *
 *  Relies on the caller passing rows newest-first — re-sorting here would mean
 *  duplicating the query's `occurred_at, id` ordering in two places. */
export function recentSourceAccountId(recent: RecentRow[]): string | null {
  return recent.find((r) => r.account_id)?.account_id ?? null;
}

/** Which account a new transaction should start on.
 *
 *  Falling back to `accounts[0]` alone would pick whatever the query happened
 *  to return first — a card or loan is a bad default source for an expense — so
 *  a bank account is preferred before that last resort. */
export function defaultAccount(
  accounts: QuickAddAccount[],
  { preferredId, recentAccountId }: { preferredId?: string; recentAccountId?: string | null },
): QuickAddAccount | undefined {
  const find = (id: string | null | undefined) =>
    id ? accounts.find((a) => a.id === id) : undefined;
  return (
    find(preferredId) ??
    find(recentAccountId) ??
    accounts.find((a) => isBankAccount(a.type as AccountType)) ??
    accounts[0]
  );
}

/** Categories with the most-used ones hoisted to the front.
 *
 *  Applied to the chip rail only. The full `Select` keeps the catalogue in
 *  `sort_order`, because a picker whose options move around between opens is
 *  harder to use than one that is merely long. */
export function orderCategories(
  categories: QuickAddCategory[],
  order: string[],
): QuickAddCategory[] {
  const ranked = order
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is QuickAddCategory => c !== undefined);
  const rankedIds = new Set(ranked.map((c) => c.id));
  return [...ranked, ...categories.filter((c) => !rankedIds.has(c.id))];
}

export type FeeFlags = { include_tax: boolean; include_commission: boolean };

/** What `feeParts` needs off the source account to price a row. */
export type FeeAccount = {
  bank_id: string | null;
  transfer_tax_rate: number;
  network_fee_amount: number;
};

const NO_FEES: FeeFlags = { include_tax: false, include_commission: false };

/** Destinations that are the user's own money moving rather than a debt being
 *  settled. Paying a card or a loan is money leaving; moving it to your own
 *  cash or bank account is not. */
const OWN_MONEY: AccountType[] = ["cash", "checking", "savings"];

/** Which fees a new transaction should start with.
 *
 *  The transfer tax is an "impuesto por débito a cuenta": it follows the debit,
 *  so the SOURCE decides whether it applies at all, and a cash purchase or a
 *  card swipe is never taxed. The network fee is a flat per-transfer
 *  commission that some transfers carry and others do not, so it is never
 *  assumed — the user adds it when their bank actually charged one.
 *
 *  Both remain overridable; this is only where the form starts. */
export function resolveFeeDefaults({
  type,
  src,
  dst,
}: {
  type: TransactionType;
  src?: { type: string } | null;
  dst?: { type: string } | null;
}): FeeFlags {
  if (type === "income") return NO_FEES;
  if (!src || !isBankAccount(src.type as AccountType)) return NO_FEES;
  if (type === "payment" && (!dst || OWN_MONEY.includes(dst.type as AccountType))) return NO_FEES;
  return { include_tax: true, include_commission: false };
}

/** 4dp, matching numeric(18,4). Not `toFixed`: this is arithmetic, not display. */
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** A PREVIEW of what the row will cost, for display before it is saved.
 *
 *  Mirrors the BEFORE INSERT trigger in
 *  supabase/migrations/20260719031353_banks_normalize.sql — the trigger is
 *  authoritative and is what `tax_amount`/`fee_amount` actually end up as.
 *  Sub-cent divergence between Postgres numeric rounding and JavaScript floats
 *  is accepted here because nothing stored reads this. If the trigger's
 *  arithmetic ever changes, in a NEW migration, change this with it.
 *  See docs/specs/2026-08-17-quick-add-compact-design.md §2. */
export function feeParts({
  amount,
  src,
  dst,
  include_tax,
  include_commission,
}: {
  amount: number;
  src?: FeeAccount | null;
  dst?: { bank_id: string | null } | null;
} & FeeFlags): { tax: number; fee: number } {
  if (!src) return { tax: 0, fee: 0 };
  // Two unknown banks are not the same bank — matching on null would waive a
  // commission that was charged.
  const sameBank = !!src.bank_id && !!dst?.bank_id && src.bank_id === dst.bank_id;
  return {
    tax: include_tax ? round4(amount * (src.transfer_tax_rate ?? 0)) : 0,
    fee: include_commission && !sameBank ? (src.network_fee_amount ?? 0) : 0,
  };
}
