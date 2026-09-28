import { memo } from "react";
import { View } from "react-native";
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
 * One ledger line: category stamp, title with its marks (excluded, from a
 * statement, refund or cashback, FX fallback), accounts, and the figure. Money in
 * prints teal with a plus. Edit and delete are always visible at thumb size.
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

  return (
    <LedgerRow
      rule={rule}
      style={{ paddingHorizontal: 0, paddingVertical: 8 }}
      lead={<Stamp color={category?.color ?? null} emoji={category?.emoji} name={category?.name} icon={Icon} size="sm" />}
      title={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
          <Text size="sm" weight={500} numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </Text>
          {txn.exclude_from_budget ? <Mark>{t("excludeFromBudgetBadge")}</Mark> : null}
          {txn.statement_line_id ? <Mark>{t("statementBadge")}</Mark> : null}
          {statementCredit ? <Mark>{txn.credit_kind === "cashback" ? t("cashbackBadge") : t("refundBadge")}</Mark> : null}
          {txn.fx_fallback ? (
            // The web explains the badge on hover; here the explanation is what a screen reader hears.
            <View accessible accessibilityLabel={t("fxFallbackWarning")}>
              <Mark icon={<TriangleAlert size={10} color={c.mutedForeground} />}>{t("fxFallbackBadge")}</Mark>
            </View>
          ) : null}
        </View>
      }
      subtitle={hasExtras ? `${subtitle} · ${t("inclFees", { amount: formatMoney(txn.tax_amount + txn.fee_amount, txn.currency) })}` : subtitle}
      amount={
        <Text size="sm" weight={600} figure tone={amt.income ? "teal" : "default"}>
          {amt.sign}
          {amt.income ? <MaskedMoney amount={amt.value} currency={amt.currency} /> : formatMoney(amt.value, amt.currency)}
        </Text>
      }
      trailing={
        onEdit || onDelete ? (
          <>
            {onEdit ? (
              <Button variant="ghost" size="icon" icon={Pencil} textColor={c.mutedForeground} onPress={() => onEdit(txn)} accessibilityLabel={t("editAria")} />
            ) : null}
            {onDelete ? (
              <Button
                variant="ghost"
                size="icon"
                icon={Trash2}
                textColor={c.mutedForeground}
                onPress={() => onDelete(txn.id)}
                disabled={pending}
                accessibilityLabel={t("deleteAria")}
              />
            ) : null}
          </>
        ) : undefined
      }
    />
  );
});
