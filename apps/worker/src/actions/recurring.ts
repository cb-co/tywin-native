import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { subscriptionInput, type SubscriptionInput } from "@cigua/core/subscriptions/schema";
import { getExchangeRates } from "#/lib/fx";
import { settledCharge } from "@cigua/core/subscriptions/charge";
import { usesAnchorDate } from "@cigua/core/subscriptions/cycle";
import { recordedFlags, type RecurringKind } from "@cigua/core/subscriptions/template";
import { mapIncomeCycleToPayCycle } from "#/lib/subscriptions/pay-cycle-sync";
import { setPayCycle } from "#/actions/settings";
import { resolveBaseRate } from "@cigua/core/transactions/money";
import { dbError } from "#/lib/errors";
import { baseCurrencyOf } from "@cigua/core/profile";

type Result = { error?: string; id?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function toRow(v: SubscriptionInput) {
  const payment = v.kind === "payment";
  const dated = usesAnchorDate(v.billing_cycle);
  return {
    kind: v.kind,
    name: v.name,
    emoji: v.emoji || null,
    color: v.color || null,
    amount: v.amount,
    billing_cycle: v.billing_cycle,
    // One anchor per cycle, never both: a stale day number left over from a
    // previous monthly template would read as a second, contradictory
    // schedule.
    anchor_day: dated ? null : v.anchor_day ?? null,
    anchor_date: dated ? v.anchor_date || null : null,
    account_id: v.account_id || null,
    to_account_id: payment ? v.to_account_id || null : null,
    /* Income arrives rather than being spent, so it never counts against a
       category — the same rule manual income transactions follow. A payment
       may carry one: moving money to a car loan is still worth filing under
       Transport if the person wants it there, and quick-add has always let a
       payment be categorised. Optional there, optional here. */
    category_id: v.kind === "income" ? null : v.category_id || null,
    include_tax: v.include_tax,
    include_commission: v.include_commission,
    is_active: v.is_active,
  };
}

/**
 * Mirrors an ACTIVE income template's cycle onto profiles.pay_cycle — but
 * only when it is the user's SOLE active income template, so a second income
 * source never silently overrides the first's schedule. Deactivating or
 * deleting an income template never reverts a previous sync; this function
 * is only ever called from a successful create/update.
 *
 * Best-effort: reuses the existing setPayCycle action (Settings), and any
 * failure here is swallowed — a save the person already made must never fail
 * because a courtesy sync could not complete.
 */
async function syncPayCycleFromIncome(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: Pick<SubscriptionInput, "kind" | "is_active" | "billing_cycle" | "anchor_day">,
): Promise<void> {
  if (data.kind !== "income" || !data.is_active) return;
  const mapping = mapIncomeCycleToPayCycle(data.billing_cycle, data.anchor_day ?? null);
  if (!mapping) return;

  const { count } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("kind", "income")
    .eq("is_active", true);
  if (count !== 1) return;

  await setPayCycle({ cycle: mapping.payCycle, anchorDay: mapping.anchorDay });
}

export async function createSubscription(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const parsed = subscriptionInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  const { data, error } = await supabase
    .from("subscriptions")
    .insert({ ...toRow(parsed.data), currency: parsed.data.currency, user_id: user.id })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createSubscription") };
  await syncPayCycleFromIncome(supabase, parsed.data);
  return { id: data.id };
}

export async function updateSubscription(id: string, input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const parsed = subscriptionInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase
    .from("subscriptions")
    .update({ ...toRow(parsed.data), currency: parsed.data.currency })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateSubscription") };
  await syncPayCycleFromIncome(supabase, parsed.data);
  return { id };
}

export async function deleteSubscription(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteSubscription") };
  return {};
}

export async function setSubscriptionActive(id: string, active: boolean): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  const { error } = await supabase.from("subscriptions").update({ is_active: active }).eq("id", id);
  if (error) return { error: await dbError(error, "setSubscriptionActive") };
  return { id };
}

/**
 * Record one occurrence of a recurring payment: the transaction its template
 * describes, dated now and linked back through `subscription_id`.
 *
 * Two figures can only come from the person, never from the template, and each
 * is required exactly when currencies differ:
 *
 *   - `settledAmount`, what actually left the source account in ITS currency,
 *     when the template bills in another — see lib/subscriptions/charge. The
 *     client offers an estimate; this does not invent one, because writing the
 *     billed amount into a differently-denominated account is the bug that
 *     module fixed (a USD 15.99 sub took 15.99 pesos off a DOP card).
 *   - `toAmount`, a payment's destination leg, when the two accounts differ in
 *     currency. Same reason quick-add asks: 1:1 is never a safe assumption.
 */
export async function addCharge(
  id: string,
  { settledAmount, toAmount }: { settledAmount?: number; toAmount?: number } = {},
): Promise<Result> {
  const t = await getTranslations("Common");
  const ts = await getTranslations("Subscriptions");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { data: sub } = await supabase
    .from("subscriptions")
    .select(
      "*, account:accounts!subscriptions_account_id_fkey(currency,type), to_account:accounts!subscriptions_to_account_id_fkey(currency)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!sub) return { error: ts("notFound") };
  // The account supplies the currency, so a template without one has nowhere
  // to charge and no denomination to charge in.
  const accountCurrency = sub.account?.currency;
  if (!sub.account_id || !accountCurrency) return { error: ts("needsAccount") };

  const kind = sub.kind as RecurringKind;
  const payment = kind === "payment";
  const dstCurrency = payment ? sub.to_account?.currency : null;
  // The destination can be deleted out from under a template (on delete set null).
  if (payment && (!sub.to_account_id || !dstCurrency)) return { error: ts("needsToAccount") };

  const settled = settledCharge({
    subAmount: sub.amount,
    subCurrency: sub.currency,
    accountCurrency,
    settledAmount,
  });
  if ("needsSettledAmount" in settled)
    return { error: ts("needsSettledAmount", { currency: accountCurrency }) };

  const crossLeg = payment && dstCurrency !== accountCurrency;
  if (crossLeg && !(toAmount && toAmount > 0))
    return { error: ts("needsToAmount", { currency: dstCurrency! }) };

  /* The row is denominated in the account's currency, so the base rate comes
     from that — not from the template's. Converting the 965 pesos actually paid
     at market gives a base figure that includes the bank's spread. A payment
     that lands in the base currency uses the person's own rate instead, exactly
     as quick-add does (see resolveBaseRate). */
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .maybeSingle();
  const baseCurrency = baseCurrencyOf(profile);
  const rates = accountCurrency === baseCurrency ? {} : await getExchangeRates(baseCurrency);

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    type: kind,
    account_id: sub.account_id,
    to_account_id: payment ? sub.to_account_id : null,
    // Carried through from the template, so a categorised payment records as
    // one. Income never has a category to carry.
    category_id: kind === "income" ? null : sub.category_id,
    amount: settled.amount,
    // Null on a same-currency payment — the DB mirrors `amount`.
    to_amount: crossLeg ? toAmount! : null,
    currency: accountCurrency,
    exchange_rate: resolveBaseRate({
      currency: accountCurrency,
      baseCurrency,
      amount: settled.amount,
      toCurrency: dstCurrency,
      toAmount: crossLeg ? toAmount : null,
      rates,
    }),
    ...recordedFlags({
      kind,
      srcType: sub.account?.type,
      include_tax: sub.include_tax,
      include_commission: sub.include_commission,
    }),
    occurred_at: new Date().toISOString(),
    description: sub.name,
    subscription_id: sub.id,
  });
  if (error) return { error: await dbError(error, "addCharge") };
  return { id };
}
