/**
 * How much of each goal is actually backed by money, and how much of each
 * account is spoken for.
 *
 * The rule is that an account cannot hold back more than it has:
 *
 *   committed(account) = min( max(raw, 0), max(balance, 0) )
 *   available(account) = balance − committed(account)
 *
 * This is a clamp applied at read time, not bookkeeping. The alternative — a
 * trigger that deducts from a goal when a transaction overdraws an account —
 * has to pick a goal to write to, goes stale the moment the triggering
 * transaction is edited or deleted, and is simply wrong under backdating, which
 * statement imports do routinely. The clamp has none of those problems and
 * self-heals: spend down and a goal's backing shrinks, get paid and it returns.
 *
 * Allocation runs per (account, goal) pair rather than per contribution row.
 * That is enough to be deterministic, and withdrawals net out for free.
 */

export type ContributionRow = {
  id: string;
  goal_id: string;
  account_id: string;
  /** Origin account's currency. Negative is a withdrawal. */
  amount: number;
  /** The same money in base currency. Negative is a withdrawal. */
  base_amount: number;
  occurred_at: string;
};

export type BalanceRow = { account_id: string; balance: number };

export type GoalFunding = {
  goalId: string;
  /** Σ base_amount — what has been set aside. */
  saved: number;
  /** The portion actually present in its origin accounts, in base. */
  backed: number;
  /** saved − backed, never negative. */
  shortfall: number;
};

export type AccountFunding = {
  accountId: string;
  balance: number;
  committed: number;
  available: number;
};

export type Funding = {
  goals: Map<string, GoalFunding>;
  accounts: Map<string, AccountFunding>;
};

type Pair = {
  goalId: string;
  /** Net of contributions and withdrawals, origin currency. */
  net: number;
  /** The same net in base currency. */
  netBase: number;
  /** Newest contribution in this pair, for the borrow-back ordering. */
  latestAt: string;
  latestId: string;
};

/** Money is stored at 4dp; rounding here keeps float drift out of the totals. */
export const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * An account cannot hold back more than it has:
 *
 *   committed(account) = min( max(raw, 0), max(balance, 0) )
 *
 * The single definition of the clamp rule, called from `computeFunding`.
 * Named rather than inlined because this rule was once duplicated in SQL,
 * drifted from this definition, and shipped wrong — worth a name even with
 * one caller.
 */
export function clampCommitment(raw: number, balance: number): number {
  return Math.min(Math.max(raw, 0), Math.max(balance, 0));
}

export function computeFunding(
  contributions: ContributionRow[],
  balances: BalanceRow[],
): Funding {
  // 1. Collapse rows into (account, goal) pairs.
  const pairsByAccount = new Map<string, Map<string, Pair>>();
  const saved = new Map<string, number>();

  for (const c of contributions) {
    saved.set(c.goal_id, (saved.get(c.goal_id) ?? 0) + c.base_amount);

    let byGoal = pairsByAccount.get(c.account_id);
    if (!byGoal) pairsByAccount.set(c.account_id, (byGoal = new Map()));

    const existing = byGoal.get(c.goal_id);
    if (!existing) {
      byGoal.set(c.goal_id, {
        goalId: c.goal_id,
        net: c.amount,
        netBase: c.base_amount,
        latestAt: c.occurred_at,
        latestId: c.id,
      });
      continue;
    }
    existing.net += c.amount;
    existing.netBase += c.base_amount;
    // Ties broken by id so the ordering does not depend on input order.
    if (
      c.occurred_at > existing.latestAt ||
      (c.occurred_at === existing.latestAt && c.id > existing.latestId)
    ) {
      existing.latestAt = c.occurred_at;
      existing.latestId = c.id;
    }
  }

  // 2. Clamp each account, then hand its capacity to its goals oldest first,
  // ensuring that newer commitments are the first to lose their backing when
  // balance is insufficient.
  const accounts = new Map<string, AccountFunding>();
  const backed = new Map<string, number>();

  for (const { account_id, balance } of balances) {
    const byGoal = pairsByAccount.get(account_id);
    const raw = byGoal ? [...byGoal.values()].reduce((s, p) => s + Math.max(p.net, 0), 0) : 0;
    const committed = round4(clampCommitment(raw, balance));

    accounts.set(account_id, {
      accountId: account_id,
      balance,
      committed,
      available: round4(balance - committed),
    });
    if (!byGoal) continue;

    // A pair that has been fully withdrawn consumes no capacity and receives
    // no allocation.
    const funded = [...byGoal.values()]
      .filter((p) => p.net > 0)
      .sort((a, b) =>
        a.latestAt === b.latestAt
          ? b.latestId.localeCompare(a.latestId)
          : a.latestAt > b.latestAt ? 1 : -1,
      );

    let remaining = committed;
    for (const pair of funded) {
      const allocated = Math.min(pair.net, remaining);
      remaining = round4(remaining - allocated);
      // Convert at the pair's own blended rate rather than re-fetching FX: the
      // rate that applied when the money was set aside is the honest one.
      const allocatedBase = pair.netBase * (allocated / pair.net);
      backed.set(pair.goalId, (backed.get(pair.goalId) ?? 0) + allocatedBase);
      if (remaining <= 0) break;
    }
  }

  // 3. Assemble per-goal figures.
  const goals = new Map<string, GoalFunding>();
  for (const [goalId, savedBase] of saved) {
    // `backed` is accumulated from allocations against positive pairs only —
    // it can never itself go negative — but a goal net-negative overall
    // (withdrawals outweighing contributions) has `saved` below `backed`'s
    // floor of 0. Clamping here, not in the accumulator, keeps "backed can't
    // exceed what's actually saved" true without touching the allocation math.
    const backedBase = round4(Math.min(backed.get(goalId) ?? 0, Math.max(savedBase, 0)));
    goals.set(goalId, {
      goalId,
      saved: round4(savedBase),
      backed: backedBase,
      shortfall: round4(Math.max(savedBase - backedBase, 0)),
    });
  }

  return { goals, accounts };
}
