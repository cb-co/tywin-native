import { memo, useMemo, useState } from "react";
import { Platform, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { cardForeground, cardGradientStops, sheenChannel } from "@cigua/core/color";
import { DEFAULT_CARD_ACCENT, HEX6 } from "@cigua/core/accounts/card-art";
import type { CardNetwork } from "@cigua/core/accounts/network";
import { Text } from "~/components/ui/text";
import { Guilloche } from "./guilloche";
import { NETWORK_MARKS } from "./network-marks";
import { radius } from "~/theme/tokens";

export const NETWORK_WORDMARK: Record<CardNetwork, string> = {
  visa: "VISA",
  mastercard: "MASTERCARD",
  amex: "AMEX",
};

const RATIO = 1.7;

/**
 * The one card face, fed by the card's own stored accent: gallery, group tile
 * and detail hero all draw this, so they match by construction.
 *
 * The geometry is fixed and the accent is the only variable. Three light layers
 * over a base ramp (accent to a lit far corner), a soft ambient glow at the top
 * left, and one specular band across the face; on a pale accent the light layers
 * flip to shadow. The lettering takes whichever ink has the better worst-case
 * contrast across every surface the face can present.
 */
export const CardFace = memo(function CardFace({
  name,
  last4,
  network,
  accent,
  mark = "logo",
  style,
}: {
  name: string;
  last4: string | null;
  network: CardNetwork | null;
  accent: string | null;
  mark?: "logo" | "wordmark";
  style?: ViewStyle;
}) {
  const base = accent && HEX6.test(accent) ? accent : DEFAULT_CARD_ACCENT;
  const { far, fg, sheen } = useMemo(() => {
    const stops = cardGradientStops(base);
    return { far: stops.far, fg: cardForeground(base), sheen: sheenChannel(base) === 0 ? "#000000" : "#ffffff" };
  }, [base]);
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const height = width / RATIO;

  return (
    <View style={[styles.shadow, style]}>
      <View onLayout={onLayout} style={[styles.face, { aspectRatio: RATIO }]}>
        {width > 0 ? (
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="ramp" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={base} />
                <Stop offset="1" stopColor={far} />
              </LinearGradient>
              <RadialGradient id="ambient" cx="18%" cy="0%" rx="115%" ry="85%" fx="18%" fy="0%">
                <Stop offset="0" stopColor={sheen} stopOpacity={0.035} />
                <Stop offset="0.42" stopColor={sheen} stopOpacity={0.012} />
                <Stop offset="0.7" stopColor={sheen} stopOpacity={0} />
              </RadialGradient>
              <LinearGradient id="specular" x1="0" y1="0.37" x2="1" y2="0.63">
                <Stop offset="0.26" stopColor={sheen} stopOpacity={0} />
                <Stop offset="0.36" stopColor={sheen} stopOpacity={0.03} />
                <Stop offset="0.44" stopColor={sheen} stopOpacity={0.11} />
                <Stop offset="0.48" stopColor={sheen} stopOpacity={0.08} />
                <Stop offset="0.56" stopColor={sheen} stopOpacity={0.02} />
                <Stop offset="0.68" stopColor={sheen} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={height} fill="url(#ramp)" />
            <Rect width={width} height={height} fill="url(#ambient)" />
            <Rect width={width} height={height} fill="url(#specular)" />
          </Svg>
        ) : null}
        {width > 0 ? (
          <Guilloche
            color={fg}
            lineWidth={0.5}
            opacity={0.35}
            style={{ position: "absolute", width: width * 1.5, height: width * 1.5, right: -width * 0.95, top: -height * 0.75 }}
          />
        ) : null}
        <Text width="semi" weight={800} color={fg} numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        <Text figure weight={600} color={fg} tracking={0.14} size="base">
          •••• {last4 ?? "····"}
        </Text>
        {network ? (
          mark === "logo" ? (
            <NetworkMark network={network} foreground={fg} style={styles.mark} />
          ) : (
            <Text
              width="expanded"
              weight={900}
              color={fg}
              tracking={0.04}
              style={[styles.mark, { fontSize: 15.2, transform: [{ skewX: "-10deg" }] }]}
            >
              {NETWORK_WORDMARK[network]}
            </Text>
          )
        ) : null}
      </View>
    </View>
  );
});

/**
 * The network mark on a card face, monochrome in the face's own foreground so it
 * can never disagree with the lettering beside it. Amex is the exception: it is a
 * filled plate with the lettering knocked out, so it keeps its own blue. Heights
 * are matched optically, not made equal.
 */
export function NetworkMark({
  network,
  foreground,
  style,
}: {
  network: CardNetwork | null;
  foreground: string;
  style?: ViewStyle;
}) {
  if (!network) return null;
  const m = NETWORK_MARKS[network];
  const [, , vw, vh] = m.viewBox.split(" ").map(Number);
  const h = m.height;
  return (
    <View style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={(h * vw) / vh} height={h} viewBox={m.viewBox}>
        <Path d={m.path} fill={"color" in m ? m.color : foreground} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radius.card,
    ...Platform.select({
      ios: { shadowColor: "rgb(20, 10, 40)", shadowOffset: { width: 0, height: 16 }, shadowRadius: 18, shadowOpacity: 0.45 },
      android: { elevation: 10 },
    }),
  },
  face: {
    width: "100%",
    borderRadius: radius.card,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingVertical: 21,
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.25)",
  },
  name: { fontSize: 17.6, lineHeight: 24 },
  mark: { position: "absolute", bottom: 19, right: 22 },
});
