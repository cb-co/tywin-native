import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { dbError } from "#/lib/errors";
import { PAY_CYCLE_VALUES, SEMIMONTHLY_MAX_ANCHOR, type PayCycle } from "@cigua/core/period/cycle";
import { revokeAppleAuthorization } from "#/lib/apple";
import { createRateLimiter } from "#/lib/rate-limit";
import type { Database } from "@cigua/core/supabase/types";

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

/**
 * Deletes the caller and everything they own.
 *
 * Someone who signs in with Apple sends a fresh authorization code, which the
 * app asks Apple for right before this call; the grant is revoked with it
 * before the account goes (App Store guideline 5.1.1(v)). Revocation is best
 * effort: a failure is logged and the deletion still happens.
 */
export async function deleteAccount(input?: { appleAuthorizationCode?: unknown }): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const code = input?.appleAuthorizationCode;
  if (typeof code === "string" && code.length > 0 && code.length < 2048) {
    await revokeAppleAuthorization(code);
  }

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

/** Everything a person owns, table by table: what "export your data" hands back. */
const EXPORT_TABLES = [
  "profiles",
  "banks",
  "card_groups",
  "accounts",
  "categories",
  "budget_groups",
  "category_budgets",
  "budget_group_budgets",
  "transactions",
  "subscriptions",
  "savings_goals",
  "goal_contributions",
  "statement_imports",
  "card_statements",
  "card_statement_lines",
  "category_rules",
  "daily_recommendations",
  "entitlements",
  "usage_counters",
] as const satisfies readonly (keyof Database["public"]["Tables"])[];

/** The Data API returns at most this many rows per request (supabase/config.toml max_rows). */
const PAGE = 1000;

/** A full export reads every row a person has; a few a minute is plenty. */
const exportLimiter = createRateLimiter({ max: 3, windowMs: 10 * 60_000 });

export type DataExport = {
  format: "cigua-export";
  version: 1;
  exportedAt: string;
  account: { id: string; email: string | null };
  tables: Record<(typeof EXPORT_TABLES)[number], unknown[]>;
};

/**
 * A copy of everything the caller has stored, as JSON: the portability right
 * the Privacy Policy promises (Ley 172-13) and the export the Terms mention.
 * Read under RLS like everything else, so it can only ever contain their rows.
 */
export async function exportData(): Promise<{ error?: string; data?: DataExport }> {
  const t = await getTranslations("Common");
  const ts = await getTranslations("Settings");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };
  if (!exportLimiter.take(user.id, Date.now())) return { error: ts("exportRateLimited") };

  const tables = {} as DataExport["tables"];
  for (const table of EXPORT_TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(from, from + PAGE - 1);
      if (error) return { error: await dbError(error, `exportData:${table}`) };
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    tables[table] = rows;
  }

  return {
    data: {
      format: "cigua-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email ?? null },
      tables,
    },
  };
}
