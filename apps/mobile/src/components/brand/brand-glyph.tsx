import Svg, { Path } from "react-native-svg";

/**
 * One Simple Icons path, drawn in a single colour. It never stands alone (the
 * name is beside it), so it is hidden from screen readers.
 */
export function BrandGlyph({ path, size, color, viewBox = "0 0 24 24" }: { path: string; size: number; color: string; viewBox?: string }) {
  return (
    <Svg width={size} height={size} viewBox={viewBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={path} fill={color} />
    </Svg>
  );
}
