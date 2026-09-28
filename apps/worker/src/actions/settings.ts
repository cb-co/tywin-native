import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { dbError } from "#/lib/errors";
import { PAY_CYCLE_VALUES, SEMIMONTHLY_MAX_ANCHOR, type PayCycle } from "@cigua/core/period/cycle";

export async function updateBaseCurrency(code: string): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const ts = await getTranslations("Settings");
  if (!/^[A-Z]{3}$/.test(code)) return { error: ts("invalidCurrency") };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase
    .from("profiles")
    .update({ base_currency: code })
    .eq("id", user.id);
  if (error) return { error: await dbError(error, "updateBaseCurrency") };
  return {};
}

/** Max characters for a display name. Long enough for a full name, short
 *  enough that the sidebar row and the overview greeting never wrap. */
const DISPLAY_NAME_MAX = 40;

export async function deleteAccount(): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  // Cascades through every user-owned table — see the migration for detail.
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { error: await dbError(error, "deleteAccount") };

  await supabase.auth.signOut();
  return {};
}

export async function updateDisplayName(name: string): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const ts = await getTranslations("Settings");

  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length > DISPLAY_NAME_MAX) {
    return { error: ts("displayNameTooLong", { max: DISPLAY_NAME_MAX }) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  // Clearing the field falls back to the email-derived label everywhere.
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: trimmed || null })
    .eq("id", user.id);
  if (error) return { error: await dbError(error, "updateDisplayName") };
  return {};
}

/** The valid anchor range per cycle. Semimonthly's is its first payday; the
 *  second is 15 days later, so it stops at 15. */
const ANCHOR_RANGE: Record<PayCycle, [number, number]> = {
  monthly: [1, 31],
  weekly: [1, 7],
  semimonthly: [1, SEMIMONTHLY_MAX_ANCHOR],
};

export async function setPayCycle(input: {
  cycle: string;
  anchorDay: number | null;
}): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const ts = await getTranslations("Settings");

  // Validated against the enum rather than trusted: this string arrives from
  // a form and goes into a typed column.
  if (!(PAY_CYCLE_VALUES as readonly string[]).includes(input.cycle)) {
    return { error: ts("invalidPayCycle") };
  }
  const cycle = input.cycle as PayCycle;
  const range = ANCHOR_RANGE[cycle];

  // Out-of-range falls back to the cycle's first day rather than reaching
  // profiles_pay_anchor_day_valid and failing the write.
  const anchorDay =
    input.anchorDay != null && input.anchorDay >= range[0] && input.anchorDay <= range[1]
      ? input.anchorDay
      : range[0];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  // Scoped to the caller's own row; RLS is the backstop, not the check.
  const { error } = await supabase
    .from("profiles")
    .update({ pay_cycle: cycle, pay_anchor_day: anchorDay })
    .eq("id", user.id);
  if (error) return { error: await dbError(error, "setPayCycle") };

  // Every period-scoped surface re-reads the cycle.
  return {};
}
