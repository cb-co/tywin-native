/**
 * The single definition of a period boundary in the product.
 *
 * Nothing else — TypeScript or SQL — derives one. The range functions in
 * 20260908120000_pay_cycle.sql take explicit p_start/p_end dates precisely so
 * that a period is computed once, here, and passed down.
 *
 * All arithmetic is on "YYYY-MM-DD" strings, following lib/budgets/month.ts:
 * a Date carries a time and a zone, and a period boundary that drifts by a day
 * across a timezone would silently move money between periods.
 */

export const PAY_CYCLE_VALUES = ["monthly", "semimonthly", "weekly"] as const;
export type PayCycle = (typeof PAY_CYCLE_VALUES)[number];

/** Inclusive on both ends. `end` is a real day the user can spend on. */
export type Period = { start: string; end: string };

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const parse = (date: string): [number, number, number] =>
  date.split("-").map(Number) as [number, number, number];

/** Days in a 1-indexed month. `new Date(y, m, 0)` is the last day of month m. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Today as a date-only "YYYY-MM-DD" string in the RUNTIME'S OWN timezone.
 *  Deliberately not `toISOString().slice(0,10)`, which is UTC: `monthStart()`
 *  in lib/budgets/month.ts has always derived the current month from local
 *  getters, and a period boundary that disagreed with it would roll a user
 *  into the next period hours early — on the 15th, or worse, on the last day
 *  of the month, where a monthly profile would jump a whole month. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `date` shifted by whole days, as a date-only string. Uses UTC so the shift
 *  can never land on a DST-shortened local day and lose an hour into the
 *  previous date. */
export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday, Monday = 1 … Sunday = 7. */
export function isoWeekday(date: string): number {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // Sunday = 0
  return dow === 0 ? 7 : dow;
}

/** The largest first payday a semimonthly cycle takes: its second payday is
 *  15 days later, and a first payday of 16 would put that past every month. */
export const SEMIMONTHLY_MAX_ANCHOR = 15;

/** The two days a semimonthly period starts on, as written on the calendar
 *  (before any end-of-month clamp). A null or out-of-range anchor is the 1st,
 *  which is the 1st/16th split every semimonthly profile had before the
 *  anchor existed. */
export function semimonthlyStarts(anchor: number | null): [number, number] {
  const first = anchor && anchor >= 1 && anchor <= SEMIMONTHLY_MAX_ANCHOR ? anchor : 1;
  return [first, first + 15];
}

/** The anchor day as it lands in a given month: a 31st anchor becomes the 30th
 *  in September rather than rolling into October. */
function anchorInMonth(year: number, month: number, anchor: number): number {
  return Math.min(anchor, daysInMonth(year, month));
}

export function periodFor(date: string, cycle: PayCycle, anchor: number | null): Period {
  const [y, m, d] = parse(date);

  if (cycle === "semimonthly") {
    // Two periods a month, starting on the anchor and 15 days after it: 1 -> the
    // 1st and 16th (the null default), 5 -> the 5th and 20th, 15 -> the 15th
    // and the 30th — clamped to the month's last day, so February's second
    // quincena still starts inside February.
    const [first, second] = semimonthlyStarts(anchor);
    const secondIn = (yy: number, mm: number) => anchorInMonth(yy, mm, second);
    const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
    if (d >= secondIn(y, m)) {
      return { start: iso(y, m, secondIn(y, m)), end: addDays(iso(ny, nm, first), -1) };
    }
    if (d >= first) {
      return { start: iso(y, m, first), end: iso(y, m, secondIn(y, m) - 1) };
    }
    return { start: iso(py, pm, secondIn(py, pm)), end: iso(y, m, first - 1) };
  }

  if (cycle === "weekly") {
    const target = anchor && anchor >= 1 && anchor <= 7 ? anchor : 1;
    // Days since the most recent anchor weekday, 0 when today is the anchor.
    const back = (isoWeekday(date) - target + 7) % 7;
    const start = addDays(date, -back);
    return { start, end: addDays(start, 6) };
  }

  // monthly
  const a = anchor && anchor >= 1 && anchor <= 31 ? anchor : 1;
  const thisMonthAnchor = anchorInMonth(y, m, a);
  // Before this month's anchor, the period began in the previous month.
  const [sy, sm] = d >= thisMonthAnchor ? [y, m] : m === 1 ? [y - 1, 12] : [y, m - 1];
  const start = iso(sy, sm, anchorInMonth(sy, sm, a));
  const [ny, nm] = sm === 12 ? [sy + 1, 1] : [sy, sm + 1];
  const end = addDays(iso(ny, nm, anchorInMonth(ny, nm, a)), -1);
  return { start, end };
}

/** The day the money arrives — the day after the current period ends. This is
 *  the date the Overview hero counts down to. */
export function nextPayday(date: string, cycle: PayCycle, anchor: number | null): string {
  return addDays(periodFor(date, cycle, anchor).end, 1);
}

/** The period `delta` steps away. Implemented by stepping off the end of the
 *  current period rather than by adding a fixed span, so a quincena of 15 days
 *  and one of 16 both land correctly. */
export function shiftPeriod(
  p: Period,
  cycle: PayCycle,
  anchor: number | null,
  delta: number,
): Period {
  let cur = p;
  for (let i = 0; i < Math.abs(delta); i++) {
    const probe = delta > 0 ? addDays(cur.end, 1) : addDays(cur.start, -1);
    cur = periodFor(probe, cycle, anchor);
  }
  return cur;
}

/** True when a period is exactly one calendar month — the case where the UI
 *  shows one budget figure instead of two, and where the page must look
 *  identical to today's. */
export function isWholeMonth(p: Period): boolean {
  const [sy, sm, sd] = parse(p.start);
  const [ey, em, ed] = parse(p.end);
  return sd === 1 && sy === ey && sm === em && ed === daysInMonth(ey, em);
}
