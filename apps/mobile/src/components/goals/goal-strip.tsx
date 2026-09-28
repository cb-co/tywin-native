import { memo, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { useTranslations } from "use-intl";
import type { GoalCardRow } from "@cigua/worker/api";
import { goalStripCells, type GoalCell } from "@cigua/core/goals/strip";
import { useFeedback } from "~/lib/feedback";
import { useReduceMotion } from "~/components/papel/guilloche";
import { useColors } from "~/theme/theme";
import { goalProgressPct } from "./goal-progress";

const HATCH = [-8, -4, 0, 4, 8, 12, 16];

/** One strip cell: solid ink when backed, hatched when borrowed back, dashed when empty. */
function Cell({ kind, ink }: { kind: GoalCell; ink: string }) {
  return (
    <View
      style={{
        flex: 1,
        height: 12,
        borderRadius: 1,
        borderWidth: 1,
        borderColor: ink,
        borderStyle: kind === "empty" ? "dashed" : "solid",
        opacity: kind === "empty" ? 0.6 : 1,
        backgroundColor: kind === "solid" ? ink : "transparent",
        overflow: "hidden",
      }}
    >
      {kind === "borrowed" ? (
        <Svg width="100%" height="100%" viewBox="0 0 12 12" preserveAspectRatio="none">
          {HATCH.map((x) => (
            <Line key={x} x1={x} y1={12} x2={x + 12} y2={0} stroke={ink} strokeWidth={1.5} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * A goal's progress as twenty cells, all in ink (the goal's colour lives on its
 * stamp). Reaching the target bursts a frame around the strip and plays the
 * success sound, once per arrival: a goal already complete on load stays still.
 */
export const GoalStrip = memo(function GoalStrip({ goal, decorative }: { goal: GoalCardRow; decorative?: boolean }) {
  const t = useTranslations("Goals");
  const c = useColors();
  const reduce = useReduceMotion();
  const { playSuccess } = useFeedback();
  const pct = goalProgressPct(goal);
  const backedShare = goal.saved > 0 ? Math.min(goal.backed / goal.saved, 1) : 0;
  const cells = goalStripCells(pct, backedShare);
  const reached = goal.target_amount > 0 && goal.saved >= goal.target_amount;

  const wasReached = useRef(reached);
  const burst = useRef(new Animated.Value(0)).current;
  const sound = useRef(playSuccess);
  sound.current = playSuccess;

  useEffect(() => {
    if (reached === wasReached.current) return;
    wasReached.current = reached;
    if (!reached) return;
    sound.current();
    if (reduce) return;
    burst.setValue(0);
    Animated.timing(burst, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reached, reduce, burst]);

  return (
    <View style={{ marginTop: 12 }}>
      <View
        accessible={!decorative}
        accessibilityRole={decorative ? undefined : "image"}
        accessibilityLabel={decorative ? undefined : t("stripLabel", { pct: Math.round(pct) })}
        importantForAccessibility={decorative ? "no-hide-descendants" : "yes"}
        style={{ flexDirection: "row", gap: 4 }}
      >
        {cells.map((kind, i) => (
          <Cell key={i} kind={kind} ink={c.foreground} />
        ))}
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            margin: -4,
            borderRadius: 2,
            borderWidth: 2,
            borderColor: c.foreground,
            opacity: burst.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 0.65, 0] }),
            transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
          },
        ]}
      />
    </View>
  );
});
