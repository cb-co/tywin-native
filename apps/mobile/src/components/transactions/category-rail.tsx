import { Pressable, ScrollView, View } from "react-native";
import { Ellipsis } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { QuickAddCategory } from "@cigua/core/transactions/types";
import { Stamp } from "~/components/papel/stamp";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

/** How many chips before the overflow: what fits on the narrowest phone without scrolling. */
const VISIBLE = 5;

/**
 * The category picker for quick-add: a rail of stamps, most-used first, because
 * category is the field most often changed in the app's most repeated action.
 * The full catalogue stays one tap away.
 */
export function CategoryRail({
  categories,
  value,
  onChange,
  onMore,
}: {
  categories: QuickAddCategory[];
  value: string;
  onChange: (id: string) => void;
  onMore: () => void;
}) {
  const t = useTranslations("TransactionForm");
  const c = useColors();
  const shown = categories.slice(0, VISIBLE);
  // A category picked from the full list stays on the rail, or it would vanish the moment it was chosen.
  const selectedOffRail = value && !shown.some((cat) => cat.id === value) ? categories.find((cat) => cat.id === value) : undefined;
  const chip = (width: number) => ({ width, alignItems: "center" as const, gap: 4, paddingBottom: 4, paddingTop: 2, borderBottomWidth: 3 });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={t("categoryLabel")}>
      <View style={{ flexDirection: "row", gap: 2 }}>
        {[...(selectedOffRail ? [selectedOffRail] : []), ...shown].map((cat) => {
          const on = value === cat.id;
          return (
            <Pressable
              key={cat.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={cat.name}
              onPress={() => onChange(cat.id)}
              style={[chip(52), { borderBottomColor: on ? c.foreground : "transparent" }]}
            >
              <Stamp color={cat.color} emoji={cat.emoji} name={cat.name} size="sm" inked={on} />
              <Text size="2xs" weight={600} tone={on ? "default" : "muted"} numberOfLines={1} align="center" style={{ width: "100%", fontSize: 10, lineHeight: 12 }}>
                {cat.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" onPress={onMore} style={[chip(52), { borderBottomColor: "transparent" }]}>
          <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: c.inkSoft, alignItems: "center", justifyContent: "center" }}>
            <Ellipsis size={18} color={c.mutedForeground} />
          </View>
          <Text size="2xs" weight={600} tone="muted" numberOfLines={1} align="center" style={{ width: "100%", fontSize: 10, lineHeight: 12 }}>
            {t("moreCategories")}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
