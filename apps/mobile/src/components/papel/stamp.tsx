import { memo, useMemo } from "react";
import { StyleSheet, Text as RNText, View, type ViewStyle } from "react-native";
import type { LucideIcon } from "~/components/ui/icons";
import { HEX6 } from "@cigua/core/color";
import { stampInk, STAMP_SURFACE } from "@cigua/core/papel/ink";
import { Text } from "~/components/ui/text";
import { useTheme } from "~/theme/theme";

const SIZES = {
  sm: { box: 36, glyph: 14, emoji: 16, icon: 18 },
  md: { box: 44, glyph: 18, emoji: 20, icon: 20 },
  lg: { box: 56, glyph: 24, emoji: 26, icon: 24 },
} as const;

const inkCache = new Map<string, string>();
function inkFor(hex: string, scheme: "light" | "dark"): string {
  const key = `${hex}:${scheme}`;
  let ink = inkCache.get(key);
  if (!ink) {
    ink = stampInk(hex, STAMP_SURFACE[scheme]);
    inkCache.set(key, ink);
  }
  return ink;
}

/**
 * A category's or account's identity, printed as an ink stamp: a double ring and
 * the glyph in the user's own colour. The colour is data, so each theme's ink is
 * computed from it (never assumed to be a shipped swatch). Emoji keep their own colour.
 */
export const Stamp = memo(function Stamp({
  color,
  emoji,
  name,
  icon: Icon,
  size = "sm",
  inked,
  style,
}: {
  color: string | null;
  emoji?: string | null;
  name?: string | null;
  icon?: LucideIcon;
  size?: keyof typeof SIZES;
  /** Pressed harder: the selected state on a category rail. */
  inked?: boolean;
  style?: ViewStyle;
}) {
  const { colors, scheme } = useTheme();
  const s = SIZES[size];
  const ink = useMemo(
    () => (color && HEX6.test(color) ? inkFor(color, scheme) : colors.inkSoft),
    [color, scheme, colors.inkSoft],
  );
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.stamp,
        { width: s.box, height: s.box, borderRadius: s.box / 2, borderColor: ink, borderWidth: inked ? 3 : 1.5 },
        style,
      ]}
    >
      <View pointerEvents="none" style={[styles.inner, { borderColor: ink, borderRadius: s.box }]} />
      {emoji ? (
        <RNText style={{ fontSize: s.emoji, lineHeight: s.emoji * 1.25 }} allowFontScaling={false}>
          {emoji}
        </RNText>
      ) : Icon ? (
        <Icon size={s.icon} color={ink} strokeWidth={2.25} />
      ) : name ? (
        <Text width="semi" weight={700} tone="default" style={{ fontSize: s.glyph, lineHeight: s.glyph * 1.3 }} allowFontScaling={false}>
          {name.charAt(0).toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  stamp: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  inner: { position: "absolute", top: 2, left: 2, right: 2, bottom: 2, borderWidth: 0.75 },
});
