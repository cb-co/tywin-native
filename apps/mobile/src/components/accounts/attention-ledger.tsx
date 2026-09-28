import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useLocale, useTranslations } from "use-intl";
import type { AttentionItem } from "@cigua/worker/api";
import { formatDate } from "@cigua/core/format";
import { Text } from "~/components/ui/text";
import { LedgerRow } from "~/components/papel/ledger";
import { ProofMark } from "~/components/papel/proof-mark";
import { Stamp } from "~/components/papel/stamp";
import { useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";

/**
 * What needs a decision first: overdue, due soon, or carrying uncategorised spend.
 * Renders nothing at all when there is nothing to flag: a quiet month reads as calm.
 */
export function AttentionLedger({ items }: { items: AttentionItem[] }) {
  const t = useTranslations("Accounts");
  const locale = useLocale();
  const c = useColors();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 4 }}>
      <Text legend tone="muted" accessibilityRole="header" style={{ fontSize: 11 }}>
        {t("attentionTitle")}
      </Text>
      <View style={{ borderRadius: radius.sheet, borderWidth: StyleSheet.hairlineWidth, borderColor: c.paperLine }}>
        {items.map((item, i) => (
          <LedgerRow
            key={item.id}
            rule={i < items.length - 1}
            onPress={() => router.push({ pathname: "/accounts/[id]", params: { id: item.id } })}
            lead={<Stamp color={item.color} name={item.name} size="sm" />}
            title={item.name}
            subtitle={item.last4 ? `•••• ${item.last4}` : undefined}
            amount={
              <ProofMark tone="flag">
                {item.reason === "overdue"
                  ? t("attentionOverdue")
                  : item.reason === "due-soon" && item.dueDate
                    ? t("attentionDueSoon", { date: formatDate(item.dueDate, locale) })
                    : t("attentionUntriaged", { count: item.pendingTriageCount })}
              </ProofMark>
            }
          />
        ))}
      </View>
    </View>
  );
}
