import { View, type ViewStyle } from "react-native";
import { meterFill } from "@cigua/core/papel/meter";
import { useColors } from "~/theme/theme";

const TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

/**
 * A ruled scale filled with ink. Over budget prints a red fill and a double rule
 * at the end; within sight of the limit prints a heavy base rule, so the state
 * never relies on colour alone.
 */
export function RuleMeter({
  used,
  total,
  label,
  overLabel,
  pct: truePct,
  near,
  style,
}: {
  used: number;
  total: number;
  label: string;
  overLabel?: string;
  pct?: number;
  near?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const { pct, over } = meterFill(used, total);
  const reported = Math.round(truePct ?? pct);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(pct),
        text: over && overLabel ? `${reported}%, ${overLabel}` : `${reported}%`,
      }}
      style={[{ height: 8, borderBottomWidth: near && !over ? 2 : 1, borderBottomColor: c.rule }, style]}
    >
      {TICKS.map((t) => (
        <View key={t} style={{ position: "absolute", top: 0, bottom: 0, left: `${t}%`, width: 1, backgroundColor: c.paperLine }} />
      ))}
      <View
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pct}%`, backgroundColor: over ? c.red : c.foreground }}
      />
      {over ? (
        <View
          style={{ position: "absolute", right: -4, top: -3, bottom: -3, width: 3, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.red }}
        />
      ) : null}
    </View>
  );
}
