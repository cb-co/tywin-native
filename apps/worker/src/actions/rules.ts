import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { merchantPattern } from "#/lib/statements/merchant";
import { dbError } from "#/lib/errors";

/**
 * Edit a rule.
 *
 * Changes what future imports and future triage do. It does NOT rewrite
 * transactions already categorised: that would silently rework months of
 * history, including rows the user hand-corrected afterwards. The screen says so.
 */
export async function updateRule(
  id: string,
  input: { pattern: string; categoryId: string },
): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const pattern = merchantPattern(input.pattern);
  if (!pattern) return { error: t("invalidInput") };

  // RLS does not police which category id lands in this column — a category
  // belonging to someone else would otherwise silently attach here. Confirm
  // it's one the caller (via RLS-scoped select) can actually see.
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("id", input.categoryId)
    .maybeSingle();
  if (!category) return { error: t("invalidInput") };

  const { error } = await supabase
    .from("category_rules")
    .update({ pattern, category_id: input.categoryId })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateRule") };

  return {};
}

export async function deleteRule(id: string): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase.from("category_rules").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteRule") };

  return {};
}
