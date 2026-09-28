import { View, type ViewStyle } from "react-native";
import { TriangleAlert } from "~/components/ui/icons";
import { useLocale, useTranslations } from "use-intl";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

/**
 * Says out loud what the conversion does quietly: with no rate table, foreign
 * amounts are folded into a base total at 1:1. Renders nothing when every
 * currency converted, so screens mount it unconditionally.
 */
export function FxDegradedNotice({ currencies, base, style }: { currencies: string[]; base: string; style?: ViewStyle }) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const c = useColors();
  if (currencies.length === 0) return null;
  let list = currencies.join(", ");
  try {
    list = new Intl.ListFormat(locale, { style: "short", type: "conjunction" }).format(currencies);
  } catch {}
  return (
    <View
      accessibilityRole="alert"
      style={[{ flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, padding: 16, backgroundColor: `${c.warning}1a` }, style]}
    >
      <TriangleAlert size={16} color={c.warning} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" weight={500} tone="warning">
          {t("fxDegradedTitle")}
        </Text>
        <Text size="sm" tone="warning" style={{ marginTop: 4, opacity: 0.9 }}>
          {t("fxDegradedBody", { currencies: list, base })}
        </Text>
      </View>
    </View>
  );
}
