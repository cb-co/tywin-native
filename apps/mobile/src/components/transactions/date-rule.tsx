import { View } from "react-native";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

/** A month's heading: engraved caps over a heavy rule. */
export function MonthLegend({ label }: { label: string }) {
  const c = useColors();
  return (
    <View style={{ borderBottomWidth: 2, borderBottomColor: c.rule, paddingBottom: 6, backgroundColor: c.background }}>
      <Text legend accessibilityRole="header" style={{ fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

/** The date a run of rows shares: an engraved date over a full-width rule. Pinned while its rows scroll. */
export function DateRule({ label }: { label: string }) {
  const c = useColors();
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.rule, paddingVertical: 6, backgroundColor: c.background }}>
      <Text legend tone="muted" style={{ fontSize: 10 }}>
        {label}
      </Text>
    </View>
  );
}
