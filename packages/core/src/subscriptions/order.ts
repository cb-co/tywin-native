import { nextChargeDate, type BillingCycle } from "./cycle";

export type OrderableSub = {
  is_active: boolean;
  billing_cycle: string;
  anchor_day: number | null;
  anchor_date: string | null;
};

/**
 * Recurring templates in ledger order: soonest next charge first, templates
 * with no computable next date and paused ones last. Stable, and never
 * mutates its input.
 */
export function orderByNext<T extends OrderableSub>(subs: T[], from = new Date()): T[] {
  const keyed = subs.map((s, i) => {
    const d = s.is_active
      ? nextChargeDate({ cycle: s.billing_cycle as BillingCycle, anchorDay: s.anchor_day, anchorDate: s.anchor_date }, from)
      : null;
    return { s, i, t: d ? d.getTime() : Number.POSITIVE_INFINITY };
  });
  return keyed.sort((a, b) => a.t - b.t || a.i - b.i).map((k) => k.s);
}
