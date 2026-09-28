import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { LucideIcon } from "~/components/ui/icons";
import { BottomSheet } from "./overlay";
import { Text } from "./text";
import { makeStyles, useColors } from "~/theme/theme";

export type MenuItem = {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

/**
 * A row of actions behind one trigger, as a chooser slip. `trigger` receives the
 * function that opens it.
 */
export function Menu({
  trigger,
  items,
  title,
}: {
  trigger: (open: () => void) => React.ReactNode;
  items: MenuItem[];
  title?: string;
}) {
  const s = useStyles();
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        {items.map((item, i) => {
          const color = item.destructive ? c.destructive : c.foreground;
          return (
            <Pressable
              key={item.label}
              accessibilityRole="menuitem"
              disabled={item.disabled}
              onPress={() => {
                setOpen(false);
                // After the slip closes, so a follow-up dialog does not stack on it.
                setTimeout(item.onPress, 180);
              }}
              style={({ pressed }) => [
                s.item,
                i < items.length - 1 ? s.rule : null,
                pressed ? { backgroundColor: c.accent } : null,
                item.disabled ? { opacity: 0.5 } : null,
              ]}
            >
              {item.icon ? <item.icon size={18} color={color} /> : <View style={{ width: 0 }} />}
              <Text size="sm" color={color}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </BottomSheet>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 8 },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
}));
