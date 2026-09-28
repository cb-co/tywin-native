import { PAY_CYCLE_VALUES, periodFor, type PayCycle, type Period } from "./cycle";

export type PayCycleProfile = {
  pay_cycle?: string | null;
  pay_anchor_day?: number | null;
};

/**
 * The cycle a profile is paid on, defaulted in one place.
 *
 * The fallback is `monthly`, NOT the column's `semimonthly` default, and the
 * difference is deliberate. The column default decides what a new row is
 * created with; this decides what to render when the row has not loaded. A
 * failed profile read must show the user today's app, not silently re-scope
 * their budget to a period they never chose.
 */
export function payCycleOf(profile: PayCycleProfile | null | undefined): PayCycle {
  const value = profile?.pay_cycle;
  return (PAY_CYCLE_VALUES as readonly string[]).includes(value ?? "")
    ? (value as PayCycle)
    : "monthly";
}

export function payAnchorOf(profile: PayCycleProfile | null | undefined): number | null {
  return profile?.pay_anchor_day ?? null;
}

/** The period a profile is in on `today` ("YYYY-MM-DD"). */
export function currentPeriod(
  profile: PayCycleProfile | null | undefined,
  today: string,
): Period {
  return periodFor(today, payCycleOf(profile), payAnchorOf(profile));
}
