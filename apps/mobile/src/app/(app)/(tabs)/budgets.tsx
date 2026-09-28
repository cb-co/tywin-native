import { useCallback, useState } from "react";
import { View } from "react-native";
import { keepPreviousData } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { normalizeMonth } from "@cigua/core/budgets/month";
import type { Period } from "@cigua/core/period/cycle";
import { useScreen } from "~/lib/query";
import {
  PageHeader,
  PageHeaderSkeleton,
  Screen,
  ScreenError,
  SectionLegendSkeleton,
  Skeleton,
  SkeletonPage,
  useSettled,
} from "~/components/ui/screen";
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

  const settled = useSettled();

  if (!data && isError) return <ScreenError onRetry={() => void refetch()} />;
  if (!data || !settled) return <BudgetsSkeleton />;

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

/**
 * The page above, unprinted: the period stepper and copy button, the budget
 * note, the category lines, then goals under the double rule. The lines and
 * note match the blocks `BudgetGrid` shows while it steps between periods.
 */
function BudgetsSkeleton() {
  return (
    <SkeletonPage tab>
      <PageHeaderSkeleton title="40%" action={112} />
      <View style={{ gap: 24 }}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Skeleton height={32} width={32} />
            <Skeleton height={14} width={144} />
            <Skeleton height={32} width={32} />
          </View>
          <Skeleton height={32} width={144} />
        </View>
        <Skeleton height={176} style={{ borderRadius: 6 }} />
        <View style={{ gap: 16 }}>
          <SectionLegendSkeleton />
          <View style={{ gap: 1 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={96} style={{ borderRadius: 0 }} />
            ))}
          </View>
        </View>
      </View>
      <DoubleRule />
      <View style={{ gap: 16 }}>
        <SectionLegendSkeleton width={72} aside={<Skeleton height={32} width={112} />} />
        <Skeleton height={128} style={{ borderRadius: 4 }} />
        <Skeleton height={128} style={{ borderRadius: 4 }} />
      </View>
    </SkeletonPage>
  );
}
