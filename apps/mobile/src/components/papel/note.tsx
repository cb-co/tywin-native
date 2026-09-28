import { StyleSheet, View, type ViewStyle } from "react-native";
import { Text } from "~/components/ui/text";
import { Guilloche } from "./guilloche";
import { Microprint, Serial } from "./microprint";
import { useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";

/**
 * A screen's one banknote: the field the screen's main figure is printed on.
 * Violet or peso, never inverted by theme, never more than one per screen. The
 * line work is decoration; the label and figure are the content.
 */
export function Note({
  tone = "violet",
  label,
  serial,
  microprint,
  action,
  ornament = true,
  style,
  children,
}: {
  tone?: "violet" | "peso";
  label: string;
  serial?: string;
  /** Bilingual legend for the microprinted border; replaces the plain inner hairline. */
  microprint?: string;
  action?: React.ReactNode;
  ornament?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const c = useColors();
  const violet = tone === "violet";
  const ink = violet ? c.noteInk : c.pesoInk;
  const line = violet ? c.noteLine : c.pesoLine;
  return (
    <View style={[styles.note, { backgroundColor: violet ? c.note : c.peso }, style]}>
      {ornament ? (
        <Guilloche variant="field" color={ink} lineWidth={0.5} opacity={0.25} style={StyleSheet.absoluteFill} />
      ) : null}
      {microprint ? (
        <Microprint text={microprint} color={line} />
      ) : (
        <View pointerEvents="none" style={[styles.hairline, { borderColor: ink }]} />
      )}
      <Text legend size="xs" color={ink} style={[{ fontSize: 11 }, violet ? { opacity: 0.85 } : null]}>
        {label}
      </Text>
      <View style={{ marginTop: 8 }}>{children}</View>
      {action ? <View style={styles.action}>{action}</View> : null}
      {serial ? (
        <Serial value={serial} color={c.pesoLine} style={microprint ? { right: 24, top: 20 } : { right: 16, top: 12 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: radius.note, padding: 24, overflow: "hidden" },
  hairline: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 3,
    borderWidth: 1,
    opacity: 0.3,
  },
  action: { marginTop: 24, flexDirection: "row", flexWrap: "wrap", gap: 12 },
});
