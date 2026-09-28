import { createClient } from "#/lib/supabase/server";
import { baseCurrencyOf } from "@cigua/core/profile";
import { computeFunding, type ContributionRow } from "./funding";
import { computePace, type Pace } from "./pace";
import { buildGoalHistory, type GoalPoint } from "./history";

export type ContributableAccount = { id: string; name: string; currency: string };

export type GoalCardRow = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  target_amount: number;
  target_date: string | null;
  saved: number;
  backed: number;
  shortfall: number;
  pace: Pace;
};

export type GoalsOverview = {
  goals: GoalCardRow[];
  totalSaved: number;
  totalTarget: number;
  totalBacked: number;
  totalShortfall: number;
  baseCurrency: string;
  /** Accounts a contribution may be drawn from, for the contribute dialog. */
  accounts: ContributableAccount[];
};

/** Accounts that can hold savings. Cards and loans are debts. */
const SAVINGS_ACCOUNT_TYPES = ["checking", "savings", "cash", "investment", "asset"] as const;

export async function getGoalsOverview(): Promise<GoalsOverview> {
  const supabase = await createClient();
  const [{ data: goals }, { data: contributions }, { data: balances }, { data: profile }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("savings_goals")
        .select("id,name,emoji,color,target_amount,target_date")
        .is("archived_at", null)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("goal_contributions")
        .select("id,goal_id,account_id,amount,base_amount,occurred_at")
        .order("occurred_at"),
      supabase.from("account_balances").select("account_id,balance"),
      supabase.from("profiles").select("base_currency").maybeSingle(),
      supabase
        .from("accounts")
        .select("id,name,currency")
        .eq("is_archived", false)
        .in("type", SAVINGS_ACCOUNT_TYPES)
        .order("sort_order")
        .order("created_at"),
    ]);

  const rows: ContributionRow[] = (contributions ?? []).map((c) => ({
    id: c.id,
    goal_id: c.goal_id,
    account_id: c.account_id,
    amount: Number(c.amount),
    base_amount: Number(c.base_amount),
    occurred_at: c.occurred_at,
  }));

  const funding = computeFunding(
    rows,
    (balances ?? []).map((b) => ({ account_id: b.account_id!, balance: Number(b.balance) })),
  );

  const byGoal = new Map<string, ContributionRow[]>();
  for (const r of rows) {
    const list = byGoal.get(r.goal_id);
    if (list) list.push(r);
    else byGoal.set(r.goal_id, [r]);
  }

  const cards: GoalCardRow[] = (goals ?? []).map((g) => {
    const f = funding.goals.get(g.id) ?? { saved: 0, backed: 0, shortfall: 0 };
    return {
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      target_amount: Number(g.target_amount),
      target_date: g.target_date,
      saved: f.saved,
      backed: f.backed,
      shortfall: f.shortfall,
      pace: computePace({
        saved: f.saved,
        shortfall: f.shortfall,
        target: Number(g.target_amount),
        targetDate: g.target_date,
        contributions: byGoal.get(g.id) ?? [],
      }),
    };
  });

  return {
    goals: cards,
    totalSaved: cards.reduce((s, g) => s + g.saved, 0),
    totalTarget: cards.reduce((s, g) => s + g.target_amount, 0),
    totalBacked: cards.reduce((s, g) => s + g.backed, 0),
    totalShortfall: cards.reduce((s, g) => s + g.shortfall, 0),
    baseCurrency: baseCurrencyOf(profile),
    accounts: accounts ?? [],
  };
}

export type ContributionDetail = {
  id: string;
  /** Origin account's currency. Negative is a withdrawal. */
  amount: number;
  /** The same money in base currency. */
  base_amount: number;
  currency: string;
  occurred_at: string;
  note: string | null;
  account_id: string;
  /** Resolved for display; not carried by `goal_contributions` itself. */
  account_name: string;
};

export type GoalDetail = {
  /** The same shape the grid renders, so the card and this page never disagree. */
  goal: GoalCardRow;
  /** Newest first. */
  contributions: ContributionDetail[];
  history: GoalPoint[];
  baseCurrency: string;
  /** So the page can offer Contribute without a second round trip. */
  accounts: ContributableAccount[];
};

/**
 * One goal, its contribution history, and its cumulative balance chart.
 *
 * Returns `null` when the goal doesn't exist (or belongs to someone else —
 * RLS simply returns no row, which reads identically to "not found" and needs
 * no extra ownership check here).
 *
 * Like `getGoalsOverview`, the funding figures are computed from ALL of the
 * user's contributions and balances, not a query narrowed to this goal: the
 * borrow-back allocation in `computeFunding` depends on every other goal
 * sharing the same accounts, so narrowing the input would silently change
 * `backed`/`shortfall` for goals that draw from a shared account.
 */
export async function getGoalDetail(id: string): Promise<GoalDetail | null> {
  const supabase = await createClient();
  const [{ data: goal }, { data: contributions }, { data: balances }, { data: profile }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("savings_goals")
        .select("id,name,emoji,color,target_amount,target_date")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("goal_contributions")
        .select("id,goal_id,account_id,amount,base_amount,currency,occurred_at,note")
        .order("occurred_at"),
      supabase.from("account_balances").select("account_id,balance"),
      supabase.from("profiles").select("base_currency").maybeSingle(),
      supabase
        .from("accounts")
        .select("id,name,currency,type,is_archived")
        .order("sort_order")
        .order("created_at"),
    ]);

  if (!goal) return null;

  const allContributions = (contributions ?? []).map((c) => ({
    id: c.id,
    goal_id: c.goal_id,
    account_id: c.account_id,
    amount: Number(c.amount),
    base_amount: Number(c.base_amount),
    currency: c.currency,
    occurred_at: c.occurred_at,
    note: c.note,
  }));

  const funding = computeFunding(
    allContributions.map((c): ContributionRow => c),
    (balances ?? []).map((b) => ({ account_id: b.account_id!, balance: Number(b.balance) })),
  );

  const own = allContributions.filter((c) => c.goal_id === id);
  const f = funding.goals.get(id) ?? { saved: 0, backed: 0, shortfall: 0 };

  const goalCard: GoalCardRow = {
    id: goal.id,
    name: goal.name,
    emoji: goal.emoji,
    color: goal.color,
    target_amount: Number(goal.target_amount),
    target_date: goal.target_date,
    saved: f.saved,
    backed: f.backed,
    shortfall: f.shortfall,
    pace: computePace({
      saved: f.saved,
      shortfall: f.shortfall,
      target: Number(goal.target_amount),
      targetDate: goal.target_date,
      contributions: own,
    }),
  };

  const accountNames = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const contributionDetails: ContributionDetail[] = own
    .slice()
    // Newest first; ties (same occurred_at) broken by id so ordering is stable.
    .sort((a, b) =>
      a.occurred_at === b.occurred_at
        ? b.id.localeCompare(a.id)
        : a.occurred_at > b.occurred_at ? -1 : 1,
    )
    .map((c) => ({
      id: c.id,
      amount: c.amount,
      base_amount: c.base_amount,
      currency: c.currency,
      occurred_at: c.occurred_at,
      note: c.note,
      account_id: c.account_id,
      account_name: accountNames.get(c.account_id) ?? c.account_id,
    }));

  const contributableAccounts: ContributableAccount[] = (accounts ?? [])
    .filter(
      (a) => !a.is_archived && (SAVINGS_ACCOUNT_TYPES as readonly string[]).includes(a.type),
    )
    .map((a) => ({ id: a.id, name: a.name, currency: a.currency }));

  return {
    goal: goalCard,
    contributions: contributionDetails,
    history: buildGoalHistory(own),
    baseCurrency: baseCurrencyOf(profile),
    accounts: contributableAccounts,
  };
}

/**
 * Committed/available per account, for the accounts page. Separate from
 * `getGoalsOverview` so `/accounts` does not pay for goal and pace assembly it
 * never renders. Reads the raw contribution rows and hands them to
 * `computeFunding` — the same function `getGoalsOverview` uses — rather than
 * a SQL view: the per-(account, goal)-pair clamp rule that decides how much
 * capacity a net-negative pair consumes is subtle enough that it drifted out
 * of step once between a SQL copy and this TypeScript one (see migration
 * 20260803190000_drop_account_commitments.sql). Keeping a single encoding,
 * covered by the tests in ./funding.test.ts, is worth the extra row fetch.
 */
export async function getAccountFunding(): Promise<
  Map<string, { committed: number; available: number }>
> {
  const supabase = await createClient();
  const [{ data: contributions }, { data: balances }] = await Promise.all([
    supabase.from("goal_contributions").select("id,goal_id,account_id,amount,base_amount,occurred_at"),
    supabase.from("account_balances").select("account_id,balance"),
  ]);

  const funding = computeFunding(
    (contributions ?? []).map((c) => ({
      id: c.id,
      goal_id: c.goal_id,
      account_id: c.account_id,
      amount: Number(c.amount),
      base_amount: Number(c.base_amount),
      occurred_at: c.occurred_at,
    })),
    (balances ?? []).map((b) => ({ account_id: b.account_id!, balance: Number(b.balance) })),
  );

  return new Map(
    [...funding.accounts.values()].map((a) => [
      a.accountId,
      { committed: a.committed, available: a.available },
    ]),
  );
}
