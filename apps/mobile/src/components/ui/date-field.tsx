import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { X } from "~/components/ui/icons";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { BottomSheet } from "./overlay";
import { Button } from "./button";
import { Text } from "./text";
import { useColors, useTheme } from "~/theme/theme";

/** `YYYY-MM-DD` to a local Date at noon, so no timezone can move it to another day. */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
}

export function localDateToIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Today, per the device's wall clock. */
export function todayLocal(): string {
  return localDateToIso(new Date());
}

/**
 * A calendar date on the house field (a baseline rule). Tapping opens the
 * platform's own date picker: the system dialog on Android, an inline calendar
 * on a slip on iOS. Dates are plain `YYYY-MM-DD`, as the server stores them.
 */
export function DateField({
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
  clearable,
  accessibilityLabel,
  minimumDate,
  maximumDate,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  accessibilityLabel?: string;
  minimumDate?: string;
  maximumDate?: string;
}) {
  const c = useColors();
  const { scheme } = useTheme();
  const locale = useLocale();
  const f = useFormatter();
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => (value ? isoToLocalDate(value) : new Date()));
  const label = value ? f.dateTime(isoToLocalDate(value), { dateStyle: "medium" }) : (placeholder ?? "");
  const min = minimumDate ? isoToLocalDate(minimumDate) : undefined;
  const max = maximumDate ? isoToLocalDate(maximumDate) : undefined;

  function openPicker() {
    const current = value ? isoToLocalDate(value) : new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        minimumDate: min,
        maximumDate: max,
        onChange: (event, date) => {
          if (event.type === "set" && date) onChange(localDateToIso(date));
        },
      });
      return;
    }
    setDraft(current);
    setOpen(true);
  }

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: invalid ? c.destructive : c.input,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ text: label }}
          disabled={disabled}
          onPress={openPicker}
          style={{ flex: 1, minHeight: 36, justifyContent: "center" }}
        >
          <Text size="base" tone={value ? "default" : "muted"} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
        {clearable && value && !disabled ? (
          <Pressable onPress={() => onChange("")} accessibilityRole="button" accessibilityLabel={t("none")} hitSlop={10}>
            <X size={16} color={c.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === "ios" ? (
        <BottomSheet open={open} onClose={() => setOpen(false)}>
          <View style={{ alignItems: "center" }}>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              locale={locale}
              themeVariant={scheme}
              accentColor={c.primary}
              minimumDate={min}
              maximumDate={max}
              onChange={(_e, date) => date && setDraft(date)}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
            <Button
              onPress={() => {
                onChange(localDateToIso(draft));
                setOpen(false);
              }}
            >
              {t("done")}
            </Button>
          </View>
        </BottomSheet>
      ) : null}
    </>
  );
}
