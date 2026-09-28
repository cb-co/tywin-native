import { z } from "zod";
import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { dbError } from "#/lib/errors";

type Result = { error?: string; id?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function goalSchema(nameRequired: string) {
  return z.object({
    name: z.string().trim().min(1, nameRequired).max(40),
    emoji: z.string().trim().max(8).optional().or(z.literal("")),
    color: z.string().trim().max(9).optional().or(z.literal("")),
    target_amount: z.coerce.number().positive(),
    target_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("")),
  });
}

export async function createGoal(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const tg = await getTranslations("Goals");
  const parsed = goalSchema(tg("nameRequired")).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { data: last } = await supabase
    .from("savings_goals")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("savings_goals")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      emoji: parsed.data.emoji || null,
      color: parsed.data.color || null,
      target_amount: parsed.data.target_amount,
      target_date: parsed.data.target_date || null,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createGoal") };
  return { id: data.id };
}

export async function updateGoal(id: string, input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const tg = await getTranslations("Goals");
  const parsed = goalSchema(tg("nameRequired")).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase
    .from("savings_goals")
    .update({
      name: parsed.data.name,
      emoji: parsed.data.emoji || null,
      color: parsed.data.color || null,
      target_amount: parsed.data.target_amount,
      target_date: parsed.data.target_date || null,
    })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateGoal") };
  return { id };
}

export async function deleteGoal(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  // Contributions cascade, which releases the commitment on the origin accounts.
  const { error } = await supabase.from("savings_goals").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteGoal") };
  return {};
}

export async function deleteContribution(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  // Deleting a contribution changes both the goal's progress and the origin
  // account's available balance, same as adding one does.
  const { error } = await supabase.from("goal_contributions").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteContribution") };
  return {};
}

const contributionSchema = z.object({
  goal_id: z.string().uuid(),
  account_id: z.string().uuid(),
  amount: z.coerce.number().refine((n) => n !== 0),
  exchange_rate: z.coerce.number().positive().default(1),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function addContribution(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const tg = await getTranslations("Goals");
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  // The dialog already filters the picker; this is the enforcement point.
  const { data: account } = await supabase
    .from("accounts")
    .select("type,currency,is_archived")
    .eq("id", parsed.data.account_id)
    .maybeSingle();
  if (!account) return { error: tg("accountMissing") };
  if (account.type === "credit_card" || account.type === "loan" || account.is_archived) {
    return { error: tg("accountNotContributable") };
  }

  const { data, error } = await supabase
    .from("goal_contributions")
    .insert({
      user_id: user.id,
      goal_id: parsed.data.goal_id,
      account_id: parsed.data.account_id,
      amount: parsed.data.amount,
      // Pinned to the account's currency by trigger; sent for the not-null check.
      currency: account.currency,
      exchange_rate: parsed.data.exchange_rate,
      occurred_at: `${parsed.data.occurred_at}T12:00:00Z`,
      note: parsed.data.note || null,
    })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "addContribution") };
  return { id: data.id };
}
