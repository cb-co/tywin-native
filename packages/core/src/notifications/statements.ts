import { addDays } from "../period/cycle";

/** `day` of the given month, clamped to the month's length: a card that closes
 *  on the 31st closes on the 30th in a 30-day month, not on the 1st of the next. */
function closingIn(year: number, month0: number, day: number): string {
  const d = new Date(Date.UTC(year, month0, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

/** Banks move a cutoff by a day or two around weekends and holidays, so a
 *  statement that closed within this many days before a closing date counts as
 *  that closing's statement. */
const CLOSING_SLACK_DAYS = 5;

/**
 * The closing dates whose statement should be imported: the latest one on or
 * before `today` and the next one, minus any already covered by an imported
 * statement. The planner drops whichever reminder has already gone by.
 */
export function pendingClosings(today: string, closingDay: number, latestPeriodEnd: string | null): string[] {
  const [y, m] = today.split("-").map(Number);
  let previous = closingIn(y, m - 1, closingDay);
  if (previous > today) previous = closingIn(y, m - 2, closingDay);
  const [py, pm] = previous.split("-").map(Number);
  const next = closingIn(py, pm, closingDay);
  const imported = (c: string) => latestPeriodEnd != null && latestPeriodEnd >= addDays(c, -CLOSING_SLACK_DAYS);
  return [previous, next].filter((c) => !imported(c));
}
