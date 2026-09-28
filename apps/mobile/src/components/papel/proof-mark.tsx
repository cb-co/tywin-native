import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

/**
 * A printed verification mark: glyph in an ink ring plus a label. The glyph
 * carries the state, so it never depends on colour alone (teal and red only
 * reinforce it).
 */
export function ProofMark({
  tone,
  children,
  size = "sm",
}: {
  tone: "ok" | "flag" | "neutral";
  children: React.ReactNode;
  size?: "sm" | "lg";
}) {
  const c = useColors();
  const color = tone === "ok" ? c.teal : tone === "flag" ? c.red : c.mutedForeground;
  const px = size === "sm" ? 16 : 56;
  const glyph =
    tone === "ok" ? (
      <Path d="M3.5 8.2 6.6 11 12.5 4.8" />
    ) : tone === "flag" ? (
      <Path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    ) : (
      <Circle cx={8} cy={8} r={1.6} fill={color} stroke="none" />
    );
  return (
    <View style={size === "sm" ? { flexDirection: "row", alignItems: "center", gap: 6 } : { alignItems: "center", gap: 8 }}>
      <Svg width={px} height={px} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.75}>
        <Circle cx={8} cy={8} r={7.1} strokeWidth={1.1} />
        {glyph}
      </Svg>
      {size === "sm" ? (
        <Text size="xs" weight={600} color={color}>
          {children}
        </Text>
      ) : (
        <Text legend size="sm" color={color}>
          {children}
        </Text>
      )}
    </View>
  );
}
