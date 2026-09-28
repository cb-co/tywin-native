import { createClient } from "#/lib/supabase/server";

/** Recurring templates with their accounts and category, active first, then by name. */
export async function getSubscriptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "*, account:accounts!subscriptions_account_id_fkey(id,name,currency,type), to_account:accounts!subscriptions_to_account_id_fkey(id,name,currency), category:categories!subscriptions_category_id_fkey(id,name,emoji,color)",
    )
    .order("is_active", { ascending: false })
    .order("name");
  return data ?? [];
}

export type SubscriptionWithRefs = Awaited<ReturnType<typeof getSubscriptions>>[number];
