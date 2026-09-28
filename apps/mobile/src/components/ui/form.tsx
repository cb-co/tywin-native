import { View } from "react-native";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, Input, Textarea, type InputProps } from "./field";
import { Select, type SelectOption } from "./select";
import { Switch } from "./switch";
import { DateField } from "./date-field";
import { Text } from "./text";

/**
 * react-hook-form bindings for the house fields. React Native has no uncontrolled
 * inputs to `register`, so every field is a Controller; these keep a form's body
 * reading like the web's field list rather than a wall of render props.
 */

type Base<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
};

/** Number-ish inputs keep the raw string, as the web's `<input type="number">` does. */
export function FormText<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  error,
  numeric,
  integer,
  multiline,
  transform,
  ...input
}: Base<T> &
  Omit<InputProps, "value" | "onChangeText"> & {
    numeric?: boolean;
    integer?: boolean;
    multiline?: boolean;
    /** Rewrites what was typed before it is stored (e.g. digits only). */
    transform?: (v: string) => string;
  }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const Comp = multiline ? Textarea : Input;
        return (
          <Field label={label} required={required} hint={hint} error={error ?? fieldState.error?.message}>
            <Comp
              value={field.value == null ? "" : String(field.value)}
              onChangeText={(v) => field.onChange(transform ? transform(v) : v)}
              onBlur={field.onBlur}
              invalid={!!fieldState.error}
              keyboardType={integer ? "number-pad" : numeric ? "decimal-pad" : input.keyboardType}
              figure={numeric || integer}
              {...input}
            />
          </Field>
        );
      }}
    />
  );
}

export function FormSelect<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  error,
  options,
  placeholder,
  disabled,
}: Base<T> & { options: SelectOption[]; placeholder?: string; disabled?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} hint={hint} error={error ?? fieldState.error?.message}>
          <Select
            value={field.value || null}
            onValueChange={field.onChange}
            options={options}
            placeholder={placeholder}
            title={label}
            disabled={disabled}
            invalid={!!fieldState.error}
          />
        </Field>
      )}
    />
  );
}

export function FormDate<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  error,
  disabled,
  placeholder,
}: Base<T> & { disabled?: boolean; placeholder?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} hint={hint} error={error ?? fieldState.error?.message}>
          <DateField
            value={field.value ?? ""}
            onChange={field.onChange}
            disabled={disabled}
            invalid={!!fieldState.error}
            accessibilityLabel={label}
            placeholder={placeholder}
          />
        </Field>
      )}
    />
  );
}

/** A label and a switch on one line, the way every toggle in the app sits. */
export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
  muted = true,
}: {
  label: string;
  hint?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text size="sm" tone={muted ? "muted" : "default"}>
          {label}
        </Text>
        {hint ? (
          typeof hint === "string" ? (
            <Text size="xs" tone="muted">
              {hint}
            </Text>
          ) : (
            hint
          )
        ) : null}
      </View>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} accessibilityLabel={label} />
    </View>
  );
}

export function FormSwitch<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  disabled,
  muted,
}: Base<T> & { disabled?: boolean; muted?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <SwitchRow label={label ?? ""} hint={hint} checked={!!field.value} onChange={field.onChange} disabled={disabled} muted={muted} />
      )}
    />
  );
}

/** Two fields side by side, the way the web's two-column grid pairs them. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 12 }}>{children}</View>;
}

export function Half({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, minWidth: 0 }}>{children}</View>;
}
