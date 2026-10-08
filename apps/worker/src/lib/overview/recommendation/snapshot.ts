import type { Overview, UpcomingItem } from "#/lib/overview/queries";
import type { BudgetRow } from "#/lib/budgets/queries";
import type { GoalCardRow } from "#/lib/goals/queries";

type UpcomingKind = "card_payment" | "loan_installment" | "recurring" | "other";

/**
 * What one person's finances look like to the model.
 *
 * Every field is a number, a currency code, a date, or a category name. That is
 * the whole privacy design: there is no field here a name could be put in, so
 * nothing downstream has to remember not to put one there. `buildSnapshot` takes
 * the RAW rows — names, UUIDs and all — precisely so the dropping happens in one
 * place with a test on it.
 *
 * Amounts are rounded to whole currency units. Coaching does not need cents, and
 * false precision spends tokens to make the model sound like a ledger.
 */
export type Cashflow = { income: number; expense: number };

const TOP_CATEGORY_LIMIT = 5;

export type RecommendationSnapshot = {
  asOf: string;
  dayOfMonth: number;
  daysLeftInMonth: number;
  baseCurrency: string;
  netWorth: number;
  monthIncome: number;
  monthExpense: number;
  /* Per-month equivalents of the person's saved recurring templates. Kept
     apart because "rent and streaming" and "the card payment" call for
     different advice, and income is what they are weighed against. Transfers to
     their own accounts and loan payments are in none of them. */
  monthlyRecurringExpenses: number;
  monthlyRecurringCardPayments: number;
  monthlyRecurringIncome: number;
  budgets: { category: string; budget: number; used: number }[];
  accounts: { type: string; currency: string; balance: number }[];
  loans: { currency: string; outstanding: number; installment: number }[];
  goals: { target: number; saved: number; targetDate: string | null }[];
  /** For a card_payment with a statement, `amount` is the minimum still left
   *  (or the rest of the cutoff balance once the minimum is paid), and
   *  `statementBalanceLeft` is the cutoff balance still standing. */
  upcoming: {
    kind: UpcomingKind;
    amount: number;
    currency: string;
    dueInDays: number;
    statementBalanceLeft?: number;
  }[];
  /* Always the CALENDAR month, unlike monthIncome/monthExpense above, which
     follow the person's pay period. "Same point last month" only means
     something against a fixed month, and dayOfMonth is a calendar day. */
  trend: {
    monthToDate: Cashflow;
    lastMonthSamePoint: Cashflow;
    lastMonthExpense: number;
    /* Extrapolated here, not left to the model: it is told to use only the
       numbers it is given, and multiplying is where it would go wrong. */
    projectedMonthExpense: number;
    /* Null before any income has landed. Negative when spending outruns it. */
    savingsRatePct: number | null;
  };
  /* Biggest spending categories so far this month, budgeted or not — `budgets`
     only sees the ones with a limit. lastMonthUsed is the same point last month. */
  topCategories: { category: string; used: number; lastMonthUsed: number }[];
};

export type SnapshotRows = {
  now: Date;
  overview: Overview;
  budgets: BudgetRow[];
  goals: GoalCardRow[];
  accounts: { id: string; name: string; type: string; currency: string; balance: number }[];
  loans: { currency: string; outstanding: number; installment: number }[];
  calendar: { thisMonth: Cashflow; lastMonthSamePoint: Cashflow; lastMonth: Cashflow };
  /** Spend per category id over the same point of last month. */
  lastMonthUsedByCategory: Map<string, number>;
};

/* `UpcomingItem.key` is the only place the kind survives — `title` and
   `subtitle` are already translated prose and carry the account's name. The key
   also carries a UUID, so the prefix is taken and the rest discarded. */
const KIND_BY_PREFIX: Record<string, UpcomingKind> = {
  card: "card_payment",
  loan: "loan_installment",
  sub: "recurring",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function upcomingKind(item: UpcomingItem): UpcomingKind {
  return KIND_BY_PREFIX[item.key.split("-")[0]] ?? "other";
}

/** Whole days from `now` to `date`, floored at zero — an overdue item is "due
 *  today" to the model rather than a negative number it has to interpret. */
function dueInDays(date: string, now: Date): number {
  const days = Math.round((new Date(date).getTime() - now.getTime()) / MS_PER_DAY);
  return Math.max(days, 0);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysLeftInMonth(now: Date): number {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return end.getUTCDate() - now.getUTCDate();
}

export function buildSnapshot(rows: SnapshotRows): RecommendationSnapshot {
  const { now, overview: o } = rows;
  const r = Math.round;
  const { thisMonth } = rows.calendar;
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = dayOfMonth + daysLeftInMonth(now);

  return {
    asOf: isoDate(now),
    dayOfMonth: now.getUTCDate(),
    daysLeftInMonth: daysLeftInMonth(now),
    baseCurrency: o.baseCurrency,
    netWorth: r(o.netWorth),
    monthIncome: r(o.monthIncome),
    monthExpense: r(o.monthExpense),
    monthlyRecurringExpenses: r(o.monthlyRecurringExpenses),
    monthlyRecurringCardPayments: r(o.monthlyRecurringCardPayments),
    monthlyRecurringIncome: r(o.monthlyRecurringIncome),
    // Categories with no limit set are dropped: nothing can be over, under or
    // approaching a budget of zero, so they are pure prompt noise.
    budgets: rows.budgets
      .filter((b) => b.budget > 0)
      .map((b) => ({ category: b.name, budget: r(b.budget), used: r(b.used) })),
    accounts: rows.accounts.map((a) => ({
      type: a.type,
      currency: a.currency,
      balance: r(a.balance),
    })),
    loans: rows.loans.map((l) => ({
      currency: l.currency,
      outstanding: r(l.outstanding),
      installment: r(l.installment),
    })),
    goals: rows.goals.map((g) => ({
      target: r(g.target_amount),
      saved: r(g.saved),
      targetDate: g.target_date,
    })),
    upcoming: o.upcoming.map((u) => ({
      kind: upcomingKind(u),
      amount: r(u.amount),
      currency: u.currency,
      dueInDays: dueInDays(u.date, now),
      ...(u.card ? { statementBalanceLeft: r(u.card.statementLeft) } : {}),
    })),
    trend: {
      monthToDate: { income: r(thisMonth.income), expense: r(thisMonth.expense) },
      lastMonthSamePoint: {
        income: r(rows.calendar.lastMonthSamePoint.income),
        expense: r(rows.calendar.lastMonthSamePoint.expense),
      },
      lastMonthExpense: r(rows.calendar.lastMonth.expense),
      projectedMonthExpense: r((thisMonth.expense / dayOfMonth) * daysInMonth),
      savingsRatePct:
        thisMonth.income > 0 ? r(((thisMonth.income - thisMonth.expense) / thisMonth.income) * 100) : null,
    },
    topCategories: rows.budgets
      .filter((b) => b.used > 0)
      .sort((a, b) => b.used - a.used)
      .slice(0, TOP_CATEGORY_LIMIT)
      .map((b) => ({
        category: b.name,
        used: r(b.used),
        lastMonthUsed: r(rows.lastMonthUsedByCategory.get(b.category_id) ?? 0),
      })),
  };
}
