/**
 * How long one recommendation stands before it is regenerated.
 *
 * Twelve hours, so a person who opens the app morning and evening gets two
 * different readings of their day, and someone who opens it eight times gets
 * one. The number is a product decision, not a technical limit — the row is
 * cheap to read and the regeneration is what costs.
 */
export const RECOMMENDATION_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Whether a stored recommendation needs regenerating.
 *
 * Two independent reasons, and the second is the one that is easy to forget:
 * the text is GENERATED in a language rather than translated into one, so a row
 * written in English is wrong for a Spanish reader no matter how recent it is.
 * Age alone would leave someone who just switched languages staring at the
 * other one for up to twelve hours.
 *
 * An unparseable timestamp counts as stale. The alternative — treating it as
 * fresh — would pin a broken row in place permanently, and regenerating costs
 * one call.
 */
export function isStale(
  generatedAt: string,
  rowLocale: string,
  locale: string,
  now = new Date(),
): boolean {
  if (rowLocale !== locale) return true;
  const age = now.getTime() - new Date(generatedAt).getTime();
  return Number.isNaN(age) || age >= RECOMMENDATION_TTL_MS;
}
