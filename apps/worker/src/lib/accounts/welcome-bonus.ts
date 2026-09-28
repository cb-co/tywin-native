import { crossRate, getExchangeRates } from "#/lib/fx";
import { dayAfter } from "@cigua/core/overview/card-due";
import type { createClient } from "#/lib/supabase/server";
import type { CardGroupSibling } from "./queries";

export type { CardGroupSibling } from "./queries";

/** The goal to show for `accountId`: its own value if fully set, otherwise the
 *  most-recently-updated fully-set value among its card_group siblings. */
export function resolveEffectiveBonus(
  accountId: string,
  group: CardGroupSibling[],
): CardGroupSibling | null {
  const mine = group.find((a) => a.id === accountId);
  if (mine?.welcome_bonus_goal_amount != null && mine.welcome_bonus_due_date != null) return mine;
  const withGoal = group
    .filter((a) => a.welcome_bonus_goal_amount != null && a.welcome_bonus_due_date != null)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return withGoal[0] ?? null;
}

/** Sums `rows` (each in its own account's currency) into `goalCurrency`, using
 *  `rates` (as returned by getExchangeRates(goalCurrency)). A missing rate
 *  falls back to 1:1 rather than dropping the row — matches the fallback
 *  convention already used by convertToBase/baseRate in lib/fx.ts. Rows whose
 *  account isn't in `currencyByAccount` are skipped (shouldn't happen in
 *  practice — every queried account_id comes from the same sibling list that
 *  built the map). */
export function sumConvertedSpend(
  rows: { account_id: string; total_amount: number }[],
  currencyByAccount: Map<string, string>,
  goalCurrency: string,
  rates: Record<string, number>,
): number {
  let total = 0;
  for (const r of rows) {
    const currency = currencyByAccount.get(r.account_id);
    if (!currency) continue;
    const rate = crossRate(currency, goalCurrency, rates);
    total += r.total_amount * (rate ?? 1);
  }
  return total;
}

/** Total spend (type = 'expense') across every line in `lines`, from the
 *  start of each line's history through `dueDate` (inclusive), converted into
 *  `goalCurrency` using today's live rate. See spec §3/§7 for why a live
 *  rather than historical rate is used.
 *
 *  `occurred_at` is a timestamptz, so "inclusive of dueDate" is implemented
 *  as a half-open range (`< dayAfter(dueDate)`) rather than `<= dueDate` —
 *  the latter would coerce to midnight UTC on dueDate and silently drop
 *  same-day expenses that occurred later in the day. */
export async function getWelcomeBonusSpend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lines: CardGroupSibling[],
  goalCurrency: string,
  dueDate: string,
): Promise<number> {
  const ids = lines.map((l) => l.id);
  if (ids.length === 0) return 0;

  const { data: rows } = await supabase
    .from("transactions")
    .select("account_id, total_amount")
    .eq("type", "expense")
    .in("account_id", ids)
    .lt("occurred_at", dayAfter(dueDate));

  const currencyByAccount = new Map(lines.map((l) => [l.id, l.currency]));
  const rates = await getExchangeRates(goalCurrency);
  return sumConvertedSpend(rows ?? [], currencyByAccount, goalCurrency, rates);
}
