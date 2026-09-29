import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { periodSerial } from "@cigua/core/overview/period-serial";
import { formatMoney } from "@cigua/core/format";
import { Note } from "~/components/papel/note";
import { fitFigureSize } from "~/components/papel/fit";
import { MoneyDisplay } from "~/components/money/money-display";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

/**
 * The period's budget total on the screen's one peso note, with used and
 * remaining as ruled lines under it. Overspend is the minus sign, never a red
 * figure: red on peso fails contrast.
 */
export function BudgetNote({
  totalBudget,
  totalUsed,
  currency,
  periodStart,
}: {
  totalBudget: number;
  totalUsed: number;
  currency: string;
  periodStart: string;
}) {
  const t = useTranslations("Budgets");
  const tm = useTranslations("Papel");
  const c = useColors();
  const ink = c.pesoInk;
  const remaining = totalBudget - totalUsed;
  return (
    <Note tone="peso" label={t("budgetLabel")} serial={periodSerial(periodStart)} microprint={tm("microprint")}>
      <MoneyDisplay
        amount={totalBudget}
        currency={currency}
        size="hero"
        fontSize={fitFigureSize(formatMoney(totalBudget, currency))}
        width="expanded"
        weight={800}
        color={ink}
        centsOpacity={0.9}
        adjustsFontSizeToFit
      />
      <View style={{ marginTop: 20, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.pesoLine, paddingTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <Text size="sm" color={ink} style={{ opacity: 0.9, flexShrink: 1 }}>
            {t("usedLabel")}
          </Text>
          <MoneyDisplay amount={totalUsed} currency={currency} size="inline" color={ink} centsOpacity={0.9} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <Text size="sm" weight={600} color={ink} style={{ flexShrink: 1 }}>
            {t("remainingLabel")}
          </Text>
          <MoneyDisplay amount={remaining} currency={currency} size="inline" color={ink} centsOpacity={0.9} />
        </View>
      </View>
    </Note>
  );
}
