import { StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { formatDate, formatMoney, formatPercent } from "@cigua/core/format";
import { Card } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

type Report = NonNullable<ScreenData<"account">["report"]>;

function Row({ label, detail, amount }: { label: string; detail?: string; amount: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flexShrink: 1 }}>
        <Text size="sm">{label}</Text>
        {detail ? (
          <Text size="xs" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      <Text size="sm" figure>
        {amount}
      </Text>
    </View>
  );
}

/**
 * The card's standing facts: what financing costs, the interest it billed, what
 * it paid back, what it charges to hold, what went into it this month, and the
 * welcome bonus still in play. Each row shows only with real data; costs and
 * cashback are never netted. Negative fee subtotals print as "refunded".
 */
export function CardReport({ currency, report }: { currency: string; report: Report }) {
  const t = useTranslations("AccountDetail");
  const locale = useLocale();
  const c = useColors();
  const { carry, cashback, fees, paymentsThisMonth, bonus } = report;
  // A string, not the number: ICU would print "2,026".
  const y = String(report.year);
  const money = (n: number) => formatMoney(Math.abs(n), currency);

  const rows: React.ReactNode[] = [];
  if (carry) {
    rows.push(
      <Row
        key="carry"
        label={t("cardReportCarry")}
        detail={[
          carry.apr !== null ? t("cardReportCarryApr", { rate: carry.apr }) : null,
          t("cardReportCarryDetail", { date: formatDate(carry.periodEnd, locale) }),
        ]
          .filter(Boolean)
          .join(" · ")}
        amount={formatMoney(carry.costOfCarry, currency)}
      />,
    );
  }
  if (fees.interest !== 0) {
    rows.push(
      <Row key="interest" label={t(fees.interest < 0 ? "cardReportInterestRefunded" : "cardReportInterest", { year: y })} amount={money(fees.interest)} />,
    );
  }
  if (cashback !== null) rows.push(<Row key="cashback" label={t("cardReportCashback", { year: y })} amount={money(cashback)} />);
  if (fees.recurring !== 0) {
    rows.push(
      <Row key="ownership" label={t(fees.recurring < 0 ? "cardReportOwnershipRefunded" : "cardReportOwnership", { year: y })} amount={money(fees.recurring)} />,
    );
  }
  if (fees.incidents !== 0) {
    rows.push(
      <Row key="incidents" label={t(fees.incidents < 0 ? "cardReportIncidentsRefunded" : "cardReportIncidents", { year: y })} amount={money(fees.incidents)} />,
    );
  }
  if (paymentsThisMonth !== 0) rows.push(<Row key="payments" label={t("cardReportPayments")} amount={money(paymentsThisMonth)} />);

  const bonusPct = bonus ? (bonus.spent / bonus.goal) * 100 : 0;

  return (
    <Card style={{ padding: 24 }}>
      <Text size="lg" weight={500} accessibilityRole="header" style={{ marginBottom: 16 }}>
        {t("cardReportTitle")}
      </Text>
      {rows.length === 0 && !bonus ? (
        <Text size="sm" tone="muted">
          {t("cardReportEmpty")}
        </Text>
      ) : (
        <View style={{ gap: 12 }}>
          {rows}
          {bonus ? (
            <View
              style={[
                { gap: 8 },
                rows.length > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 12 } : null,
              ]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text size="sm" style={{ flexShrink: 1 }}>
                  {t("welcomeBonusProgress")}
                </Text>
                <Text size="sm" figure>
                  {formatPercent(bonusPct)}
                </Text>
              </View>
              <Progress value={bonusPct} label={t("welcomeBonusProgress")} />
              <Text size="xs" tone="muted">
                {t("welcomeBonusDetail", {
                  spent: formatMoney(bonus.spent, bonus.goalCurrency),
                  goal: formatMoney(bonus.goal, bonus.goalCurrency),
                  date: formatDate(bonus.dueDate, locale),
                })}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}
