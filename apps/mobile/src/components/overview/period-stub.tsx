import { View } from "react-native";
import { ArrowDownLeft, ArrowUpRight, PieChart } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { formatPercent } from "@cigua/core/format";
import { Card } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { LedgerRow } from "~/components/papel/ledger";
import { RuleMeter } from "~/components/papel/rule-meter";
import { ProofMark } from "~/components/papel/proof-mark";
import { MoneyDisplay } from "~/components/money/money-display";
import { useColors } from "~/theme/theme";

/** The stub torn from the Disponible note: the period's three figures as one ruled table. */
export function PeriodStub({
  income,
  spending,
  used,
  budget,
  currency,
}: {
  income: number;
  spending: number;
  used: number;
  budget: number;
  currency: string;
}) {
  const t = useTranslations("Overview");
  const c = useColors();
  const over = budget > 0 && used > budget;
  // The true percent prints; the meter clamps its own fill.
  const pct = budget > 0 ? Math.max((used / budget) * 100, 0) : 0;
  const glyph = { size: 16, color: c.mutedForeground };

  return (
    <View>
      <View style={{ marginHorizontal: 8, borderTopWidth: 2, borderStyle: "dashed", borderColor: c.inkSoft }} />
      <Card flush style={{ borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        <Text legend tone="muted" style={{ fontSize: 11, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          {t("thisPeriod")}
        </Text>
        <LedgerRow
          lead={<ArrowDownLeft {...glyph} />}
          title={t("incomeThisPeriod")}
          amount={<MoneyDisplay amount={income} currency={currency} size="inline" animate />}
        />
        <LedgerRow
          lead={<ArrowUpRight {...glyph} />}
          title={t("spendingThisPeriod")}
          amount={<MoneyDisplay amount={spending} currency={currency} size="inline" animate />}
        />
        <LedgerRow
          rule={false}
          style={{ paddingBottom: 8 }}
          lead={<PieChart {...glyph} />}
          title={t("budgetUsed")}
          amount={
            <>
              <MoneyDisplay amount={used} currency={currency} size="inline" animate />
              <Text size="xs" tone="muted" figure align="right">
                {budget > 0 ? formatPercent(pct) : "—"}
              </Text>
            </>
          }
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 6 }}>
          <RuleMeter used={used} total={budget} label={t("budgetUsed")} overLabel={t("budgetOverLabel")} pct={pct} />
          {over ? <ProofMark tone="flag">{t("budgetOverBy", { pct: formatPercent(pct) })}</ProofMark> : null}
        </View>
      </Card>
    </View>
  );
}
