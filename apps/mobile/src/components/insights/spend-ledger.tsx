import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { TransactionWithRefs } from "@cigua/worker/api";
import { shareRows, type ShareRow } from "@cigua/core/insights/share";
import { monthEnd } from "@cigua/core/budgets/month";
import { callAction } from "~/lib/api";
import { useMaskedFormatMoney } from "~/components/money/figure-mask";
import { MoneyDisplay } from "~/components/money/money-display";
import { LedgerRow } from "~/components/papel/ledger";
import { RuleMeter } from "~/components/papel/rule-meter";
import { Stamp } from "~/components/papel/stamp";
import { Text } from "~/components/ui/text";
import { makeStyles } from "~/theme/theme";
import { CategoryTransactionsSheet } from "./category-transactions-sheet";

/**
 * Where a row's drilldown comes from: a card's own charges, or the Insights
 * spend rule (which is not a plain category + type filter).
 */
export type SpendLedgerScope = { kind: "account"; accountId: string } | { kind: "insights" };

type Slice = { name: string; value: number; color: string; emoji?: string | null; categoryId: string | null };

/** Spend by category as ledger rows with a meter each; a tap lists the transactions behind the row. */
export function SpendLedger({
  data,
  total,
  currency,
  month,
  scope,
}: {
  data: Slice[];
  total: number;
  currency: string;
  /** First of the month the drilldown is windowed to. */
  month: string;
  scope: SpendLedgerScope;
}) {
  const t = useTranslations("Insights");
  const s = useStyles();
  const maskedFormat = useMaskedFormatMoney();
  const [selected, setSelected] = useState<{ name: string; value: number } | null>(null);
  const [rows, setRows] = useState<TransactionWithRefs[] | null>(null);
  // A slower first fetch never overwrites a faster second one.
  const requestId = useRef(0);

  if (data.length === 0) {
    return (
      <Text size="sm" tone="muted" align="center" style={{ paddingVertical: 40 }}>
        {t("spendDonutEmpty")}
      </Text>
    );
  }
  const rowsData = shareRows(data, total);
  const largest = Math.max(...rowsData.map((r) => r.value), 1);

  async function openCategory(r: ShareRow) {
    setSelected({ name: r.rest ? t("spendOther") : r.name, value: r.value });
    setRows(null);
    const id = ++requestId.current;
    try {
      const fetched =
        scope.kind === "account"
          ? (
              await callAction("transactions", "loadTransactions", {
                accountId: scope.accountId,
                categoryIds: r.categoryIds,
                type: "expense",
                from: month,
                to: monthEnd(month),
              })
            ).rows
          : await callAction("insights", "loadInsightsSpendTransactions", month, r.categoryIds);
      if (id === requestId.current) setRows(fetched);
    } catch {
      if (id === requestId.current) setRows([]);
    }
  }

  return (
    <View style={{ marginHorizontal: -16, marginBottom: -16 }}>
      <View style={s.head}>
        <Text legend size="2xs" tone="muted" style={{ fontSize: 11 }}>
          {t("thisMonth")}
        </Text>
        <MoneyDisplay amount={total} currency={currency} size="stat" />
      </View>
      <View style={s.list}>
        {rowsData.map((r, i) => {
          const name = r.rest ? t("spendOther") : r.name;
          return (
            <Pressable
              key={r.rest ? "rest" : r.name}
              accessibilityRole="button"
              onPress={() => void openCategory(r)}
              style={({ pressed }) => [i < rowsData.length - 1 ? s.rule : null, pressed ? s.pressed : null]}
            >
              <LedgerRow
                rule={false}
                style={{ paddingBottom: 6 }}
                lead={<Stamp color={r.color} emoji={r.emoji} name={name} />}
                title={name}
                amount={
                  <Text size="sm" weight={600} figure align="right">
                    {maskedFormat(r.value, currency)}
                  </Text>
                }
                meta={`${r.pct.toFixed(r.pct < 10 ? 1 : 0)}%`}
              />
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <RuleMeter used={r.value} total={largest} label={`${name} ${r.pct.toFixed(0)}%`} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <CategoryTransactionsSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        name={selected?.name ?? ""}
        month={month}
        amount={selected ? maskedFormat(selected.value, currency) : null}
        rows={rows}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.paperLine },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
  pressed: { backgroundColor: c.accent },
}));
