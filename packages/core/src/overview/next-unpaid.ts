/** Which occurrence of a scheduled payment is still to pay — the rule behind
 *  Overview's "Upcoming" rows for loans and recurring payments, and the dated
 *  legs of "Disponible". Kept pure, like card-due.ts, so it can be tested
 *  without a Supabase client. */
import { addDays, localDate } from "../period/cycle";
import { nextChargeDate, type BillingCycle, type ChargeSchedule } from "../subscriptions/cycle";

/** A payment already logged: its local date and its amount in the schedule's
 *  own currency. */
export type LoggedPayment = { date: string; amount: number };

export type Unpaid = { date: string; amount: number };

const CYCLE_DAYS: Record<BillingCycle, number> = {
  weekly: 7,
  biweekly: 14,
  semimonthly: 15,
  monthly: 30,
  yearly: 365,
  custom: 30,
};

/**
 * How many days before a due date a logged payment still counts toward it:
 * two-thirds of the cycle. Long enough to catch paying ahead (the car loan paid
 * on the 1st for the 5th, the rent paid a week early). Short enough that a late
 * payment for the PREVIOUS occurrence — the September installment paid on the
 * 8th — is not mistaken for this one and hides it.
 */
export function runUpDays(cycle: BillingCycle): number {
  return Math.floor((CYCLE_DAYS[cycle] * 2) / 3);
}

/** A remainder under 1% of the amount is rounding or a bank's own figure, not a
 *  shortfall worth a row. */
const SETTLED_SHARE = 0.01;

function atLocalMidnight(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The next occurrence on or after `today`, less whatever was logged toward it
 * in its run-up. Once those payments cover it, the row moves on to the
 * occurrence after, in full: a payment already made is not upcoming.
 *
 * Amounts, not counts: half an installment paid leaves the other half due on
 * the same date. A caller that cannot compare amounts (a recurring charge that
 * settled in another currency) passes each logged charge at the full `amount`.
 *
 * Null when the schedule has no date to give (no anchor day).
 */
export function nextUnpaid({
  schedule,
  amount,
  payments,
  today,
}: {
  schedule: ChargeSchedule;
  amount: number;
  payments: LoggedPayment[];
  /** `YYYY-MM-DD`, the person's local date. */
  today: string;
}): Unpaid | null {
  const next = nextChargeDate(schedule, atLocalMidnight(today));
  if (!next) return null;
  const due = localDate(next);

  const from = addDays(due, -runUpDays(schedule.cycle));
  const paid = payments.reduce((s, p) => (p.date > from && p.date <= due ? s + p.amount : s), 0);
  const left = amount - paid;
  if (left > amount * SETTLED_SHARE && left >= 0.01) return { date: due, amount: left };

  const after = nextChargeDate(schedule, atLocalMidnight(addDays(due, 1)));
  return after ? { date: localDate(after), amount } : null;
}

/**
 * The `count` occurrences after `date`, in full: nothing is logged against a
 * payment that has not come round yet. Lets a reminder schedule reach past the
 * next due date for someone who does not open the app every month.
 */
export function occurrencesAfter(schedule: ChargeSchedule, date: string, amount: number, count: number): Unpaid[] {
  const out: Unpaid[] = [];
  let from = date;
  for (let i = 0; i < count; i++) {
    const next = nextChargeDate(schedule, atLocalMidnight(addDays(from, 1)));
    if (!next) break;
    from = localDate(next);
    out.push({ date: from, amount });
  }
  return out;
}

/**
 * Whether a charge recorded on `lastRecorded` already settles the occurrence
 * due on `date` — recorded in its run-up, or after it (late). For a reminder
 * tapped days after it fired, when the next unpaid date has already moved on
 * and cannot answer the question.
 */
export function settlesOccurrence(date: string, cycle: BillingCycle, lastRecorded: string | null): boolean {
  return lastRecorded != null && lastRecorded > addDays(date, -runUpDays(cycle));
}
