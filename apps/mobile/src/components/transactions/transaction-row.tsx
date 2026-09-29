import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Pencil, Trash2, TriangleAlert } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { TransactionWithRefs } from "@cigua/worker/api";
import { formatMoney } from "@cigua/core/format";
import { amountDisplay, isStatementCredit, transactionTitle } from "@cigua/core/transactions/display";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { LedgerRow } from "~/components/papel/ledger";
import { Stamp } from "~/components/papel/stamp";
import { MaskedMoney } from "~/components/money/money-display";
import { Mark } from "./mark";
import { useColors } from "~/theme/theme";

const TYPE_ICON = { expense: ArrowUpRight, income: ArrowDownLeft, payment: ArrowLeftRight } as const;

/**
 * One ledger line: category stamp, title and figure, accounts and the actions,
 * then its marks (excluded, from a statement, refund or cashback, FX fallback).
 * Money in prints teal with a plus. Edit and delete are always visible at thumb size.
 */
export const TransactionRow = memo(function TransactionRow({
  txn,
  onEdit,
  onDelete,
  pending,
  viewAccountId,
  rule = true,
}: {
  txn: TransactionWithRefs;
  onEdit?: (txn: TransactionWithRefs) => void;
  onDelete?: (id: string) => void;
  pending?: boolean;
  /** The account whose screen this row is on: a payment arriving here shows its destination leg. */
  viewAccountId?: string;
  rule?: boolean;
}) {
  const t = useTranslations("Transactions");
  const tType = useTranslations("TransactionTypes");
  const c = useColors();
  const Icon = TYPE_ICON[txn.type as keyof typeof TYPE_ICON] ?? ArrowLeftRight;
  const category = txn.category;
  const account = txn.account;
  const toAccount = txn.to_account;

  const title = transactionTitle(txn, tType("income"), t("transactionFallbackTitle"));
  const subtitle = txn.type === "payment" && toAccount ? `${account?.name ?? "—"} → ${toAccount.name}` : (account?.name ?? "—");
  const statementCredit = isStatementCredit(txn);
  const amt = amountDisplay(txn, viewAccountId);
  const hasExtras = txn.tax_amount > 0 || txn.fee_amount > 0;

  const marks = [
    txn.exclude_from_budget ? <Mark key="excluded">{t("excludeFromBudgetBadge")}</Mark> : null,
    txn.statement_line_id ? <Mark key="statement">{t("statementBadge")}</Mark> : null,
    statementCredit ? <Mark key="credit">{txn.credit_kind === "cashback" ? t("cashbackBadge") : t("refundBadge")}</Mark> : null,
    txn.fx_fallback ? (
      // The web explains the badge on hover; here the explanation is what a screen reader hears.
      <View key="fx" accessible accessibilityLabel={t("fxFallbackWarning")}>
        <Mark icon={<TriangleAlert size={10} color={c.mutedForeground} />}>{t("fxFallbackBadge")}</Mark>
      </View>
    ) : null,
  ].filter(Boolean);

  // A phone row is too narrow for title, marks, figure and two buttons side by side:
  // the title shares its line with the figure, the accounts share theirs with the
  // actions, and the marks get a wrapping line of their own under both.
  return (
    <LedgerRow
      rule={rule}
      style={{ paddingHorizontal: 0, paddingVertical: 10 }}
      lead={<Stamp color={category?.color ?? null} emoji={category?.emoji} name={category?.name} icon={Icon} size="sm" />}
      title={
        <View style={{ gap: 2 }}>
          <View style={styles.line}>
            <Text size="sm" weight={500} numberOfLines={1} style={styles.grow}>
              {title}
            </Text>
            <Text size="sm" weight={600} figure numberOfLines={1} tone={amt.income ? "teal" : "default"} style={styles.fixed}>
              {amt.sign}
              {amt.income ? <MaskedMoney amount={amt.value} currency={amt.currency} /> : formatMoney(amt.value, amt.currency)}
            </Text>
          </View>
          <View style={styles.line}>
            <Text size="xs" tone="muted" numberOfLines={1} style={styles.grow}>
              {hasExtras ? `${subtitle} · ${t("inclFees", { amount: formatMoney(txn.tax_amount + txn.fee_amount, txn.currency) })}` : subtitle}
            </Text>
            {onEdit || onDelete ? (
              <View style={styles.actions}>
                {onEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    icon={Pencil}
                    textColor={c.mutedForeground}
                    onPress={() => onEdit(txn)}
                    hitSlop={HIT}
                    accessibilityLabel={t("editAria")}
                  />
                ) : null}
                {onDelete ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    icon={Trash2}
                    textColor={c.mutedForeground}
                    onPress={() => onDelete(txn.id)}
                    disabled={pending}
                    hitSlop={HIT}
                    accessibilityLabel={t("deleteAria")}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
          {marks.length > 0 ? <View style={styles.marks}>{marks}</View> : null}
        </View>
      }
    />
  );
});

/** 32dp buttons reach 48dp tall and meet in the 8dp between them. */
const HIT = { top: 8, bottom: 8, left: 4, right: 4 };

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  grow: { flex: 1, minWidth: 0 },
  fixed: { flexShrink: 0 },
  // The buttons overhang the text line and their icons' right edge meets the figure's.
  actions: { flexDirection: "row", gap: 8, flexShrink: 0, marginVertical: -6, marginRight: -8 },
  marks: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingTop: 4 },
});
