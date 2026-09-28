import { View, type ViewStyle } from "react-native";
import { Text } from "./text";
import { useColors, useTheme } from "~/theme/theme";
import { radius } from "~/theme/tokens";

/** An outlined label in its own ink. */
export function Badge({
  children,
  variant = "default",
  style,
}: {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline";
  style?: ViewStyle;
}) {
  const c = useColors();
  const { scheme } = useTheme();
  const ink =
    variant === "default"
      ? scheme === "dark"
        ? c.noteLine
        : c.primary
      : variant === "destructive"
        ? c.destructive
        : variant === "secondary"
          ? c.secondaryForeground
          : c.foreground;
  return (
    <View
      style={[
        { borderWidth: 1, borderColor: ink, borderRadius: radius.control, paddingHorizontal: 8, height: 20, justifyContent: "center", alignSelf: "flex-start" },
        style,
      ]}
    >
      <Text size="xs" weight={500} color={ink} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}
