import { nextPayday } from "../period/cycle";

export const BILLING_CYCLE_VALUES = ["weekly", "biweekly", "semimonthly", "monthly", "yearly", "custom"] as const;
export type BillingCycle = (typeof BILLING_CYCLE_VALUES)[number];

export const BILLING_CYCLES: BillingCycle[] = [...BILLING_CYCLE_VALUES];

/**
 * Cycles offered in pickers. Biweekly (every 14 days) is hidden: the Dominican
 * Republic uses the semimonthly "quincenal" and the two are easily confused.
 * It stays valid data, so a form editing an existing biweekly row adds it back.
 */
export const BILLING_CYCLE_CHOICES: BillingCycle[] = BILLING_CYCLES.filter((c) => c !== "biweekly");


/**
 * When a recurring payment falls.
 *
 * Every cycle but one is anchored by a day NUMBER — day of week for weekly, day
 * of month otherwise. Biweekly cannot be: "every other Friday" needs to know
 * WHICH Friday, so it is anchored by a start DATE instead, and its occurrences
 * are that date plus multiples of 14 days.
 */
export type ChargeSchedule = {
  cycle: BillingCycle;
  anchorDay?: number | null;
  /** `YYYY-MM-DD`, biweekly only. */
  anchorDate?: string | null;
};

/** Whether this cycle is anchored by a start date rather than a day number. */
export const usesAnchorDate = (cycle: BillingCycle) => cycle === "biweekly";

const BIWEEKLY_DAYS = 14;

/** A `YYYY-MM-DD` as a LOCAL calendar date — `new Date("2026-09-01")` is UTC midnight. */
function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Best-effort next charge date from the schedule. Display-only. */
export function nextChargeDate(
  { cycle, anchorDay = null, anchorDate = null }: ChargeSchedule,
  from = new Date(),
): Date | null {
  if (cycle === "semimonthly") {
    // The next payday is "the day after the period containing `from` ends" —
    // with no anchor, the 16th or the 1st of next month. Reuses
    // profiles.pay_cycle's own period math rather than re-deriving it.
    const today = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
    return parseLocalDate(nextPayday(today, "semimonthly", anchorDay));
  }

  if (usesAnchorDate(cycle)) {
    const start = anchorDate ? parseLocalDate(anchorDate) : null;
    if (!start) return null;
    const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    if (start > today) return start;
    /* Counted in calendar days via Date.UTC, never by dividing milliseconds: a
       DST change in between makes one of those days 23 or 25 hours long, and
       the division would land a day off. Strictly after today, as weekly does. */
    const elapsed = Math.round(
      (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
        Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
        86_400_000,
    );
    const steps = Math.floor(elapsed / BIWEEKLY_DAYS) + 1;
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + steps * BIWEEKLY_DAYS);
  }

  if (!anchorDay) return null;

  if (cycle === "weekly") {
    const targetDow = (((anchorDay - 1) % 7) + 7) % 7; // 1..7 -> 0..6
    const res = new Date(from);
    const diff = (targetDow - from.getDay() + 7) % 7 || 7;
    res.setDate(from.getDate() + diff);
    return res;
  }

  const day = Math.min(anchorDay, 28);
  let res = new Date(from.getFullYear(), from.getMonth(), day);
  if (res < from) {
    const monthsAhead = cycle === "yearly" ? 12 : 1;
    res = new Date(from.getFullYear(), from.getMonth() + monthsAhead, day);
  }
  return res;
}

/** Normalize a recurring payment's cost to a monthly figure for totals. */
export function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "semimonthly":
      return amount * 2;
    case "yearly":
      return amount / 12;
    default:
      return amount; // monthly / custom treated as monthly
  }
}
