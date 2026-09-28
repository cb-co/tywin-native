import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import {
  budgetGroupSchema,
  categoryGroupSchema,
  setGroupBudgetSchema,
} from "@cigua/core/budgets/group-schema";
import { dbError } from "#/lib/errors";

/* The planning dimension's write side, in its own file the way goal-actions.ts
   is — actions.ts owns categories and their budgets, this owns groups and
   theirs, and the two never need to touch. Nothing here reconciles the two
   systems: a category can carry a budget and belong to a budgeted group at the
   same time, and those are two answers to two different questions. */

type Result = { error?: string; id?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createBudgetGroup(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const tg = await getTranslations("BudgetGroups");
  const parsed = budgetGroupSchema(tg("nameRequired")).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { data: last } = await supabase
    .from("budget_groups")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("budget_groups")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      emoji: parsed.data.emoji || null,
      color: parsed.data.color || null,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createBudgetGroup") };
  return { id: data.id };
}

export async function updateBudgetGroup(id: string, input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const tg = await getTranslations("BudgetGroups");
  const parsed = budgetGroupSchema(tg("nameRequired")).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase
    .from("budget_groups")
    .update({
      name: parsed.data.name,
      emoji: parsed.data.emoji || null,
      color: parsed.data.color || null,
    })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateBudgetGroup") };
  return { id };
}

/**
 * Deleting a group deletes the plan, not the history.
 *
 * `categories.budget_group_id` and `transactions.budget_group_id` are both
 * `on delete set null`, so every category and every transaction survives this
 * untouched — they simply stop rolling up anywhere, which is the same state a
 * user who never made a group has been in all along. Only the group's own
 * monthly amounts cascade away with it.
 */
export async function deleteBudgetGroup(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  const { error } = await supabase.from("budget_groups").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteBudgetGroup") };
  return {};
}

export async function setGroupBudget(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const parsed = setGroupBudgetSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase
    .from("budget_group_budgets")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "budget_group_id,month" });
  if (error) return { error: await dbError(error, "setGroupBudget") };
  return {};
}

/**
 * Point a category at a group, or at none.
 *
 * `groupId` is `string | null` rather than optional on purpose: null is the
 * clear, and it has to reach the update as a written value. See
 * categoryGroupSchema.
 */
export async function setCategoryGroup(
  categoryId: string,
  groupId: string | null,
): Promise<Result> {
  const t = await getTranslations("Common");
  const parsed = categoryGroupSchema.safeParse({
    category_id: categoryId,
    budget_group_id: groupId,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase
    .from("categories")
    .update({ budget_group_id: parsed.data.budget_group_id })
    .eq("id", parsed.data.category_id);
  if (error) return { error: await dbError(error, "setCategoryGroup") };
  return { id: parsed.data.category_id };
}
