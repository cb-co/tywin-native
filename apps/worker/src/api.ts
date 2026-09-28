/**
 * The API's callable surface, and the types the app builds its client from.
 *
 * Every exported function of these modules is an endpoint:
 * `POST /v1/actions/<module>/<function>` with `{ "args": [...] }`. Each one checks
 * the caller itself and runs under their row-level security, so exposing a
 * function here is exactly as safe as the function.
 */
import * as accounts from "#/actions/accounts";
import * as statements from "#/actions/statements";
import * as budgets from "#/actions/budgets";
import * as budgetGroups from "#/actions/budget-groups";
import * as goals from "#/actions/goals";
import * as imports from "#/actions/imports";
import * as insights from "#/actions/insights";
import * as onboarding from "#/actions/onboarding";
import * as recommendation from "#/actions/recommendation";
import * as recurring from "#/actions/recurring";
import * as rules from "#/actions/rules";
import * as settings from "#/actions/settings";
import * as transactions from "#/actions/transactions";

export const actions = {
  accounts,
  statements,
  budgets,
  budgetGroups,
  goals,
  imports,
  insights,
  onboarding,
  recommendation,
  recurring,
  rules,
  settings,
  transactions,
};

export type Actions = typeof actions;
export type ActionModule = keyof Actions;

export type { Screens, ScreenName } from "#/screens";

/** A screen's payload, as the app receives it. */
export type ScreenData<K extends import("#/screens").ScreenName> = NonNullable<
  Awaited<ReturnType<import("#/screens").Screens[K]>>
>;

export type { StatementPreviewResult } from "#/actions/statements";
export type { TransactionWithRefs, TransactionPage, TxnCursor, TxnFilters, QuickAddData } from "#/lib/transactions/queries";
export type {
  AccountWithStatus,
  CurrencyRow,
  BankRow,
  CardGroupRow,
  CardGroupSibling,
  CardStatementRow,
} from "#/lib/accounts/queries";
export type { AttentionItem } from "#/lib/accounts/attention";
export type { GoalCardRow, GoalsOverview, ContributableAccount } from "#/lib/goals/queries";
export type { Pace } from "#/lib/goals/pace";
export type { SubscriptionWithRefs } from "#/lib/subscriptions/queries";
