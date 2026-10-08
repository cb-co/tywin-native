/**
 * One loader per screen. Each returns, in one response, everything its screen
 * renders, computed next to the database so the phone makes one round trip per
 * screen instead of one per query.
 *
 * Loaders take the screen's query parameters as strings and return plain JSON.
 * `null` means the thing the screen is about does not exist (a 404).
 */
import { getLocale, getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { getOverview } from "#/lib/overview/queries";
import { getReminders } from "#/lib/notifications/reminders";
import { getRecommendation } from "#/lib/overview/recommendation/queries";
import {
  getAccountsWithStatus,
  getAccountById,
  getCurrencies,
  getCardGroups,
  getBanks,
  getAccountsAttention,
  getCardStatements,
  getPendingTriageCounts,
  getCardGroupSiblings,
  getCardGroupLines,
  getCardSpendByCategory,
  getAccountFeeLines,
  getStatementLineCashback,
  getAccountCostOfCarry,
  getCardPaymentsInMonth,
  getAccountTransferCosts,
} from "#/lib/accounts/queries";
import { resolveEffectiveBonus, getWelcomeBonusSpend } from "#/lib/accounts/welcome-bonus";
import { getAccountTransactions, getQuickAddData } from "#/lib/transactions/queries";
import { getBudgetOverview, getBudgetGroupOverview } from "#/lib/budgets/queries";
import { getGoalsOverview, getGoalDetail } from "#/lib/goals/queries";
import { getInsights, getCostOfCarry, getLoanInterest } from "#/lib/insights/queries";
import { getNetWorthHistory } from "#/lib/insights/net-worth-history";
import { getSubscriptions } from "#/lib/subscriptions/queries";
import { getImportTriage } from "#/lib/statements/triage";
import { getMerchantRules } from "#/lib/rules/queries";
import { getPlanStatus } from "#/lib/plan";
import { hasCardAccent } from "@cigua/core/accounts/card-art";
import { spendTotal } from "@cigua/core/accounts/card-spend";
import { yearCashback, hasReportedCashback } from "@cigua/core/accounts/cashback";
import { summarizeCardFees } from "@cigua/core/accounts/card-fees";
import { hasTransferFees, type AccountType } from "@cigua/core/accounts/meta";
import { inferNetwork, inferLast4 } from "@cigua/core/accounts/network";
import { normalizeMonth, monthEnd, monthStart } from "@cigua/core/budgets/month";
import { buildDebtCost } from "@cigua/core/insights/debt-cost";
import { resumeStep } from "@cigua/core/onboarding/resume";
import { currentPeriod, payCycleOf, payAnchorOf } from "@cigua/core/period/profile";
import { localDate, isWholeMonth, type Period } from "@cigua/core/period/cycle";
import { baseCurrencyOf, profileAvatarUrl } from "@cigua/core/profile";

type Params = Record<string, string | undefined>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Who is signed in and how their profile is set up: the app's gate and chrome. */
async function session() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: profile },
    plan,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("display_name,base_currency,onboarded_at,pay_cycle,pay_anchor_day")
      .maybeSingle(),
    getPlanStatus(),
  ]);
  return {
    email: user?.email ?? "",
    avatarUrl: profileAvatarUrl(user?.user_metadata),
    displayName: profile?.display_name ?? null,
    baseCurrency: baseCurrencyOf(profile),
    onboarded: !!profile?.onboarded_at,
    payCycle: payCycleOf(profile),
    payAnchorDay: payAnchorOf(profile),
    /** Free or Cigua Pro, and each limit with its use: ads, upgrade prompts, Settings. */
    plan,
    /** How they sign in, so account deletion knows to revoke Sign in with Apple. */
    providers: (user?.app_metadata?.providers as string[] | undefined) ?? [],
  };
}

/** Accounts, categories and groups every transaction form offers. Shared by every screen that edits money. */
async function quickAdd() {
  return getQuickAddData();
}

async function overview() {
  const o = await getOverview();
  // Read after the empty-state check: a person with no accounts never sees the
  // card, so the query would be pure waste on the view where speed matters most.
  const recommendation = o.hasAccounts ? await getRecommendation(await getLocale()) : null;
  return { ...o, recommendation, today: localDate() };
}

async function accounts() {
  const supabase = await createClient();
  const [{ data: profile }, list, currencies, cardGroups, banks, attention] = await Promise.all([
    supabase.from("profiles").select("base_currency").maybeSingle(),
    getAccountsWithStatus(),
    getCurrencies(),
    getCardGroups(),
    getBanks(),
    getAccountsAttention(),
  ]);
  // Cards still waiting for their face colour. The app runs the backfill only
  // while this is non-zero, so it stays inert after the first successful pass.
  const pendingArt =
    list.filter((a) => a.type === "credit_card" && !a.card_group_id && !hasCardAccent(a.color)).length +
    cardGroups.filter((g) => !hasCardAccent(g.art_color)).length;
  return {
    baseCurrency: baseCurrencyOf(profile),
    accounts: list,
    currencies,
    cardGroups,
    banks,
    attention,
    pendingArt,
  };
}

async function account(params: Params) {
  const id = params.id ?? "";
  const [account, currencies, cardGroups, banks, activity, statements, triageCounts, siblings, cardLines] =
    await Promise.all([
      getAccountById(id),
      getCurrencies(),
      getCardGroups(),
      getBanks(),
      getAccountTransactions(id),
      getCardStatements(id),
      getPendingTriageCounts(id),
      getCardGroupSiblings(id),
      getCardGroupLines(id),
    ]);
  if (!account) return null;

  const t = await getTranslations("AccountDetail");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("base_currency").maybeSingle();
  const baseCurrency = baseCurrencyOf(profile);

  const type = account.type as AccountType;
  const isCardType = type === "credit_card";

  /* A card that belongs to a group takes the group's art and name: the group is
     the physical card, and its currency lines are what this screen can be one of. */
  const cardGroup = account.card_group_id
    ? (cardGroups.find((g) => g.id === account.card_group_id) ?? null)
    : null;
  const face = isCardType
    ? {
        name: cardGroup ? cardGroup.name : account.name,
        last4: inferLast4(account.name, account.last4),
        network: inferNetwork(cardGroup?.name ?? account.name, cardGroup?.brand ?? account.brand),
        accent: cardGroup ? cardGroup.art_color : account.color,
      }
    : null;

  const today = new Date().toISOString().slice(0, 10);
  const effectiveBonus = isCardType ? resolveEffectiveBonus(id, siblings) : null;
  const dueDatePassed = effectiveBonus ? effectiveBonus.welcome_bonus_due_date! < today : true;
  const showBonus = !!effectiveBonus && !dueDatePassed;
  const bonusSpent = showBonus
    ? await getWelcomeBonusSpend(
        supabase,
        siblings,
        effectiveBonus!.welcome_bonus_goal_currency!,
        effectiveBonus!.welcome_bonus_due_date!,
      )
    : 0;

  /* The card report and spend ledger: this calendar month's charges by category,
     this calendar year's fees and cashback, cost of carry off the newest statement,
     and what was paid into the card this month. Only issued for cards. */
  const spendMonth = monthStart();
  const feeYear = new Date().getFullYear();
  const cashbackStatementIds = statements
    .filter((s) => s.period_end.startsWith(`${feeYear}-`))
    .map((s) => s.id);
  const [spendSlices, feeLines, carry, paymentsThisMonth, lineCashback] = isCardType
    ? await Promise.all([
        getCardSpendByCategory(id, spendMonth, t("uncategorized")),
        getAccountFeeLines(id, feeYear),
        getAccountCostOfCarry(id),
        getCardPaymentsInMonth(id, spendMonth),
        getStatementLineCashback(cashbackStatementIds),
      ])
    : [[], [], null, 0, new Map<string, number>()];
  const cashbackReported = isCardType && hasReportedCashback(statements, feeYear, lineCashback);
  const transferPaid = hasTransferFees(type) ? await getAccountTransferCosts(id, feeYear) : null;

  return {
    account,
    currencies,
    banks,
    baseCurrency,
    cardGroupName: cardGroup?.name ?? null,
    face,
    cardLines,
    statements,
    triageCounts,
    activity,
    effectiveBonus,
    report: isCardType
      ? {
          year: feeYear,
          carry,
          cashback: cashbackReported ? yearCashback(statements, feeYear, lineCashback) : null,
          fees: summarizeCardFees(feeLines, feeYear),
          paymentsThisMonth,
          bonus: showBonus
            ? {
                spent: bonusSpent,
                goal: effectiveBonus!.welcome_bonus_goal_amount!,
                goalCurrency: effectiveBonus!.welcome_bonus_goal_currency!,
                dueDate: effectiveBonus!.welcome_bonus_due_date!,
              }
            : null,
        }
      : null,
    spend: isCardType ? { month: spendMonth, slices: spendSlices, total: spendTotal(spendSlices) } : null,
    transferPaid: transferPaid ? { year: feeYear, ...transferPaid } : null,
  };
}

async function budgets(params: Params) {
  const { month: monthParam, from, to } = params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("pay_cycle,pay_anchor_day")
    .maybeSingle();

  // Resolution order: an explicit from/to (the picker's pay-period side), then a
  // month (the picker's month side), then the profile's own current period.
  const hasRange = !!from && !!to && DATE_RE.test(from) && DATE_RE.test(to) && from <= to;
  const period: Period = hasRange
    ? { start: from!, end: to! }
    : monthParam
      ? { start: normalizeMonth(monthParam), end: monthEnd(normalizeMonth(monthParam)) }
      : currentPeriod(profile, localDate());
  // Which side of the picker is active. Not `payCycle === "monthly"`: an anchored
  // monthly profile's own period is not the calendar month.
  const mode: "month" | "native" = hasRange
    ? "native"
    : monthParam
      ? "month"
      : isWholeMonth(period)
        ? "month"
        : "native";

  const [overview, groupOverview, goals] = await Promise.all([
    getBudgetOverview(period),
    getBudgetGroupOverview(period),
    getGoalsOverview(),
  ]);
  return {
    overview,
    groupOverview,
    goals,
    mode,
    payCycle: payCycleOf(profile),
    payAnchor: payAnchorOf(profile),
    today: localDate(),
  };
}

async function goal(params: Params) {
  return getGoalDetail(params.id ?? "");
}

async function recurring() {
  return { subscriptions: await getSubscriptions() };
}

async function insights(params: Params) {
  const month = normalizeMonth(params.month);
  const [data, carry, netWorth, loanInterest] = await Promise.all([
    getInsights(month),
    getCostOfCarry(),
    getNetWorthHistory(),
    getLoanInterest(),
  ]);
  return { month, insights: data, netWorth, debtCost: buildDebtCost(carry, loanInterest) };
}

async function importTriage(params: Params) {
  return getImportTriage(params.id ?? "");
}

async function settings() {
  const [s, currencies] = await Promise.all([session(), getCurrencies()]);
  return { ...s, currencies };
}

async function rules() {
  return { rules: await getMerchantRules() };
}

/** Everything onboarding has already saved: both the resume point and the lists its steps show. */
async function welcome() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: profile },
    currencies,
    accountsRes,
    statementsRes,
    subsRes,
    categoriesRes,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("display_name, base_currency, onboarded_at, pay_cycle, pay_anchor_day")
      .maybeSingle(),
    getCurrencies(),
    supabase
      .from("accounts")
      .select("id,name,type,currency,last4,installment_amount,term_months")
      .eq("is_archived", false)
      .order("created_at"),
    supabase.from("card_statements").select("account_id"),
    supabase
      .from("subscriptions")
      .select("id,name,kind,amount,currency,billing_cycle")
      .eq("is_active", true)
      .in("kind", ["income", "expense"])
      .order("created_at"),
    supabase.from("categories").select("id,name"),
  ]);

  const accounts = accountsRes.data ?? [];
  const subs = subsRes.data ?? [];
  const imported = new Set((statementsRes.data ?? []).map((s) => s.account_id));
  const data = {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      last4: a.last4,
      installment: a.installment_amount,
      remaining: a.term_months,
      imported: imported.has(a.id),
    })),
    income: subs.find((s) => s.kind === "income") ?? null,
    bills: subs.filter((s) => s.kind === "expense"),
    categories: categoriesRes.data ?? [],
    payCycle: profile?.pay_cycle ?? "semimonthly",
    payAnchorDay: profile?.pay_anchor_day ?? null,
  };

  return {
    onboarded: !!profile?.onboarded_at,
    email: user?.email ?? "",
    currencies,
    initialName: profile?.display_name ?? "",
    initialCurrency: baseCurrencyOf(profile),
    initialStep: resumeStep({
      hasName: !!profile?.display_name?.trim(),
      hasMainAccount: data.accounts.some((a) => a.type !== "credit_card" && a.type !== "loan"),
    }),
    data,
  };
}

/** What the phone schedules payment reminders from. Read in the background
 *  by the app shell, never shown as a page. */
async function reminders() {
  return getReminders();
}

export const screens = {
  session,
  reminders,
  quickAdd,
  overview,
  accounts,
  account,
  budgets,
  goal,
  recurring,
  insights,
  importTriage,
  settings,
  rules,
  welcome,
} satisfies Record<string, (params: Params) => Promise<unknown>>;

export type Screens = typeof screens;
export type ScreenName = keyof Screens;
