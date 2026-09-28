import { useMemo } from "react";
import { useLocale, useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { formatDate, formatMoney } from "@cigua/core/format";
import { PlateChart, type ChartSeries } from "~/components/charts/plate-chart";
import { useMaskedFormatMoney } from "~/components/money/figure-mask";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

type Data = ScreenData<"insights">;

function Empty({ children }: { children: string }) {
  return (
    <Text size="sm" tone="muted" align="center" style={{ paddingVertical: 40 }}>
      {children}
    </Text>
  );
}

/**
 * Net worth at each month end. The axis fits the data (net worth can be
 * negative), and zero earns a rule only when the series crosses it.
 */
export function NetWorthChart({ data, currency }: { data: Data["netWorth"]["points"]; currency: string }) {
  const t = useTranslations("Insights");
  const c = useColors();
  const masked = useMaskedFormatMoney();
  const points = useMemo(() => data.map((d) => ({ label: d.label, values: { netWorth: d.netWorth } })), [data]);
  const series = useMemo<ChartSeries[]>(
    () => [{ key: "netWorth", name: t("seriesNetWorth"), kind: "area", color: c.chart[0], hatch: 1, dots: true, format: (v) => masked(v, currency) }],
    [t, c.chart, masked, currency],
  );
  if (data.length === 0 || data.every((d) => d.netWorth === 0)) return <Empty>{t("netWorthEmpty")}</Empty>;
  const crossesZero = data.some((d) => d.netWorth < 0) && data.some((d) => d.netWorth > 0);
  return (
    <PlateChart
      data={points}
      series={series}
      domain="auto"
      zeroLine={crossesZero}
      yFormat={(v) => masked(v, currency, { compact: true, maximumFractionDigits: 0 })}
      accessibilityLabel={t("cardNetWorth")}
    />
  );
}

/** Income and expense as hatched bars per month, with the net as a dotted line over them. */
export function CashflowChart({ data, currency }: { data: Data["insights"]["trend"]; currency: string }) {
  const t = useTranslations("Insights");
  const c = useColors();
  const masked = useMaskedFormatMoney();
  const points = useMemo(() => data.map((d) => ({ label: d.month, values: { income: d.income, expense: d.expense, net: d.net } })), [data]);
  const series = useMemo<ChartSeries[]>(
    () => [
      { key: "income", name: t("seriesIncome"), kind: "bar", color: c.chart[0], hatch: 1, format: (v) => masked(v, currency) },
      // Expense stays legible when figures are masked; income and net derive from it.
      { key: "expense", name: t("seriesExpense"), kind: "bar", color: c.chart[3], hatch: 4, format: (v) => formatMoney(v, currency) },
      { key: "net", name: t("seriesNet"), kind: "line", color: c.foreground, dots: true, format: (v) => masked(v, currency) },
    ],
    [t, c.chart, c.foreground, masked, currency],
  );
  if (data.length === 0) return <Empty>{t("cashflowEmpty")}</Empty>;
  return (
    <PlateChart
      data={points}
      series={series}
      legend
      axisWidth={44}
      yFormat={(v) => formatMoney(v, currency, { compact: true })}
      accessibilityLabel={t("cardCashFlow")}
    />
  );
}

/**
 * Cumulative spend through this period against the last one. The axis prints
 * the period's own dates, since a pay period rarely starts on the 1st.
 */
export function SpendingPace({ data, currency }: { data: Data["insights"]["pace"]; currency: string }) {
  const t = useTranslations("Insights");
  const locale = useLocale();
  const c = useColors();
  const points = useMemo(() => data.map((d) => ({ label: d.date, values: { lastMonth: d.lastMonth, thisMonth: d.thisMonth } })), [data]);
  const series = useMemo<ChartSeries[]>(
    () => [
      { key: "lastMonth", name: t("paceLastPeriod"), kind: "line", color: c.mutedForeground, strokeWidth: 1.5, dashed: true, format: (v) => formatMoney(v, currency) },
      { key: "thisMonth", name: t("paceThisPeriod"), kind: "line", color: c.chart[0], format: (v) => formatMoney(v, currency) },
    ],
    [t, c.mutedForeground, c.chart, currency],
  );
  const hasData = data.some((d) => (d.thisMonth ?? 0) > 0 || (d.lastMonth ?? 0) > 0);
  if (!hasData) return <Empty>{t("spendingPaceEmpty")}</Empty>;
  return (
    <PlateChart
      data={points}
      series={series}
      legend
      minTickGap={20}
      xFormat={(v) => formatDate(v, locale, { day: "numeric", month: "short" })}
      yFormat={(v) => formatMoney(v, currency, { compact: true })}
      accessibilityLabel={t("cardSpendingPace")}
    />
  );
}
