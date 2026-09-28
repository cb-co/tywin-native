import { forwardRef, useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { Text } from "./text";
import { face } from "~/theme/fonts";
import { useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";

/** A form label; `required` prints the asterisk the web form does. */
export function Label({ children, required, style }: { children: React.ReactNode; required?: boolean; style?: object }) {
  return (
    <Text size="sm" weight={500} style={style}>
      {children}
      {required ? <Text tone="destructive"> *</Text> : null}
    </Text>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Text size="xs" tone="destructive" accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" tone="muted">
      {children}
    </Text>
  );
}

/** Label, control, hint and error, stacked the way every form in the app sets them. */
export function Field({
  label,
  required,
  hint,
  error,
  children,
  style,
}: {
  label?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ gap: 8 }, style]}>
      {label ? <Label required={required}>{label}</Label> : null}
      {children}
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldError message={error} />
    </View>
  );
}

export type InputProps = TextInputProps & { invalid?: boolean; figure?: boolean };

/**
 * A baseline rule with the label above it, no box: the house field. Focus draws a
 * heavier rule in full ink.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { style, invalid, figure, onFocus, onBlur, editable = true, ...props },
  ref,
) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={c.mutedForeground}
      selectionColor={c.ring}
      editable={editable}
      maxFontSizeMultiplier={1.6}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.input,
        {
          color: c.foreground,
          borderBottomColor: invalid ? c.destructive : focused ? c.foreground : c.input,
          borderBottomWidth: focused ? 2 : 1,
          paddingBottom: focused ? 3 : 4,
          fontVariant: figure ? ["tabular-nums"] : undefined,
          opacity: editable ? 1 : 0.5,
        },
        style,
      ]}
      {...props}
    />
  );
});

/** Same surface as Input with a 3px box, for multi-line text. */
export const Textarea = forwardRef<TextInput, InputProps>(function Textarea({ style, invalid, ...props }, ref) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      multiline
      textAlignVertical="top"
      placeholderTextColor={c.mutedForeground}
      selectionColor={c.ring}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.textarea,
        { color: c.foreground, borderColor: invalid ? c.destructive : focused ? c.foreground : c.input },
        style,
      ]}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    minHeight: 36,
    paddingHorizontal: 0,
    paddingTop: 4,
    fontFamily: face(400),
    fontSize: 16,
  },
  textarea: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: face(400),
    fontSize: 16,
  },
});
