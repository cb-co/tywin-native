import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {
  QueryClient,
  QueryClientProvider,
  dehydrate,
  focusManager,
  hydrate,
  onlineManager,
  useQuery,
  type DehydratedState,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type { ScreenData, ScreenName } from "@cigua/worker/api";
import { ApiError, loadScreen, callAction, type ActionName, type ActionResult } from "./api";
import { plainMessage } from "./i18n";
import type { ActionModule, Actions } from "@cigua/worker/api";
import { prefs } from "./storage";

/**
 * Every screen's data is cached on the device and shown immediately on the next
 * visit (and the next launch), then refreshed in the background. A write refreshes
 * exactly the screens it changes (see `AFFECTS`), the same set the web re-renders.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Fresh for a moment: switching tabs back and forth shows the saved copy
      // without refetching; anything older refetches on focus behind the saved copy.
      staleTime: 30_000,
      // Saved screens survive a restart for a week.
      gcTime: 7 * 24 * 60 * 60 * 1000,
      networkMode: "offlineFirst",
      retry: (count, error) => {
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 404 || status === 400) return false;
        return count < 2;
      },
    },
    mutations: { networkMode: "online" },
  },
});

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
);

AppState.addEventListener("change", (state) => {
  if (Platform.OS !== "web") focusManager.setFocused(state === "active");
});

/* ---------------------------------------------------------------- keys ---- */

export const keys = {
  screen: (name: ScreenName, params?: Record<string, unknown>) =>
    params ? (["screen", name, params] as const) : (["screen", name] as const),
  transactions: (filters?: unknown) => (filters ? (["transactions", filters] as const) : (["transactions"] as const)),
};

/** A screen's data, cached and persisted. */
export function useScreen<K extends ScreenName>(
  name: K,
  params?: Record<string, string | undefined>,
  options?: Omit<UseQueryOptions<ScreenData<K>, Error, ScreenData<K>, QueryKey>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: keys.screen(name, params),
    queryFn: ({ signal }) => loadScreen(name, params, signal),
    ...options,
  });
}

/* ---------------------------------------------------------- invalidation -- */

type Screen = ScreenName | "transactions";

/**
 * Which screens each write changes. The same set of pages the web app
 * revalidates for the same action; `null` means "everything" (a change to the
 * profile, which every screen reads).
 */
const AFFECTS: Partial<Record<string, Screen[] | null>> = {
  "recommendation.refreshRecommendation": ["overview"],
  "transactions.createTransaction": ["overview", "accounts", "account", "transactions"],
  "transactions.updateTransaction": ["overview", "accounts", "account", "transactions", "insights", "budgets"],
  "transactions.deleteTransaction": ["overview", "accounts", "account", "transactions", "insights", "budgets"],
  "settings.updateBaseCurrency": null,
  "settings.updateDisplayName": null,
  "settings.setPayCycle": null,
  "rules.updateRule": ["rules"],
  "rules.deleteRule": ["rules"],
  "recurring.createSubscription": ["overview", "recurring"],
  "recurring.updateSubscription": ["overview", "recurring"],
  "recurring.resolveSubscriptionBrand": ["overview", "recurring"],
  "recurring.deleteSubscription": ["overview", "recurring"],
  "recurring.setSubscriptionActive": ["overview", "recurring"],
  "recurring.addCharge": ["overview", "accounts", "account", "recurring", "transactions"],
  "imports.categorizeTriageGroup": ["overview", "budgets", "insights", "transactions", "importTriage", "account", "rules"],
  "budgets.setBudget": ["overview", "budgets"],
  "budgets.createCategory": ["budgets", "quickAdd"],
  "budgets.updateCategory": ["overview", "budgets", "quickAdd", "transactions"],
  "budgets.deleteCategory": ["overview", "budgets", "quickAdd", "transactions"],
  "budgets.copyPreviousMonth": ["budgets"],
  "budgetGroups.createBudgetGroup": ["overview", "budgets", "quickAdd"],
  "budgetGroups.updateBudgetGroup": ["overview", "budgets", "quickAdd"],
  "budgetGroups.deleteBudgetGroup": ["overview", "budgets", "quickAdd"],
  "budgetGroups.setGroupBudget": ["overview", "budgets"],
  "budgetGroups.setCategoryGroup": ["overview", "budgets", "quickAdd"],
  "goals.createGoal": ["accounts", "account", "budgets", "goal", "insights"],
  "goals.updateGoal": ["accounts", "account", "budgets", "goal", "insights"],
  "goals.deleteGoal": ["accounts", "account", "budgets", "goal", "insights"],
  "goals.deleteContribution": ["accounts", "account", "budgets", "goal", "insights"],
  "goals.addContribution": ["accounts", "account", "budgets", "goal", "insights"],
  "accounts.createAccount": ["overview", "accounts", "quickAdd"],
  "accounts.updateAccount": ["overview", "accounts", "account", "quickAdd"],
  "accounts.backfillCardArt": ["overview", "accounts", "account"],
  "accounts.archiveAccount": ["overview", "accounts", "account", "quickAdd"],
  "accounts.deleteAccount": ["overview", "accounts", "account", "quickAdd", "transactions"],
  "accounts.createBank": ["accounts"],
  "accounts.createCardWithLines": ["overview", "accounts", "quickAdd"],
  "accounts.createCardStub": ["overview", "accounts", "quickAdd"],
  "accounts.addCardLine": ["overview", "accounts", "account", "quickAdd"],
  "statements.deleteCardStatement": ["overview", "accounts", "account", "budgets", "insights", "transactions"],
  "statements.saveMerchantRule": ["rules"],
  "onboarding.finishOnboarding": null,
};

/** Refreshes what a write changed. Called after every successful action. */
export async function invalidateAfter(action: string): Promise<void> {
  const screens = AFFECTS[action];
  if (screens === undefined) return;
  if (screens === null) {
    await queryClient.invalidateQueries();
    return;
  }
  await Promise.all(
    screens.map((s) =>
      queryClient.invalidateQueries({ queryKey: s === "transactions" ? ["transactions"] : ["screen", s] }),
    ),
  );
}

/** A statement import touches nearly everything; the confirm step calls this. */
export async function invalidateAfterImport(): Promise<void> {
  await Promise.all(
    (["overview", "accounts", "account", "budgets", "insights", "quickAdd"] as const).map((s) =>
      queryClient.invalidateQueries({ queryKey: ["screen", s] }),
    ),
  );
  await queryClient.invalidateQueries({ queryKey: ["transactions"] });
}

/**
 * Runs a server action and refreshes the screens it changed. The result is the
 * action's own (`{ error }` on a handled failure), so callers read it exactly as
 * the web's forms do. It never throws: no connection, or a server that failed,
 * comes back as an `{ error }` the caller already knows how to show.
 */
export async function act<M extends ActionModule, F extends ActionName<M>>(
  module: M,
  fn: F,
  ...args: Parameters<Extract<Actions[M][F], (...a: never[]) => unknown>>
): Promise<ActionResult<M, F>> {
  let result: ActionResult<M, F>;
  try {
    result = await callAction(module, fn, ...(args as never));
  } catch (e) {
    const error = e instanceof ApiError ? plainMessage("Common", "errorGeneric") : plainMessage("App", "needsConnection");
    return { error } as ActionResult<M, F>;
  }
  const failed = !!result && typeof result === "object" && "error" in result && !!(result as { error?: unknown }).error;
  if (!failed) void invalidateAfter(`${module}.${fn}`);
  return result;
}

/* ------------------------------------------------------------ persistence - */

const CACHE_VERSION = 1;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
let persistKey: string | null = null;
let unsubscribe: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function save() {
  timer = null;
  if (!persistKey) return;
  const state = dehydrate(queryClient, {
    // Only screens are worth saving; the ledger's pages are cheap to refetch.
    shouldDehydrateQuery: (q) => q.state.status === "success" && q.queryKey[0] === "screen",
  });
  prefs.set(persistKey, JSON.stringify({ savedAt: Date.now(), state }));
}

/**
 * Points the saved screens at this person, or at nobody on sign-out.
 *
 * Saved screens are per person, keyed by user id and a cache version, so another
 * account never sees someone else's figures and a release that changes a screen's
 * shape starts from empty instead of crashing on an old one. Sign-out deletes them.
 */
export function useCacheOwner(userId: string | null): void {
  useEffect(() => {
    const next = userId ? `cigua:screens:v${CACHE_VERSION}:${userId}` : null;
    if (next === persistKey) return;

    unsubscribe?.();
    unsubscribe = null;
    if (timer) clearTimeout(timer);
    if (persistKey && !next) prefs.remove(persistKey);
    queryClient.clear();
    persistKey = next;
    if (!next) return;

    const raw = prefs.get(next);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { savedAt: number; state: DehydratedState };
        if (Date.now() - saved.savedAt < MAX_AGE) hydrate(queryClient, saved.state);
      } catch {
        prefs.remove(next);
      }
    }
    unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || timer) return;
      timer = setTimeout(save, 1000);
    });
  }, [userId]);
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
