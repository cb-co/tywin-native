import { createClient } from "#/lib/supabase/server";
import { isStale } from "./freshness";
import { asTone } from "./tone";
import type { Recommendation } from "./llm";

/**
 * The cached recommendation, WHATEVER its age, plus whether it needs replacing.
 *
 * Returning a stale row rather than hiding it is what makes
 * stale-while-revalidate possible: the card shows this morning's reading
 * instantly and swaps in the new one when it lands, so the only blank card
 * anyone ever sees is on their first visit. Hiding it would trade a slightly
 * old sentence for an empty card for up to seventy seconds.
 *
 * No `.eq("user_id", ...)` filter — RLS scopes the row, exactly as the profile
 * read in `lib/overview/queries.ts` does.
 */
export async function getRecommendation(
  locale: string,
): Promise<{ rec: Recommendation | null; stale: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_recommendations")
    .select("headline,body,tone,locale,generated_at")
    .maybeSingle();

  if (!data) return { rec: null, stale: true };

  return {
    rec: { headline: data.headline, body: data.body, tone: asTone(data.tone) },
    stale: isStale(data.generated_at, data.locale, locale),
  };
}
