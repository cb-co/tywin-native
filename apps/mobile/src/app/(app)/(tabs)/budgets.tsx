import { useCallback, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { normalizeMonth } from "@cigua/core/budgets/month";
import type { Period } from "@cigua/core/period/cycle";
import { useScreen } from "~/lib/query";
import { PageHeader, Screen, ScreenError, ScreenSkeleton } from "~/components/ui/screen";
import { DoubleRule } from "~/components/papel/ledger";
import { AddBudgetControl } from "~/components/budgets/add-budget-control";
import { BudgetGrid } from "~/components/budgets/budget-grid";
import { GroupGrid } from "~/components/budgets/group-grid";
import type { PeriodMode } from "~/components/budgets/period-picker";
import { GoalGrid } from "~/components/goals/goal-grid";

/**
 * Budgets answer to a period and goals are cumulative, so a double rule
 * separates the two clocks. With no period chosen the server resolves the
 * profile's own current one.
 */
export default function BudgetsScreen() {
  const t = useTranslations("Budgets");
  const [params, setParams] = useState<Record<string, string> | undefined>(undefined);
  const { data, refetch, isError, isPlaceholderData } = useScreen("budgets", params, { placeholderData: keepPreviousData });

  const navigate = useCallback((next: Period, mode: PeriodMode) => {
    setParams(mode === "month" ? { month: normalizeMonth(next.start) } : { from: next.start, to: next.end });
  }, []);

  if (!data) return isError ? <ScreenError onRetry={() => void refetch()} /> : <ScreenSkeleton tab />;

  return (
    <Screen tab onRefresh={refetch}>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} actions={<AddBudgetControl groups={data.groupOverview.rows} />} />
      <BudgetGrid
        overview={data.overview}
        mode={data.mode}
        payCycle={data.payCycle}
        payAnchor={data.payAnchor}
        groups={data.groupOverview.rows}
        groupBand={isPlaceholderData ? null : <GroupGrid overview={data.groupOverview} payCycle={data.payCycle} />}
        navPending={isPlaceholderData}
        onNavigate={navigate}
      />
      <DoubleRule />
      <GoalGrid overview={data.goals} />
    </Screen>
  );
}
