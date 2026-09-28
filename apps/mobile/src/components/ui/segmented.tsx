import { Pressable, View, type ViewStyle } from "react-native";
import { Text } from "./text";
import { makeStyles } from "~/theme/theme";

/** Two or three positions on one muted track; the chosen one is a paper chip. */
export function Segmented<T extends string>({
  value,
  onChange,
  items,
  disabled,
  size = "xs",
  stretch,
  style,
}: {
  value: T;
  onChange: (v: T) => void;
  items: readonly { value: T; label: string }[];
  disabled?: boolean;
  size?: "xs" | "sm";
  /** Equal-width positions across the full row. */
  stretch?: boolean;
  style?: ViewStyle;
}) {
  const s = useStyles();
  return (
    <View accessibilityRole="radiogroup" style={[s.track, stretch ? null : { alignSelf: "flex-start" }, style]}>
      {items.map((item) => {
        const on = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled }}
            disabled={disabled}
            onPress={() => item.value !== value && onChange(item.value)}
            style={[s.option, stretch ? { flex: 1 } : null, size === "sm" ? s.optionSm : null, on ? s.on : null]}
          >
            <Text size={size} weight={500} tone={on ? "default" : "muted"} align="center" numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  track: { flexDirection: "row", gap: 4, borderRadius: 8, backgroundColor: c.muted, padding: 4 },
  option: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
  optionSm: { paddingHorizontal: 12, paddingVertical: 8 },
  on: { backgroundColor: c.card },
}));
