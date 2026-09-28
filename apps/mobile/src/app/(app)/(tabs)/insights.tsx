import { useState } from "react";
import { View } from "react-native";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "~/components/ui/icons";
import { useLocale, useTranslations } from "use-intl";
import { addMonths, monthLabel } from "@cigua/core/budgets/month";
import { useScreen } from "~/lib/query";
import { Button } from "~/components/ui/button";
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
import { Text } from "~/components/ui/text";
import { SectionLegend } from "~/components/papel/ledger";
import { Plate } from "~/components/papel/plate";
import { FxDegradedNotice } from "~/components/fx/fx-degraded-notice";
import { CashflowChart, NetWorthChart, SpendingPace } from "~/components/insights/charts";
import { DebtCostList } from "~/components/insights/debt-cost";
import { DebtHealth } from "~/components/insights/debt-health";
import { SpendLedger } from "~/components/insights/spend-ledger";

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ gap: 16 }}>
      <SectionLegend aside={actions}>{title}</SectionLegend>
      <View style={{ gap: 24 }}>{children}</View>
    </View>
  );
}

/**
 * Four questions on three clocks, one band each: is my net worth moving (trend),
 * where did the picked month's money go and am I on pace (the month picker lives
 * in that band's legend, since only it obeys it), and what does my debt cost (now).
 */
export default function InsightsScreen() {
  const t = useTranslations("Insights");
  const locale = useLocale();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const { data, refetch, isError, isPlaceholderData } = useScreen("insights", month ? { month } : undefined, {
    placeholderData: keepPreviousData,
  });

  const settled = useSettled();

  if (!data && isError) return <ScreenError onRetry={() => void refetch()} />;
  if (!data || !settled) return <InsightsSkeleton />;

  const cur = data.insights.baseCurrency;
  const shown = data.month;
  // The month asked for, which runs ahead of `shown` while it loads.
  const current = month ?? shown;
  const monthNav = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Button variant="outline" size="icon-sm" icon={ChevronLeft} accessibilityLabel={t("prevMonthAria")} onPress={() => setMonth(addMonths(current, -1))} />
      <Text size="sm" weight={500} figure align="center" style={{ minWidth: 112 }} accessibilityLiveRegion="polite">
        {monthLabel(current, locale)}
      </Text>
      <Button variant="outline" size="icon-sm" icon={ChevronRight} accessibilityLabel={t("nextMonthAria")} onPress={() => setMonth(addMonths(current, 1))} />
    </View>
  );

  return (
    <Screen tab onRefresh={refetch}>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      {/* Page level: the same missing rates skew net worth and the debt subtotals. */}
      <FxDegradedNotice currencies={data.netWorth.fxUnconverted} base={cur} />

      <View style={{ gap: 40 }}>
        <Section title={t("sectionPosition")}>
          <Plate figLabel={t("fig", { n: 1 })} title={t("cardNetWorth")}>
            <NetWorthChart data={data.netWorth.points} currency={data.netWorth.baseCurrency} />
          </Plate>
          <Plate figLabel={t("fig", { n: 2 })} title={t("cardCashFlow")}>
            <CashflowChart data={data.insights.trend} currency={cur} />
          </Plate>
        </Section>

        <Section title={t("sectionThisMonth")} actions={monthNav}>
          {isPlaceholderData ? (
            <>
              <Skeleton height={300} style={{ borderRadius: 4 }} />
              <Skeleton height={300} style={{ borderRadius: 4 }} />
            </>
          ) : (
            <>
              <Plate figLabel={t("fig", { n: 3 })} title={t("cardSpendingPace")} basis={t("basisWhenCharged")}>
                <SpendingPace data={data.insights.pace} currency={cur} />
              </Plate>
              <Plate figLabel={t("fig", { n: 4 })} title={t("cardSpendDistribution")} basis={t("basisWhenCharged")}>
                <SpendLedger data={data.insights.distribution} total={data.insights.totalSpend} currency={cur} month={shown} scope={{ kind: "insights" }} />
              </Plate>
            </>
          )}
        </Section>

        <Section title={t("sectionDebt")}>
          <Plate figLabel={t("fig", { n: 5 })} title={t("cardDebtHealth")}>
            <DebtHealth utilization={data.insights.utilization} loans={data.insights.loans} />
          </Plate>
          <Plate figLabel={t("fig", { n: 6 })} title={t("debtCostTitle")}>
            <DebtCostList data={data.debtCost} />
          </Plate>
        </Section>
      </View>
    </Screen>
  );
}

/**
 * The three bands above, unprinted, with the month stepper in the second
 * band's legend where the real one sits, so nothing moves when the plates land.
 * Each plate is the same block the month band shows while it steps.
 */
function InsightsSkeleton() {
  const plate = <Skeleton height={300} style={{ borderRadius: 4 }} />;
  const stepper = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Skeleton height={32} width={32} />
      <Skeleton height={14} width={112} />
      <Skeleton height={32} width={32} />
    </View>
  );
  return (
    <SkeletonPage tab>
      <PageHeaderSkeleton title="40%" />
      <View style={{ gap: 40 }}>
        {[undefined, stepper, undefined].map((aside, i) => (
          <View key={i} style={{ gap: 16 }}>
            <SectionLegendSkeleton width={96} aside={aside} />
            <View style={{ gap: 24 }}>
              {plate}
              {plate}
            </View>
          </View>
        ))}
      </View>
    </SkeletonPage>
  );
}
