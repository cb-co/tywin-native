import { isWholeMonth, type Period } from "../period/cycle";

/** Which budget figures a row shows. A whole calendar month, or a monthly
 *  cycle's own pay period (which takes the month's amount whole), shows the
 *  stored amount alone. Anything else shows the stored monthly rate and what
 *  it prorates to, so the derived number never appears without the number it
 *  came from. */
export function budgetLabelParts(
  period: Period,
  monthly: number,
  prorated: number,
): { monthly: number; prorated: number | null } {
  if (monthly === 0) return { monthly, prorated: null };
  return { monthly, prorated: isWholeMonth(period) || prorated === monthly ? null : prorated };
}
