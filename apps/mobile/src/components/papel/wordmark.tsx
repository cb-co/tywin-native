import { memo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { WORDMARK_PARTS, WORDMARK_RATIO, WORDMARK_STROKE, WORDMARK_VIEWBOX } from "@cigua/core/papel/wordmark";

/** The drawn "cigua" wordmark: monoline round-cap strokes, in any ink. */
export const Wordmark = memo(function Wordmark({ height = 18, color }: { height?: number; color: string }) {
  return (
    <Svg
      width={height * WORDMARK_RATIO}
      height={height}
      viewBox={WORDMARK_VIEWBOX}
      accessibilityRole="image"
      accessibilityLabel="Cigua"
    >
      <G fill="none" stroke={color} strokeWidth={WORDMARK_STROKE} strokeLinecap="round" strokeLinejoin="round">
        {WORDMARK_PARTS.map((p, i) =>
          p.kind === "path" ? (
            <Path key={i} d={p.d} transform={p.x ? `translate(${p.x} 0)` : undefined} />
          ) : (
            <Circle
              key={i}
              cx={p.cx + p.x}
              cy={p.cy}
              r={p.r}
              fill={p.fill ? color : "none"}
              stroke={p.fill ? "none" : color}
            />
          ),
        )}
      </G>
    </Svg>
  );
});
