import type { BillingCycle } from "@cigua/core/subscriptions/cycle";
import type { PayCycle } from "@cigua/core/period/cycle";

export type PayCycleMapping = { payCycle: PayCycle; anchorDay: number | null };

/**
 * Converts a recurring-income template's weekly anchor day — this table's
 * Sunday=1..Saturday=7 scheme, the same one `nextChargeDate` reads — to
 * `profiles.pay_cycle`'s ISO scheme (Monday=1..Sunday=7). The two disagree on
 * numbering even though both call the value "weekly", so syncing one into the
 * other without this conversion would silently shift a user's budget period
 * onto the wrong weekday.
 */
export function weeklyAnchorToIso(anchorDay: number): number {
  const jsDow = (((anchorDay - 1) % 7) + 7) % 7; // 0 = Sunday, matching Date#getDay()
  return jsDow === 0 ? 7 : jsDow;
}

/**
 * Maps a recurring-income template's cycle onto the `profiles.pay_cycle` it
 * should drive, or null when the cycle has no `pay_cycle` equivalent
 * (biweekly, yearly, custom) — those templates simply don't sync. See
 * docs/specs/2026-09-15-recurring-income-design.md.
 */
export function mapIncomeCycleToPayCycle(
  cycle: BillingCycle,
  anchorDay: number | null,
): PayCycleMapping | null {
  switch (cycle) {
    case "monthly":
      return { payCycle: "monthly", anchorDay };
    case "weekly":
      return { payCycle: "weekly", anchorDay: anchorDay != null ? weeklyAnchorToIso(anchorDay) : null };
    case "semimonthly":
      return { payCycle: "semimonthly", anchorDay };
    default:
      return null;
  }
}
