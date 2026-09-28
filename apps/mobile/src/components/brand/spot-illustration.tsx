import Svg, { Circle, Rect } from "react-native-svg";
import { useColors } from "~/theme/theme";

/**
 * Flat spot art for empty states: stacked geometric planes in tints of one hue.
 * Decorative, and always beside a real heading.
 */
export function SpotIllustration({ scene, size = 112, color }: { scene: "wallet" | "chart" | "empty"; size?: number; color?: string }) {
  const c = useColors();
  const ink = color ?? c.brand;
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {scene === "wallet" ? (
        <>
          <Rect x={18} y={46} width={84} height={56} rx={12} fill={ink} opacity={0.25} />
          <Rect x={30} y={34} width={84} height={56} rx={12} fill={ink} opacity={0.55} />
          <Circle cx={96} cy={62} r={8} fill={ink} />
        </>
      ) : scene === "chart" ? (
        <>
          <Rect x={24} y={70} width={18} height={34} rx={6} fill={ink} opacity={0.35} />
          <Rect x={52} y={48} width={18} height={56} rx={6} fill={ink} opacity={0.6} />
          <Rect x={80} y={28} width={18} height={76} rx={6} fill={ink} />
        </>
      ) : (
        <>
          <Circle cx={64} cy={64} r={38} fill={ink} opacity={0.18} />
          <Rect x={44} y={58} width={40} height={8} rx={4} fill={ink} opacity={0.7} />
        </>
      )}
    </Svg>
  );
}
