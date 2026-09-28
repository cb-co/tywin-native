import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, useWindowDimensions } from "react-native";
import { Guilloche, useReduceMotion } from "~/components/papel/guilloche";
import { Seal } from "~/components/papel/seal";
import { Wordmark } from "~/components/papel/wordmark";
import { useColors } from "~/theme/theme";

const HOLD_MS = 700;
const FADE_MS = 420;
let shown = false;

/**
 * The note that opens the app once per launch: the seal and wordmark on violet,
 * a rosette cutting itself behind them, then a fade into the shell. Skipped under
 * Reduce Motion and on every later mount.
 */
export function Splash() {
  const c = useColors();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(!shown);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!mounted) return;
    shown = true;
    if (reduce) {
      setMounted(false);
      return;
    }
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => setMounted(false));
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [mounted, reduce, opacity]);

  if (!mounted) return null;
  const plate = Math.min(width * 0.8, 448);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.note, opacity }]}
    >
      <Guilloche color={c.noteInk} opacity={0.4} duration={700} style={{ position: "absolute", width: plate, height: plate }} />
      {/* The seal alone is centred, so it sits in the plate's hollow; the
          wordmark hangs below it rather than sharing a column that would push
          the seal above the plate's centre. */}
      <View>
        <Seal size={80} />
        <View style={styles.wordmark}>
          <Wordmark height={22} color={c.noteInk} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  wordmark: { position: "absolute", top: "100%", left: -60, right: -60, alignItems: "center", marginTop: 16 },
});
