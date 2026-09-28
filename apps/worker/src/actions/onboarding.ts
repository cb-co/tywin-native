import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { dbError } from "#/lib/errors";

/** Stamps onboarding as done. Called only after the first account exists, so
 *  the gate cannot release someone into an empty dashboard. */
export async function finishOnboarding(): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  // Guard the gate's own precondition rather than trusting the client to
  // have run the steps in order.
  const { count, error: countError } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", false);
  if (countError) return { error: await dbError(countError, "finishOnboarding") };

  const tw = await getTranslations("Welcome");
  if (!count) return { error: tw("errorNoAccount") };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: await dbError(error, "finishOnboarding") };

  return {};
}
