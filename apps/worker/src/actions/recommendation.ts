import { getLocale } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { collectSnapshot } from "#/lib/overview/recommendation/collect";
import { inferRecommendation } from "#/lib/overview/recommendation/llm";
import { isStale } from "#/lib/overview/recommendation/freshness";
import { pushRecent } from "#/lib/overview/recommendation/history";

/**
 * Regenerates the overview's recommendation, if it still needs regenerating.
 *
 * The app fires this when Overview opens and never waits on it; it then reads
 * the fresh card on its next refetch.
 *
 * Every failure is silent and returns `{ refreshed: false }`. Nothing here is
 * worth surfacing: the page has already rendered everything the person came
 * for, and a missing recommendation is a missing nicety the next visit retries.
 */
export async function refreshRecommendation(): Promise<{ refreshed: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { refreshed: false };

  const locale = await getLocale();

  /* Re-read before spending a call. Two tabs opened together both mount the
     card and both see the same stale row; the second one arrives here after the
     first has written, and the cheapest place to notice is before the inference
     rather than after it. This is not a lock, and does not need to be — the
     worst case it fails to prevent is one wasted call. */
  const { data: existing } = await supabase
    .from("daily_recommendations")
    .select("headline,body,locale,generated_at")
    .maybeSingle();
  if (existing && !isStale(existing.generated_at, existing.locale, locale)) {
    return { refreshed: false };
  }

  /* `recent` is read on its own so that a database still waiting for the
     migration that adds the column costs the card its history and nothing else. */
  const { data: history } = await supabase.from("daily_recommendations").select("recent").maybeSingle();
  const recent = pushRecent(history?.recent, existing);

  const snapshot = await collectSnapshot();
  if (!snapshot) return { refreshed: false };

  const rec = await inferRecommendation(snapshot, locale, user.email, recent);
  if (!rec) return { refreshed: false };

  const row = {
    user_id: user.id,
    headline: rec.headline,
    body: rec.body,
    tone: rec.tone,
    locale,
    generated_at: new Date().toISOString(),
  };
  let { error } = await supabase.from("daily_recommendations").upsert({ ...row, recent }, { onConflict: "user_id" });
  // The column does not exist until the migration is pushed; keep the card alive.
  if (error) ({ error } = await supabase.from("daily_recommendations").upsert(row, { onConflict: "user_id" }));
  if (error) return { refreshed: false };

  return { refreshed: true };
}
