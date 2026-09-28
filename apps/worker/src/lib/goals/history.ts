/**
 * A goal's cumulative balance over the last few months, for the detail page's
 * chart.
 *
 * Modeled on `lib/insights/net-worth-history.ts`: one point per month, its
 * value "as of" that month's last day. The difference is that a goal has no
 * present-day figure to rewind from — contributions are the only source of
 * truth — so each point is a forward running sum of every contribution dated
 * at or before that month's end, INCLUDING contributions from before the
 * window even starts. A goal funded long ago and untouched since must still
 * show its true balance on month one, not a line that opens at zero and jumps
 * the moment its first in-window contribution lands.
 */

import { monthStart, addMonths, shortMonth, monthEnd } from "@cigua/core/budgets/month";

export type GoalPoint = { month: string; label: string; balance: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildGoalHistory(
  contributions: { base_amount: number; occurred_at: string }[],
  opts?: { months?: number; today?: Date },
): GoalPoint[] {
  const months = opts?.months ?? 6;
  const through = monthStart(opts?.today);
  const windowMonths = Array.from({ length: months }, (_, i) => addMonths(through, i - (months - 1)));

  // occurred_at is an ISO timestamp; a plain string comparison against
  // "YYYY-MM-DD" works because the date component sorts identically to the
  // timestamp it's a prefix of.
  const sorted = [...contributions].sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1));

  let running = 0;
  let cursor = 0;
  return windowMonths.map((month) => {
    const cutoff = monthEnd(month);
    while (cursor < sorted.length && sorted[cursor].occurred_at.slice(0, 10) <= cutoff) {
      running += Number(sorted[cursor].base_amount);
      cursor++;
    }
    return { month, label: shortMonth(month), balance: round2(running) };
  });
}
