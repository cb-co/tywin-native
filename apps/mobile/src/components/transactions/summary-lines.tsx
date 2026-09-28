import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { formatMoney } from "@cigua/core/format";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

/** What the row will cost, stated rather than asked. A preview: the stored figure comes from the database. */
export function FeeSummaryLine({
  tax,
  fee,
  currency,
  sameBank,
  onEdit,
}: {
  tax: number;
  fee: number;
  currency: string;
  sameBank: boolean;
  onEdit: () => void;
}) {
  const t = useTranslations("TransactionForm");
  const parts = [
    tax > 0 ? t("feeLineTax", { amount: formatMoney(tax, currency) }) : null,
    fee > 0 ? t("feeLineFee", { amount: formatMoney(fee, currency) }) : null,
    fee === 0 && sameBank ? t("feeLineNoFeeSameBank") : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Text size="xs" tone="muted">
        {parts.join(" · ")}
      </Text>
      <Pressable onPress={onEdit} accessibilityRole="button" hitSlop={8}>
        <Text size="xs" style={{ textDecorationLine: "underline" }}>
          {t("feeLineEdit")}
        </Text>
      </Pressable>
    </View>
  );
}

/** The one-line stand-in for the account, destination and date fields; one tap opens all three. */
export function AccountDateLine({
  accountLabel,
  destinationLabel,
  dateLabel,
  onEdit,
}: {
  accountLabel: string;
  destinationLabel?: string;
  dateLabel: string;
  onEdit: () => void;
}) {
  const t = useTranslations("TransactionForm");
  const c = useColors();
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={t("summaryAria")}
      style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.paperLine, paddingVertical: 8 }}
    >
      <Text size="sm" tone="muted">
        {accountLabel}
      </Text>
      {destinationLabel ? (
        <>
          <Text size="sm" tone="muted">
            →
          </Text>
          <Text size="sm" tone="muted">
            {destinationLabel}
          </Text>
        </>
      ) : null}
      <Text size="sm" tone="muted">
        ·
      </Text>
      <Text size="sm" tone="muted">
        {dateLabel}
      </Text>
    </Pressable>
  );
}
