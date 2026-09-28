import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { ROSETTE_LAYERS, rosettePoints } from "@cigua/core/papel/rosette";

/**
 * Engraved guilloche line work.
 *
 * Every ornament in Papel Moneda comes from this one generator, never from clip
 * art: a rosette is a stack of hypotrochoids (the curve a geometric lathe cuts
 * into a banknote plate), a field is a stack of interfering sine waves.
 *
 * The rosette's geometry is computed once per app session in plate units and
 * scaled by the viewBox, so every card face and seal shares one path. On first
 * appearance the plate turns a slow quarter into place while it inks in (the
 * lathe, not a spinner); under Reduce Motion it is simply there.
 */

const EXTENT = 176;
/** Points per loop of each curve. Enough to read as a smooth engraving at card size. */
const STEPS_PER_TURN = 140;

let rosetteCache: string[] | null = null;
function rosetteLayers(): string[] {
  if (rosetteCache) return rosetteCache;
  rosetteCache = ROSETTE_LAYERS.map((layer) => {
    const full = rosettePoints(layer);
    const n = full.length / 2;
    const target = Math.max(2, Math.round((n / 260) * STEPS_PER_TURN));
    const stride = Math.max(1, Math.floor(n / target));
    let d = "";
    for (let i = 0; i < n; i += stride) {
      d += `${i === 0 ? "M" : "L"}${full[i * 2].toFixed(1)} ${full[i * 2 + 1].toFixed(1)}`;
    }
    d += `L${full[(n - 1) * 2].toFixed(1)} ${full[(n - 1) * 2 + 1].toFixed(1)}`;
    return d;
  });
  return rosetteCache;
}

function fieldPath(w: number, h: number): { d: string; opacity: number }[] {
  const lines = Math.max(18, Math.round(h / 9));
  const gap = h / lines;
  const out: { d: string; opacity: number }[] = [];
  for (let j = 0; j <= lines; j++) {
    const y0 = j * gap;
    const ph = j * 0.42;
    let d = "";
    for (let x = 0; x <= w; x += 4) {
      const y = y0 + gap * 1.6 * Math.sin(x / 58 + ph) + gap * 0.9 * Math.sin(x / 23 - ph * 1.7);
      d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)}`;
    }
    out.push({ d, opacity: 0.5 + 0.35 * Math.sin(j * 0.7) });
  }
  return out;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

export { useReduceMotion };

type Props = {
  variant?: "rosette" | "field";
  color: string;
  lineWidth?: number;
  opacity?: number;
  style?: ViewStyle;
  /** Ink the plate in on first appearance. */
  animate?: boolean;
  /** How long the plate takes to cut itself, in ms. */
  duration?: number;
};

export const Guilloche = memo(function Guilloche({
  variant = "rosette",
  color,
  lineWidth = 0.7,
  opacity = 1,
  style,
  animate = true,
  duration = 1800,
}: Props) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate || reduce) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, [animate, reduce, progress, duration]);

  if (variant === "field") {
    return <Field color={color} lineWidth={lineWidth} opacity={opacity} style={style} progress={progress} />;
  }

  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["-20deg", "0deg"] });
  const layers = rosetteLayers();
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[style, { opacity: Animated.multiply(progress, opacity), transform: [{ rotate }] }]}
    >
      <Svg width="100%" height="100%" viewBox={`${-EXTENT} ${-EXTENT} ${EXTENT * 2} ${EXTENT * 2}`}>
        <G fill="none" stroke={color} strokeLinejoin="round">
          {layers.map((d, i) => (
            <Path
              key={i}
              d={d}
              strokeWidth={lineWidth * 1.4}
              vectorEffect="non-scaling-stroke"
              opacity={i === 0 ? 0.9 : 0.55}
            />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
});

function Field({
  color,
  lineWidth,
  opacity,
  style,
  progress,
}: {
  color: string;
  lineWidth: number;
  opacity: number;
  style?: ViewStyle;
  progress: Animated.Value;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) {
      setSize({ w: Math.round(width), h: Math.round(height) });
    }
  };
  const lines = useMemo(() => (size ? fieldPath(size.w, size.h) : []), [size]);
  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={style}
    >
      {size ? (
        <Animated.View style={{ flex: 1, opacity: Animated.multiply(progress, opacity) }}>
          <Svg width={size.w} height={size.h}>
            <G fill="none" stroke={color} strokeWidth={lineWidth} strokeLinejoin="round">
              {lines.map((l, i) => (
                <Path key={i} d={l.d} opacity={l.opacity} />
              ))}
            </G>
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The rosette as SVG paths in plate units, for marks that draw it themselves (the Seal). */
export function rosettePlate(): { paths: string[]; extent: number } {
  return { paths: rosetteLayers(), extent: EXTENT };
}
