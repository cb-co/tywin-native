import { View, type ViewStyle } from "react-native";
import { useColors } from "~/theme/theme";

const TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

/** A ruled track filled with ink, like RuleMeter without the over-budget states. */
export function Progress({ value, style, label }: { value: number; style?: ViewStyle; label?: string }) {
  const c = useColors();
  const pct = Math.min(100, Math.max(0, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[{ height: 8, borderBottomWidth: 1, borderBottomColor: c.rule, overflow: "hidden" }, style]}
    >
      {TICKS.map((t) => (
        <View key={t} style={{ position: "absolute", top: 0, bottom: 0, left: `${t}%`, width: 1, backgroundColor: c.paperLine }} />
      ))}
      <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pct}%`, backgroundColor: c.foreground }} />
    </View>
  );
}
