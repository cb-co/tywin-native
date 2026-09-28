export type ImportPrompt = "never" | "overdue" | "none";

/** The audit's north-star metric is "imported in the last 35 days", and a monthly
 *  statement needs a few days of slack around a 30-day cycle. */
export const IMPORT_STALE_DAYS = 35;

/**
 * Which import callout Overview should show.
 *
 * "none" is the goal state, not a failure: a user who imports every month should
 * pay no screen space for a feature they have already adopted. The callout exists
 * to convert the users who have not.
 */
export function importPromptState(
  cards: { latest_period_end: string | null }[],
  now = new Date(),
): ImportPrompt {
  const ends = cards.map((c) => c.latest_period_end).filter((d): d is string => !!d);
  if (ends.length === 0) return "never";

  // ISO dates sort lexically, so no parse is needed to find the newest.
  const newest = ends.reduce((a, b) => (a > b ? a : b));
  // `latest_period_end` is a date, not an instant, so `now` is truncated to a
  // UTC calendar day before diffing. Left as a raw timestamp, the time-of-day
  // `now` happens to carry shifts the boundary by up to 24h — a statement
  // exactly `IMPORT_STALE_DAYS` old would read as overdue for half the day.
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ageDays = (today - Date.parse(`${newest}T00:00:00Z`)) / 86_400_000;
  return ageDays > IMPORT_STALE_DAYS ? "overdue" : "none";
}
