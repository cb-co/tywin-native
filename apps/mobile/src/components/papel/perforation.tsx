import { View, type ViewStyle } from "react-native";
import { perforationCells } from "@cigua/core/papel/perforation";
import { useColors } from "~/theme/theme";

/**
 * Cuotas as a perforated strip: paid cells print solid ink, unpaid ones are
 * outlined. `label` is the accessible reading ("3 de 12 cuotas"); pass
 * `decorative` when the same caption is already visible beside it.
 */
export function Perforation({
  total,
  paid,
  label,
  decorative,
  color,
  style,
}: {
  total: number;
  paid: number;
  label: string;
  decorative?: boolean;
  color?: string;
  style?: ViewStyle;
}) {
  const c = useColors();
  const ink = color ?? c.foreground;
  const { cells } = perforationCells(total, paid);
  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={decorative ? undefined : label}
      importantForAccessibility={decorative ? "no-hide-descendants" : "yes"}
      style={[{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 }, style]}
    >
      {cells.map((cell) => (
        <View
          key={cell.index}
          style={{
            width: 10,
            height: 12,
            borderRadius: 1,
            borderWidth: 1,
            borderColor: ink,
            backgroundColor: cell.paid ? ink : "transparent",
            borderStyle: cell.paid ? "solid" : "dashed",
            opacity: cell.paid ? 1 : 0.6,
          }}
        />
      ))}
    </View>
  );
}
