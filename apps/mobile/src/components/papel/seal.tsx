import { memo } from "react";
import { View, type ViewStyle } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { BIRD_BODY, BIRD_FEATHER, BIRD_WING } from "@cigua/core/papel/bird";
import { rosettePlate } from "./guilloche";
import { useColors } from "~/theme/theme";

const RING_EXTENT = 167;

/**
 * The Cigua seal: the engraved re-issue of the logo. A guilloche rosette ring cut
 * around the palmchat, all line work, in note ink on a note-violet disc.
 * The rosette's hairlines only resolve from about 80px up, so small sizes leave it off.
 */
export const Seal = memo(function Seal({
  size = 32,
  tone = "note",
  rosette = false,
  fine = false,
  style,
}: {
  size?: number;
  tone?: "note" | "ink";
  rosette?: boolean;
  /** Hairline weight, for a small seal set inside finer line work (the splash's plate). */
  fine?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const w = fine ? 0.6 : 1;
  const ink = tone === "note" ? c.noteInk : c.foreground;
  const scale = 31 / RING_EXTENT;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: size, height: size, borderRadius: size / 2, overflow: "hidden" },
        tone === "note" ? { backgroundColor: c.note } : null,
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {rosette ? (
          <G transform={`translate(32 32) scale(${scale})`} opacity={0.55}>
            {rosettePlate().paths.map((d, i) => (
              <Path key={i} d={d} stroke={ink} strokeWidth={0.35 / scale} fill="none" />
            ))}
          </G>
        ) : null}
        <Circle cx={32} cy={32} r={30.5} stroke={ink} strokeWidth={1.8 * w} />
        <Circle cx={32} cy={32} r={22} stroke={ink} strokeWidth={1.4 * w} />
        <G transform="translate(-0.8 0.2)" stroke={ink} strokeWidth={2.3 * w} strokeLinecap="round" strokeLinejoin="round">
          <Path d={BIRD_WING} />
          {rosette ? <Path d={BIRD_FEATHER} strokeWidth={1} /> : null}
          <Path d={BIRD_BODY} />
        </G>
      </Svg>
    </View>
  );
});
