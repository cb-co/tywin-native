import { isWholeMonth, type Period } from "../period/cycle";

/** Which budget figures a row shows. A whole calendar month shows the stored
 *  amount alone — that is today's page and it must not change. Anything else
 *  shows the stored monthly rate and what it prorates to, so the derived
 *  number never appears without the number it came from. */
export function budgetLabelParts(
  period: Period,
  monthly: number,
  prorated: number,
): { monthly: number; prorated: number | null } {
  if (monthly === 0) return { monthly, prorated: null };
  return { monthly, prorated: isWholeMonth(period) ? null : prorated };
}
