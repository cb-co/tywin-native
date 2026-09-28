import { useState } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { Check, ChevronDown } from "~/components/ui/icons";
import { BottomSheet } from "./overlay";
import { Text } from "./text";
import { makeStyles, useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  /** Rendered before the label in the list (a stamp, an emoji). */
  lead?: React.ReactNode;
  disabled?: boolean;
  /** Options sharing a group print under one heading, in the order given. */
  group?: string;
};

/**
 * A select: a boxed trigger showing the chosen label; tapping it opens a chooser
 * slip listing every option, the chosen one ticked and set heavier.
 */
export function Select<T extends string>({
  value,
  onValueChange,
  options,
  placeholder,
  title,
  disabled,
  invalid,
  style,
  accessibilityLabel,
}: {
  value: T | null | undefined;
  onValueChange: (v: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  invalid?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const s = useStyles();
  const c = useColors();
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityValue={{ text: chosen?.label ?? placeholder }}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          s.trigger,
          invalid ? { borderColor: c.destructive } : null,
          pressed ? { borderColor: c.foreground } : null,
          disabled ? { opacity: 0.5 } : null,
          style,
        ]}
      >
        {chosen?.lead}
        <Text size="sm" tone={chosen ? "default" : "muted"} numberOfLines={1} style={{ flex: 1 }}>
          {chosen?.label ?? placeholder ?? ""}
        </Text>
        <ChevronDown size={16} color={c.mutedForeground} />
      </Pressable>
      <OptionSheet open={open} onClose={() => setOpen(false)} title={title} options={options} value={value} onChoose={onValueChange} />
    </>
  );
}

/** The chooser slip on its own, for a picker opened by something other than a boxed trigger. */
export function OptionSheet<T extends string>({
  open,
  onClose,
  title,
  options,
  value,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  options: SelectOption<T>[];
  value?: T | null;
  onChoose: (v: T) => void;
}) {
  const s = useStyles();
  const c = useColors();
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {options.map((o, i) => {
        const selected = o.value === value;
        const heading = o.group && o.group !== options[i - 1]?.group ? o.group : null;
        return (
          <View key={o.value}>
            {heading ? (
              <Text legend tone="muted" style={{ fontSize: 10, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 4 }}>
                {heading}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="menuitem"
              accessibilityState={{ selected, disabled: o.disabled }}
              disabled={o.disabled}
              onPress={() => {
                onClose();
                onChoose(o.value);
              }}
              style={({ pressed }) => [
                s.item,
                i < options.length - 1 ? s.itemRule : null,
                pressed ? { backgroundColor: c.accent } : null,
                o.disabled ? { opacity: 0.5 } : null,
              ]}
            >
              {o.lead}
              <Text size="sm" weight={selected ? 600 : 400} style={{ flex: 1 }}>
                {o.label}
              </Text>
              {selected ? <Check size={16} color={c.foreground} /> : null}
            </Pressable>
          </View>
        );
      })}
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  trigger: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: c.input,
    borderRadius: radius.control,
    paddingLeft: 10,
    paddingRight: 8,
  },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 8 },
  itemRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
}));
