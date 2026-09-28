import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
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
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.note, opacity }]}
    >
      <Guilloche color={c.noteInk} opacity={0.3} lineWidth={0.6} style={styles.rosette} />
      <View style={styles.center}>
        <Seal size={84} rosette />
        <View style={{ marginTop: 16 }}>
          <Wordmark height={30} color={c.noteInk} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  rosette: { position: "absolute", width: 520, height: 520 },
});
