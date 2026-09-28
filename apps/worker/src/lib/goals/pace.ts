/**
 * What a goal's progress says about whether it will arrive.
 *
 * Two readings, depending on whether the goal names a date. With one, required
 * pace can be compared against actual pace and the answer is a verdict. Without
 * one, all that can honestly be said is a projection.
 *
 * The degraded states are deliberate branches rather than arithmetic accidents:
 * every one of them is a case where a naive (target − saved) / months would
 * divide by zero or produce a number that reads as fact.
 */

import { monthStart, addMonths, monthsBetween } from "@cigua/core/budgets/month";

/** Months of contributions averaged to get the current rate. */
const WINDOW = 3;

export type PaceInput = {
  saved: number;
  shortfall: number;
  target: number;
  /** "YYYY-MM-DD", or null for an open-ended goal. */
  targetDate: string | null;
  contributions: { base_amount: number; occurred_at: string }[];
  /** Injectable for tests. Defaults to now. */
  today?: Date;
};

export type Pace =
  | { kind: "shortfall"; amount: number }
  | { kind: "complete" }
  | { kind: "overdue" }
  | { kind: "no-pace" }
  | { kind: "on-track"; required: number; actual: number }
  | { kind: "behind"; required: number; actual: number }
  | { kind: "projection"; actual: number; months: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computePace(input: PaceInput): Pace {
  const { saved, shortfall, target, targetDate, contributions } = input;
  const today = input.today ?? new Date();
  const thisMonth = monthStart(today);

  // Money borrowed back outranks every other reading: a pace computed against
  // money that is not there would be arithmetic about a fiction.
  if (shortfall > 0) return { kind: "shortfall", amount: round2(shortfall) };
  if (saved >= target) return { kind: "complete" };

  // The date is the more specific fact, so an expired one outranks "no pace".
  if (targetDate) {
    const targetMonth = `${targetDate.slice(0, 7)}-01`;
    if (monthsBetween(thisMonth, targetMonth) < 0) return { kind: "overdue" };
  }

  const actual = averagePerMonth(contributions, thisMonth);
  if (actual <= 0) return { kind: "no-pace" };

  const outstanding = target - saved;

  if (targetDate) {
    const targetMonth = `${targetDate.slice(0, 7)}-01`;
    // A target inside the current month still gets one month of runway; zero
    // would make `required` infinite. We add 1 to monthsBetween to include the
    // current month in the runway calculation.
    const monthsLeft = Math.max(monthsBetween(thisMonth, targetMonth) + 1, 1);
    const required = round2(outstanding / monthsLeft);
    return required <= actual
      ? { kind: "on-track", required, actual }
      : { kind: "behind", required, actual };
  }

  return { kind: "projection", actual, months: Math.ceil(outstanding / actual) };
}

/**
 * The recent rate: net contributions over the last `WINDOW` months, divided by
 * the months that have actually elapsed. Dividing a two-week-old goal's first
 * deposit by three would understate it by a factor of three.
 */
function averagePerMonth(
  contributions: { base_amount: number; occurred_at: string }[],
  thisMonth: string,
): number {
  if (contributions.length === 0) return 0;

  const firstMonth = contributions
    .map((c) => `${c.occurred_at.slice(0, 7)}-01`)
    .reduce((a, b) => (a < b ? a : b));

  const elapsed = Math.min(monthsBetween(firstMonth, thisMonth) + 1, WINDOW);
  const months = Math.max(elapsed, 1);
  const windowStart = addMonths(thisMonth, -(months - 1));

  const sum = contributions
    .filter((c) => `${c.occurred_at.slice(0, 7)}-01` >= windowStart)
    .reduce((s, c) => s + c.base_amount, 0);

  return sum <= 0 ? 0 : round2(sum / months);
}
