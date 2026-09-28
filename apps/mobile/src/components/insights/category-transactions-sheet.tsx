import { StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import type { TransactionWithRefs } from "@cigua/worker/api";
import { amountDisplay, transactionTitle } from "@cigua/core/transactions/display";
import { formatMoney } from "@cigua/core/format";
import { monthLabel } from "@cigua/core/budgets/month";
import { MaskedMoney } from "~/components/money/money-display";
import { BottomSheet } from "~/components/ui/overlay";
import { Skeleton } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { makeStyles } from "~/theme/theme";

const SKELETON_ROWS = [0, 1, 2, 3, 4];

/** `DD/MM`, the slash date the statement-import preview prints. */
function slashDate(occurredAt: string) {
  const iso = occurredAt.slice(0, 10);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * The transactions behind one spend-ledger row, as a dense read-only ledger
 * (date, description, amount). It only shows what it is handed: `rows` is null
 * while the caller's fetch is in flight.
 */
export function CategoryTransactionsSheet({
  open,
  onClose,
  name,
  month,
  amount,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  month: string;
  amount: string | null;
  rows: TransactionWithRefs[] | null;
}) {
  const t = useTranslations("Insights");
  const tTxn = useTranslations("Transactions");
  const tType = useTranslations("TransactionTypes");
  const locale = useLocale();
  const s = useStyles();

  return (
    <BottomSheet open={open} onClose={onClose} title={name}>
      <View style={{ gap: 8, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
          <Text size="xs" tone="muted">
            {monthLabel(month, locale)}
          </Text>
          {rows === null ? null : (
            <Text size="xs" tone="muted">
              {t("categorySheetCount", { count: rows.length })}
            </Text>
          )}
        </View>

        {rows === null ? (
          <View style={s.skeleton} importantForAccessibility="no-hide-descendants">
            {SKELETON_ROWS.map((i) => (
              <Skeleton key={i} height={28} style={{ borderRadius: 0, marginVertical: 1 }} />
            ))}
          </View>
        ) : rows.length === 0 ? (
          <Text size="sm" tone="muted" align="center" style={{ paddingVertical: 40 }}>
            {t("categorySheetEmpty")}
          </Text>
        ) : (
          <>
            <View accessibilityLabel={name} style={s.list}>
              {rows.map((txn, i) => {
                const amt = amountDisplay(txn);
                const title = transactionTitle(txn, tType("income"), tTxn("transactionFallbackTitle"));
                return (
                  <View key={txn.id} style={[s.line, i < rows.length - 1 ? s.rule : null]}>
                    <Text size="xs" figure tone="muted" style={{ width: 42 }}>
                      {slashDate(txn.occurred_at)}
                    </Text>
                    <Text size="xs" numberOfLines={1} tracking={0.025} style={{ flex: 1, textTransform: "uppercase" }}>
                      {title}
                    </Text>
                    <Text size="xs" figure weight={600} tone={amt.income ? "teal" : "default"}>
                      {amt.sign}
                      {amt.income ? <MaskedMoney amount={amt.value} currency={amt.currency} /> : formatMoney(amt.value, amt.currency)}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={s.total}>
              <Text legend size="2xs" tone="muted" style={{ fontSize: 11 }}>
                {t("categorySheetTotal")}
              </Text>
              <Text size="sm" figure weight={600}>
                {amount}
              </Text>
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  skeleton: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.paperLine },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.paperLine },
  line: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, paddingVertical: 6 },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
  total: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: c.rule,
    paddingTop: 8,
  },
}));
