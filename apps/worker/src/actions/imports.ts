import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { getImportTriage } from "#/lib/statements/triage";
import { dbError } from "#/lib/errors";

/**
 * Give every line of one merchant group a category, and remember the merchant.
 *
 * The client sends a group key, never a list of transaction ids: the rows are
 * re-derived from the import here. A client-supplied id list would let this
 * screen write a category onto any transaction the caller owns, which is not
 * what a per-import screen is allowed to do.
 *
 * The rule is saved silently and always. One tap has to do both jobs or the
 * rules table stays empty — which is exactly what the opt-in checkbox on the
 * transaction form produced. The rules screen is where a bad one is corrected.
 */
export async function categorizeTriageGroup(
  importId: string,
  groupKey: string,
  categoryId: string,
): Promise<{ error?: string; updated?: number }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  // RLS stops a caller writing another user's transactions, but it does not
  // police WHICH category id lands in the column — that check is ours.
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();
  if (!category) return { error: t("invalidInput") };

  const triage = await getImportTriage(importId);
  const group = triage?.groups.find((g) => g.key === groupKey);
  if (!group) return { error: t("invalidInput") };

  // `.is("category_id", null)` so a category set from the ledger while this
  // screen was open wins rather than being overwritten by a stale group — and
  // `.select("id")` so the count we return below is what Postgres actually
  // wrote, not the size of a group that may have gone stale in the same way.
  const { data: written, error } = await supabase
    .from("transactions")
    .update({ category_id: categoryId })
    .in("id", group.transactionIds)
    .is("category_id", null)
    .select("id");
  if (error) return { error: await dbError(error, "categorizeTriageGroup") };

  const { error: ruleError } = await supabase.from("category_rules").upsert(
    {
      user_id: user.id,
      rule_type: "merchant",
      pattern: group.pattern,
      category_id: categoryId,
      priority: 10,
    },
    { onConflict: "user_id,rule_type,pattern" },
  );
  if (ruleError) return { error: await dbError(ruleError, "categorizeTriageGroup") };

  return { updated: written?.length ?? 0 };
}
