import { createClient } from "#/lib/supabase/server";
import { nextUnpaid } from "@cigua/core/overview/next-unpaid";
import { addDays, localDate } from "@cigua/core/period/cycle";
import type { BillingCycle } from "@cigua/core/subscriptions/cycle";

/** Recurring templates with their accounts and category, active first, then by name.
 *
 *  `next_due` is the next occurrence not yet recorded — a charge recorded
 *  ahead of its date moves it on, by the same rule as Overview's Upcoming list
 *  and the payment reminders (nextUnpaid). Null when paused or undated. */
export async function getSubscriptions() {
  const supabase = await createClient();
  const today = localDate();
  const [{ data }, { data: charges }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "*, account:accounts!subscriptions_account_id_fkey(id,name,currency,type), to_account:accounts!subscriptions_to_account_id_fkey(id,name,currency), category:categories!subscriptions_category_id_fkey(id,name,emoji,color)",
      )
      .order("is_active", { ascending: false })
      .order("name"),
    // Every template's recent charges in one trip; the longest run-up, a
    // yearly template's, is two-thirds of a year.
    supabase
      .from("transactions")
      .select("subscription_id,occurred_at")
      .not("subscription_id", "is", null)
      .gte("occurred_at", addDays(today, -250)),
  ]);

  const recorded = new Map<string, string[]>();
  for (const c of charges ?? []) {
    if (!c.subscription_id) continue;
    recorded.set(c.subscription_id, [...(recorded.get(c.subscription_id) ?? []), c.occurred_at.slice(0, 10)]);
  }

  return (data ?? []).map((s) => ({
    ...s,
    next_due: s.is_active
      ? (nextUnpaid({
          schedule: { cycle: s.billing_cycle as BillingCycle, anchorDay: s.anchor_day, anchorDate: s.anchor_date },
          amount: Number(s.amount),
          payments: (recorded.get(s.id) ?? []).map((date) => ({ date, amount: Number(s.amount) })),
          today,
        })?.date ?? null)
      : null,
  }));
}

export type SubscriptionWithRefs = Awaited<ReturnType<typeof getSubscriptions>>[number];
