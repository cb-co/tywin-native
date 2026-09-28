import { Pressable, View } from "react-native";
import { useColors, useTheme } from "~/theme/theme";

/** On in note violet, off on paper line. The thumb is paper. */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  accessibilityLabel,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const { scheme } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={12}
      onPress={() => onCheckedChange(!checked)}
      style={{
        width: 40,
        height: 23,
        borderRadius: 12,
        padding: 2,
        justifyContent: "center",
        backgroundColor: checked ? c.primary : c.paperLine,
        borderWidth: 1,
        borderColor: checked ? c.primary : c.mutedForeground,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 17,
          height: 17,
          borderRadius: 9,
          backgroundColor: scheme === "dark" ? (checked ? c.primaryForeground : c.foreground) : c.background,
          transform: [{ translateX: checked ? 17 : 0 }],
        }}
      />
    </Pressable>
  );
}
