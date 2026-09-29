import { forwardRef } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type View as RNView,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "~/components/ui/icons";
import { Text } from "./text";
import { useColors, useTheme } from "~/theme/theme";
import { radius } from "~/theme/tokens";
import type { Palette } from "~/theme/tokens";

export type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link" | "brand";
export type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

const SIZES: Record<ButtonSize, { h: number; px: number; font: number; icon: number; r: number }> = {
  default: { h: 40, px: 20, font: 14, icon: 16, r: radius.sheet },
  xs: { h: 28, px: 12, font: 12, icon: 14, r: radius.control },
  sm: { h: 32, px: 16, font: 12.8, icon: 16, r: radius.control },
  lg: { h: 48, px: 28, font: 16, icon: 18, r: radius.sheet },
  icon: { h: 40, px: 0, font: 14, icon: 20, r: radius.sheet },
  "icon-xs": { h: 28, px: 0, font: 12, icon: 14, r: radius.control },
  "icon-sm": { h: 32, px: 0, font: 12, icon: 16, r: radius.control },
  "icon-lg": { h: 48, px: 0, font: 16, icon: 22, r: radius.sheet },
};

function palette(c: Palette, variant: ButtonVariant, dark: boolean, pressed: boolean) {
  switch (variant) {
    case "default":
      return {
        bg: pressed ? c.noteDeep : c.primary,
        fg: c.primaryForeground,
        border: dark ? c.noteLine : "transparent",
      };
    case "brand":
      return { bg: pressed ? c.noteDeep : c.note, fg: c.noteInk, border: dark ? c.noteLine : "transparent" };
    case "outline":
      return { bg: pressed ? c.muted : "transparent", fg: c.foreground, border: c.foreground };
    case "secondary":
      return { bg: pressed ? c.secondaryHover : c.secondary, fg: c.secondaryForeground, border: "transparent" };
    case "ghost":
      return { bg: pressed ? c.muted : "transparent", fg: c.foreground, border: "transparent" };
    case "destructive":
      return { bg: pressed ? c.red : "transparent", fg: pressed ? "#ffffff" : c.red, border: c.red };
    case "link":
      return { bg: "transparent", fg: c.brand, border: "transparent" };
  }
}

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: LucideIcon;
  /** Icon after the label instead of before it. */
  iconEnd?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Stretch to the container's width. */
  block?: boolean;
  textColor?: string;
};

/** A button: a small piece of note for the primary action, ink and paper for the rest. */
export const Button = forwardRef<RNView, ButtonProps>(function Button(
  {
    variant = "default",
    size = "default",
    isLoading = false,
    disabled,
    icon: Icon,
    iconEnd,
    children,
    style,
    block,
    textColor,
    accessibilityLabel,
    ...props
  },
  ref,
) {
  const c = useColors();
  const { scheme } = useTheme();
  const s = SIZES[size];
  const iconOnly = size.startsWith("icon");
  const isDisabled = disabled || isLoading;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: isLoading }}
      accessibilityLabel={accessibilityLabel}
      disabled={isDisabled}
      // Icon buttons draw small but always answer a 48dp touch (Material; above iOS's 44pt).
      hitSlop={iconOnly && s.h < 48 ? (48 - s.h) / 2 : undefined}
      {...props}
      style={({ pressed }) => {
        const p = palette(c, variant, scheme === "dark", pressed);
        return [
          styles.base,
          {
            height: variant === "link" ? undefined : s.h,
            minWidth: iconOnly ? s.h : undefined,
            width: iconOnly ? s.h : undefined,
            paddingHorizontal: variant === "link" ? 0 : s.px,
            borderRadius: variant === "brand" ? s.h / 2 : s.r,
            backgroundColor: p.bg,
            borderColor: p.border,
          },
          variant === "brand" ? styles.float : null,
          { shadowColor: c.shadowFloat },
          block ? styles.block : null,
          pressed && variant !== "link" ? styles.pressed : null,
          isDisabled ? styles.disabled : null,
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const p = palette(c, variant, scheme === "dark", pressed);
        const fg = textColor ?? p.fg;
        const iconEl = Icon ? <Icon size={s.icon} color={fg} strokeWidth={2} /> : null;
        return (
          <View style={styles.content}>
            {isLoading ? <ActivityIndicator size="small" color={fg} /> : !iconEnd ? iconEl : null}
            {typeof children === "string" || typeof children === "number" ? (
              <Text
                weight={600}
                color={fg}
                numberOfLines={1}
                style={[{ fontSize: s.font, lineHeight: s.font * 1.35 }, variant === "link" ? styles.underline : null]}
              >
                {children}
              </Text>
            ) : (
              children
            )}
            {!isLoading && iconEnd ? iconEl : null}
          </View>
        );
      }}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    alignSelf: "flex-start",
  },
  block: { alignSelf: "stretch" },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pressed: { transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.5 },
  underline: { textDecorationLine: "underline" },
  float: Platform.select({
    ios: { shadowOffset: { width: 0, height: 6 }, shadowRadius: 7, shadowOpacity: 1 },
    android: { elevation: 6 },
    default: {},
  }),
});
