import { createClient } from "#/lib/supabase/server";
import { getOverview } from "#/lib/overview/queries";
import { getBudgetOverview } from "#/lib/budgets/queries";
import { getGoalsOverview } from "#/lib/goals/queries";
import { monthStart, monthEnd, addMonths } from "@cigua/core/budgets/month";
import { buildSnapshot, type Cashflow, type RecommendationSnapshot } from "./snapshot";

/** The same day-of-month last month, clipped to that month's length — on the
 *  31st, March compares against all of February rather than a day that is not
 *  there. */
function sameDayLastMonth(thisStart: string, lastStart: string, day: number): string {
  const lastEnd = monthEnd(lastStart);
  const target = `${lastStart.slice(0, 8)}${String(day).padStart(2, "0")}`;
  return target < lastEnd ? target : lastEnd;
}

/**
 * Gathers everything the model is shown, and hands it to `buildSnapshot` to be
 * stripped.
 *
 * This runs inside the refresh action, NOT during page render, so it does not
 * duplicate the `getOverview()` the overview page already makes — the two never
 * happen in the same request. That is also why the query count here is not
 * something to economise on.
 *
 * Returns null when there is nothing to talk about. A user with no accounts
 * sees the overview's empty state, which never mounts the card.
 */
export async function collectSnapshot(now = new Date()): Promise<RecommendationSnapshot | null> {
  const supabase = await createClient();

  // Local calendar, to agree with monthStart(); the trend is about calendar
  // months, whatever pay period the overview itself is showing.
  const thisStart = monthStart(now);
  const lastStart = addMonths(thisStart, -1);
  const today = `${thisStart.slice(0, 8)}${String(now.getDate()).padStart(2, "0")}`;
  const lastSamePoint = sameDayLastMonth(thisStart, lastStart, now.getDate());
  const lastEnd = monthEnd(lastStart);

  const cashflow = async (start: string, end: string): Promise<Cashflow> => {
    const { data } = await supabase.rpc("cashflow_range", { p_start: start, p_end: end });
    const row = (data ?? [])[0];
    return { income: Number(row?.income ?? 0), expense: Number(row?.expense ?? 0) };
  };

  const [overview, budgets, goals, { data: accounts }, { data: balances }, { data: cards }, { data: loans },
    thisMonth, lastMonthSamePoint, lastMonth, { data: lastUsage }] =
    await Promise.all([
      getOverview(),
      // Deliberately the calendar month, not overview.period: getBudgetOverview
      // now takes a Period (Task 7), but this snapshot is unrelated to the
      // Budgets page's own period toggle — it feeds the daily coaching card,
      // whose wording (daysLeftInMonth, "this month") already assumes a
      // calendar month everywhere else in this file. Re-scoping it to a
      // quincena is a real behaviour change, not a signature update.
      getBudgetOverview({ start: monthStart(now), end: monthEnd(monthStart(now)) }),
      getGoalsOverview(),
      supabase.from("accounts").select("id,name,type,currency").eq("is_archived", false),
      supabase.from("account_balances").select("account_id,balance"),
      supabase.from("card_status").select("account_id,owed"),
      supabase.from("loan_status").select("currency,outstanding_balance,installment_amount"),
      cashflow(thisStart, today),
      cashflow(lastStart, lastSamePoint),
      cashflow(lastStart, lastEnd),
      // Every category, budgeted or not, so an unbudgeted one can be compared.
      supabase.rpc("category_usage_range", { p_start: lastStart, p_end: lastSamePoint }),
    ]);

  if (!overview.hasAccounts) return null;

  /* A card's `account_balances` row is not what it owes — `card_status.owed`
     is — and net worth already subtracts it. Cards are given as a NEGATIVE
     balance so the model reads a wallet as one list of positions rather than
     having to know which types invert. */
  const owedByCard = new Map((cards ?? []).map((c) => [c.account_id, Number(c.owed ?? 0)]));
  const balanceByAccount = new Map((balances ?? []).map((b) => [b.account_id, Number(b.balance)]));

  return buildSnapshot({
    now,
    overview,
    budgets: budgets.rows,
    goals: goals.goals,
    calendar: { thisMonth, lastMonthSamePoint, lastMonth },
    lastMonthUsedByCategory: new Map((lastUsage ?? []).map((u) => [u.category_id, Number(u.used ?? 0)])),
    accounts: (accounts ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: owedByCard.has(a.id) ? -(owedByCard.get(a.id) ?? 0) : (balanceByAccount.get(a.id) ?? 0),
    })),
    loans: (loans ?? []).map((l) => ({
      currency: l.currency ?? overview.baseCurrency,
      outstanding: Number(l.outstanding_balance ?? 0),
      installment: Number(l.installment_amount ?? 0),
    })),
  });
}
