import { z } from "zod";

/**
 * The last few recommendations a person was shown, newest first, kept so the
 * next one can avoid repeating them.
 *
 * Only the text is kept. The tone and the locale are not what the model needs
 * to steer away from, and a smaller list is a smaller prompt.
 */
export type RecentRecommendation = { headline: string; body: string };

export const RECENT_LIMIT = 5;

const EntrySchema = z.object({ headline: z.string(), body: z.string() });

/** The column is jsonb, so what comes back is whatever was ever written to it.
 *  Anything malformed is dropped rather than thrown on: history is a nicety, and
 *  a bad entry must not stop today's recommendation being written. */
export function parseRecent(value: unknown): RecentRecommendation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const parsed = EntrySchema.safeParse(v);
    return parsed.success ? [parsed.data] : [];
  });
}

/** `outgoing` is the recommendation about to be replaced: it goes to the front
 *  and the oldest falls off. Null when there was no previous row. */
export function pushRecent(stored: unknown, outgoing: RecentRecommendation | null): RecentRecommendation[] {
  const recent = parseRecent(stored);
  const next = outgoing ? [{ headline: outgoing.headline, body: outgoing.body }, ...recent] : recent;
  return next.slice(0, RECENT_LIMIT);
}
