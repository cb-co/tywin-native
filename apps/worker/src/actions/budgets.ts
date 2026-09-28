import { z } from "zod";
import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { addMonths } from "@cigua/core/budgets/month";
import { dbError } from "#/lib/errors";

type Result = { error?: string; id?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const setBudgetSchema = z.object({
  category_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}-01$/),
  amount: z.coerce.number().min(0),
});

export async function setBudget(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const parsed = setBudgetSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase
    .from("category_budgets")
    .upsert(
      { user_id: user.id, ...parsed.data },
      { onConflict: "category_id,month" },
    );
  if (error) return { error: await dbError(error, "setBudget") };
  return {};
}

function categorySchema(nameRequiredMessage: string) {
  return z.object({
    name: z.string().trim().min(1, nameRequiredMessage).max(40),
    emoji: z.string().trim().max(8).optional().or(z.literal("")),
    color: z.string().trim().max(9).optional().or(z.literal("")),
    /* Which budget group this category rolls up to.
       `nullable` and `optional` mean two different things here and both are
       used. Null is the clear — "this category belongs to no group" — and has
       to survive as a written value. Undefined is silence, from any caller
       that predates the field, and must leave the stored group alone; see the
       update below. An empty string is neither, which is why the dialog sends
       null rather than "" — `""` fails the uuid cast and surfaces as a
       validation error about a field the user never typed in. */
    budget_group_id: z.string().uuid().nullable().optional(),
  });
}

export async function createCategory(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const tb = await getTranslations("Budgets");
  const parsed = categorySchema(tb("categoryNameRequired")).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      emoji: parsed.data.emoji || null,
      color: parsed.data.color || null,
      budget_group_id: parsed.data.budget_group_id ?? null,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createCategory") };
  return { id: data.id };
}

export async function updateCategory(id: string, input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const tb = await getTranslations("Budgets");
  const parsed = categorySchema(tb("categoryNameRequired")).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  /* The group is written only when the caller said something about it. A
     caller that omits the field is not asking to clear it, and `?? null` here
     would quietly unassign every category edited by anything that has not
     learned about groups. An explicit null still clears, which is the whole
     point of the field being nullable. */
  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      emoji: parsed.data.emoji || null,
      color: parsed.data.color || null,
      ...(parsed.data.budget_group_id !== undefined
        ? { budget_group_id: parsed.data.budget_group_id }
        : {}),
    })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateCategory") };
  return { id };
}

export async function deleteCategory(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteCategory") };
  return {};
}

export async function copyPreviousMonth(month: string): Promise<Result> {
  const t = await getTranslations("Common");
  const tb = await getTranslations("Budgets");
  if (!/^\d{4}-\d{2}-01$/.test(month)) return { error: tb("badMonth") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const prev = addMonths(month, -1);
  const { data: prevBudgets } = await supabase
    .from("category_budgets")
    .select("category_id,amount")
    .eq("month", prev);

  if (!prevBudgets || prevBudgets.length === 0)
    return { error: tb("noBudgetsToCopy") };

  const { error } = await supabase.from("category_budgets").upsert(
    prevBudgets.map((b) => ({
      user_id: user.id,
      category_id: b.category_id,
      month,
      amount: b.amount,
    })),
    { onConflict: "category_id,month" },
  );
  if (error) return { error: await dbError(error, "copyPreviousMonth") };
  return {};
}
