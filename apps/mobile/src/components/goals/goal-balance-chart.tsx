import { useMemo } from "react";
import { useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { PlateChart, type ChartSeries } from "~/components/charts/plate-chart";
import { useMaskedFormatMoney } from "~/components/money/figure-mask";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

type GoalPoint = NonNullable<ScreenData<"goal">>["history"][number];

/**
 * The goal's month-end balance, dotted per month. The axis fits the data rather
 * than pinning zero (a withdrawal can drive a goal negative), and zero earns a
 * rule only when the series crosses it.
 */
export function GoalBalanceChart({ data, currency }: { data: GoalPoint[]; currency: string }) {
  const t = useTranslations("GoalDetail");
  const c = useColors();
  const maskedFormat = useMaskedFormatMoney();
  const points = useMemo(() => data.map((d) => ({ label: d.label, values: { balance: d.balance } })), [data]);
  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: "balance",
        name: t("seriesBalance"),
        kind: "area",
        color: c.chart[0],
        hatch: 1,
        dots: true,
        strokeWidth: 2,
        format: (v) => maskedFormat(v, currency),
      },
    ],
    [c.chart, currency, maskedFormat, t],
  );

  if (data.length === 0 || data.every((d) => d.balance === 0)) {
    return (
      <Text size="sm" tone="muted" align="center" style={{ paddingVertical: 40 }}>
        {t("historyEmpty")}
      </Text>
    );
  }
  const crossesZero = data.some((d) => d.balance < 0) && data.some((d) => d.balance > 0);
  return (
    <PlateChart
      data={points}
      series={series}
      domain="auto"
      zeroLine={crossesZero}
      yFormat={(v) => maskedFormat(v, currency, { compact: true })}
      accessibilityLabel={t("balanceOverTime")}
    />
  );
}
