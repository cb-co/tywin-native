import { Pressable, View, type ViewStyle } from "react-native";
import { useTranslations } from "use-intl";
import { showsAds } from "@cigua/core/plans";
import { Sparkles } from "~/components/ui/icons";
import { Text } from "~/components/ui/text";
import { usePlan, useUpgrade } from "~/lib/plan";
import { radius } from "~/theme/tokens";
import { useColors } from "~/theme/theme";

/**
 * Every place an ad may appear, named so a future ad network's reporting (and
 * any per-placement switch) has a stable key. Add one when you mount a slot.
 */
export type AdPlacement = "overview" | "transactions" | "insights" | "budgets" | "accounts" | "recurring";

/**
 * A small banner ad, shown to Free accounts and never to Cigua Pro.
 *
 * Mounted nowhere yet: drop `<AdSlot placement="overview" />` where an ad
 * belongs. It renders nothing for Pro, so screens can mount it unconditionally.
 *
 * Today the banner is a house ad for Cigua Pro, which needs no SDK, collects
 * nothing and needs no consent. To serve real ads, replace `HouseAd` with the ad
 * network's banner (e.g. react-native-google-mobile-ads), and before shipping
 * that: add its consent flow (UMP; App Tracking Transparency on iOS), update the
 * Privacy Policy's ads paragraph and the store privacy labels.
 */
export function AdSlot({ placement, style }: { placement: AdPlacement; style?: ViewStyle }) {
  const plan = usePlan();
  if (!showsAds(plan.plan)) return null;
  return <HouseAd placement={placement} style={style} />;
}

function HouseAd({ style }: { placement: AdPlacement; style?: ViewStyle }) {
  const t = useTranslations("Plan");
  const c = useColors();
  const upgrade = useUpgrade();
  return (
    <Pressable
      onPress={upgrade}
      accessibilityRole="button"
      accessibilityLabel={`${t("adLabel")}: ${t("houseAdTitle")}. ${t("houseAdBody")}`}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 56,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: radius.sheet,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: pressed ? c.secondaryHover : c.card,
        },
        style,
      ]}
    >
      <Sparkles size={18} color={c.brand} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" weight={600} numberOfLines={1}>
          {t("houseAdTitle")}
        </Text>
        <Text size="xs" tone="muted" numberOfLines={1}>
          {t("houseAdBody")}
        </Text>
      </View>
      <Text size="xs" tone="muted" style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.control, paddingHorizontal: 4 }}>
        {t("adLabel")}
      </Text>
    </Pressable>
  );
}
