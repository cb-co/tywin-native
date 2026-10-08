import { nextChargeDate, type BillingCycle } from "./cycle";

export type OrderableSub = {
  is_active: boolean;
  billing_cycle: string;
  anchor_day: number | null;
  anchor_date: string | null;
  /** The next occurrence not yet recorded, when the server worked it out
   *  (`YYYY-MM-DD`). Preferred over the bare schedule, which cannot know. */
  next_due?: string | null;
};

/**
 * Recurring templates in ledger order: soonest next charge first, templates
 * with no computable next date and paused ones last. Stable, and never
 * mutates its input.
 */
export function orderByNext<T extends OrderableSub>(subs: T[], from = new Date()): T[] {
  const keyed = subs.map((s, i) => {
    const d = !s.is_active
      ? null
      : s.next_due !== undefined
        ? s.next_due && new Date(`${s.next_due}T00:00:00`)
        : nextChargeDate({ cycle: s.billing_cycle as BillingCycle, anchorDay: s.anchor_day, anchorDate: s.anchor_date }, from);
    return { s, i, t: d ? d.getTime() : Number.POSITIVE_INFINITY };
  });
  return keyed.sort((a, b) => a.t - b.t || a.i - b.i).map((k) => k.s);
}
