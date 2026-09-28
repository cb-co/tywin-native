import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { ProofMark } from "~/components/papel/proof-mark";
import { useReduceMotion } from "~/components/papel/guilloche";

/**
 * The large check printed across a finished sheet. `animate` is true only on the
 * transition into done; arriving at an already-finished triage shows it still.
 */
export function DoneStamp({ label, animate }: { label: string; animate: boolean }) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    if (reduce) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 520,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [animate, reduce, progress]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["-10deg", "-4deg"] });
  return (
    <Animated.View style={{ opacity: progress, transform: [{ scale }, { rotate }] }}>
      <ProofMark tone="ok" size="lg">
        {label}
      </ProofMark>
    </Animated.View>
  );
}
