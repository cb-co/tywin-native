import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { BRAND_TILE as T } from "@cigua/core/papel/brand-tile";
import { rosettePlate } from "./guilloche";
import { Seal } from "./seal";
import { useColors } from "~/theme/theme";

/**
 * The app icon at header size: a deep-violet tile, the guilloche plate engraved
 * in its centre and the note-violet seal on top. Fixed colours, so it reads the
 * same in both themes.
 */
export const BrandTile = memo(function BrandTile({ size = 32 }: { size?: number }) {
  const c = useColors();
  const { paths, extent } = rosettePlate();
  const scale = (32 * T.plate) / extent;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[s.tile, { width: size, height: size, borderRadius: size * T.radius, backgroundColor: c.noteDeep }]}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={StyleSheet.absoluteFill}>
        <G transform={`translate(32 32) scale(${scale})`} opacity={T.plateOpacity}>
          {paths.slice(0, T.plateLayers).map((d, i) => (
            <Path key={i} d={d} stroke={c.noteInk} strokeWidth={T.plateLine / scale} strokeLinejoin="round" />
          ))}
        </G>
      </Svg>
      <Seal size={Math.round(size * T.seal)} />
    </View>
  );
});

const s = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
