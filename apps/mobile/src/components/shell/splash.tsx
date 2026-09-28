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
 * The note that opens the app once per launch: a small seal in a framed rosette
 * that cuts itself around it, the wordmark below, then a fade into the shell. Skipped under
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
  // A medallion: the seal, small and in hairline, in the hollow of a rosette
  // framed by one ring, like a banknote's engraved seal (web: splash.tsx).
  const frame = Math.min(width * 0.72, 304);
  const plate = frame - 12;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.note, opacity }]}
    >
      <View
        style={[
          styles.center,
          { width: frame, height: frame, borderRadius: frame / 2, borderWidth: 1, borderColor: c.noteInk + "b3" },
        ]}
      >
        <Guilloche
          color={c.noteInk}
          opacity={0.6}
          lineWidth={0.9}
          duration={700}
          style={{ position: "absolute", width: plate, height: plate }}
        />
        {/* The seal alone is centred, so it sits in the plate's hollow; the
            wordmark hangs below the medallion rather than sharing a column
            that would push the seal off the screen's centre. */}
        <Seal size={40} fine />
        <View style={styles.wordmark}>
          <Wordmark height={22} color={c.noteInk} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  wordmark: { position: "absolute", top: "100%", left: 0, right: 0, alignItems: "center", marginTop: 24 },
});
