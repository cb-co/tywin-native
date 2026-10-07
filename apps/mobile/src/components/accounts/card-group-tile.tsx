import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { AccountWithStatus } from "@cigua/worker/api";
import { inferLast4, inferNetwork } from "@cigua/core/accounts/network";
import { formatPercent } from "@cigua/core/format";
import { cardLineLabel, compareCardLines, isCardLine } from "@cigua/core/accounts/card-lines";
import { Card } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { CardFace } from "~/components/papel/card-face";
import { MoneyDisplay } from "~/components/money/money-display";
import { useColors } from "~/theme/theme";

/**
 * The lines of one physical card as a single tile: the face once, then a row per
 * line, always DOP, USD, Cuotas. The face opens the line in the person's own
 * currency; each row opens its own line.
 */
export function CardGroupTile({
  name,
  brand,
  artColor,
  accounts: unsorted,
  baseCurrency,
}: {
  name: string;
  brand: string | null;
  artColor: string | null;
  accounts: AccountWithStatus[];
  baseCurrency: string;
}) {
  const t = useTranslations("Accounts");
  const tf = useTranslations("AccountForm");
  const c = useColors();
  const accounts = [...unsorted].sort((a, b) => compareCardLines(a.card_line, b.card_line));
  const network = inferNetwork(name, brand);
  const last4 = accounts.map((a) => inferLast4(a.name, a.last4)).find((v) => v !== null) ?? inferLast4(name);
  const primary = accounts.find((a) => a.currency === baseCurrency) ?? accounts[0];
  const open = (id: string) => router.push({ pathname: "/accounts/[id]", params: { id } });
  return (
    <Card style={{ padding: 20 }}>
      <Pressable accessibilityRole="link" accessibilityLabel={name} onPress={() => open(primary.id)}>
        <CardFace name={name} last4={last4} network={network} accent={artColor} />
      </Pressable>
      <View style={{ marginTop: 16, borderTopWidth: 2, borderTopColor: c.rule }}>
        {accounts.map((a, i) => {
          const owed = a.cardStatus?.owed ?? a.current_balance;
          const util = a.cardStatus?.utilization_pct ?? null;
          return (
            <Pressable
              key={a.id}
              accessibilityRole="link"
              onPress={() => open(a.id)}
              style={({ pressed }) => [
                { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
                i === 0 ? { paddingTop: 8 } : null,
                i < accounts.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border } : null,
                pressed ? { opacity: 0.7 } : null,
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" weight={500} numberOfLines={1}>
                  {isCardLine(a.card_line) ? cardLineLabel(a.card_line, tf("lineInstallments")) : a.name}
                </Text>
                <Text size="xs" tone="muted">
                  {util !== null ? t("usedPercent", { pct: formatPercent(util), currency: a.currency }) : a.currency}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MoneyDisplay amount={owed} currency={a.currency} size="inline" />
                <ChevronRight size={16} color={c.mutedForeground} style={{ opacity: 0.5 }} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
