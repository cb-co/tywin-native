import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { Text } from "./text";
import { makeStyles } from "~/theme/theme";

/**
 * Tabs as a ruled strip: the active tab is marked by a 2px ink rule and a heavier
 * weight, not by fill, so it reads without colour.
 */
export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  style,
  scrollable,
}: {
  value: T;
  onValueChange: (v: T) => void;
  items: { value: T; label: string; disabled?: boolean }[];
  style?: ViewStyle;
  scrollable?: boolean;
}) {
  const s = useStyles();
  const row = (
    <View style={[s.list, scrollable ? null : { alignSelf: "stretch" }]} accessibilityRole="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: item.disabled }}
            disabled={item.disabled}
            onPress={() => onValueChange(item.value)}
            style={[s.tab, scrollable ? null : { flex: 1 }, active ? s.active : null, item.disabled ? { opacity: 0.5 } : null]}
          >
            <Text size="sm" weight={active ? 600 : 500} tone={active ? "default" : "muted"} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  return scrollable ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>
      {row}
    </ScrollView>
  ) : (
    <View style={style}>{row}</View>
  );
}

const useStyles = makeStyles((c) => ({
  list: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.paperLine,
  },
  tab: {
    height: 36,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -StyleSheet.hairlineWidth,
  },
  active: { borderBottomColor: c.foreground },
}));
