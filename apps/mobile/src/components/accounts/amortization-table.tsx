import { memo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Check } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { buildSchedule } from "@cigua/core/accounts/amortization";
import { formatMoney } from "@cigua/core/format";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { makeStyles, useColors } from "~/theme/theme";

/** Rows drawn before "show all": everything paid, plus the next year of payments. */
const AHEAD = 12;

const COLS = [40, 104, 96, 104, 112] as const;

/**
 * The loan's schedule from where tracking started: payment, interest, principal
 * and balance per installment, paid ones ticked and dimmed. A long schedule opens
 * at the paid rows and the year ahead; the rest is one tap away.
 */
export const AmortizationTable = memo(function AmortizationTable({
  principal,
  annualRate,
  termMonths,
  installment,
  currency,
  installmentsPaid,
}: {
  principal: number;
  annualRate: number;
  termMonths: number;
  installment: number | null;
  currency: string;
  installmentsPaid: number;
}) {
  const t = useTranslations("AccountDetail");
  const tApp = useTranslations("App");
  const s = useStyles();
  const c = useColors();
  const [all, setAll] = useState(false);
  const rows = buildSchedule({ principal, annualRate, termMonths, installment });
  if (rows.length === 0) {
    return (
      <Text size="sm" tone="muted">
        {t("addPrincipalRateTerm")}
      </Text>
    );
  }
  const limit = installmentsPaid + AHEAD;
  const shown = all || rows.length <= limit + 6 ? rows : rows.slice(0, limit);
  const heads = [t("columnNumber"), t("columnPayment"), t("columnInterest"), t("columnPrincipal"), t("columnBalance")];

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
        <View style={{ flex: 1 }}>
          <View style={[s.row, s.head]}>
            {heads.map((h, i) => (
              <Text key={h} legend size="2xs" tone="muted" style={[{ width: COLS[i], fontSize: 11 }, i === 4 ? s.right : null]}>
                {h}
              </Text>
            ))}
          </View>
          {shown.map((row) => {
            const paid = row.n <= installmentsPaid;
            const tone = paid ? "muted" : "default";
            return (
              <View key={row.n} style={[s.row, s.line]}>
                <View style={{ width: COLS[0], flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {paid ? <Check size={12} color={c.success} /> : null}
                  <Text size="sm" figure tone={tone}>
                    {row.n}
                  </Text>
                </View>
                <Text size="sm" figure tone={tone} style={{ width: COLS[1] }}>
                  {formatMoney(row.payment, currency)}
                </Text>
                <Text size="sm" figure tone={tone} style={{ width: COLS[2] }}>
                  {formatMoney(row.interest, currency)}
                </Text>
                <Text size="sm" figure tone={tone} style={{ width: COLS[3] }}>
                  {formatMoney(row.principal, currency)}
                </Text>
                <Text size="sm" figure tone={tone} style={[{ width: COLS[4] }, s.right]}>
                  {formatMoney(row.balance, currency)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {shown.length < rows.length ? (
        <Button variant="outline" size="sm" onPress={() => setAll(true)} style={{ alignSelf: "flex-start" }}>
          {tApp("showAllRows", { count: rows.length })}
        </Button>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  head: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
  right: { textAlign: "right" },
}));
