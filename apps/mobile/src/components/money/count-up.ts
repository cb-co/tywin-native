import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Long enough to read as counting, short enough not to delay the real number. */
const DURATION = 900;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animates a number up to `value`, for the one or two figures a screen is about.
 * Inert when disabled (a masked figure has nothing legible to count) and under
 * Reduce Motion. A later change slides from wherever the last count finished,
 * and it always lands exactly on the target.
 */
export function useCountUp(value: number, enabled: boolean): number {
  const [shown, setShown] = useState<number | null>(null);
  const from = useRef(0);

  useEffect(() => {
    if (!enabled) {
      from.current = value;
      return;
    }
    let frame = 0;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        from.current = value;
        return;
      }
      const start = from.current;
      const delta = value - start;
      if (delta === 0) return;
      let t0: number | null = null;
      const step = (now: number) => {
        t0 ??= now;
        const p = Math.min(1, (now - t0) / DURATION);
        const current = start + delta * easeOut(p);
        from.current = current;
        if (p < 1) {
          setShown(current);
          frame = requestAnimationFrame(step);
        } else {
          from.current = value;
          setShown(null);
        }
      };
      frame = requestAnimationFrame(step);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [value, enabled]);

  return enabled && shown !== null ? shown : value;
}
