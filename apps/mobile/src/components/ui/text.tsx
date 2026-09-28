import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { face, scale, type Size, type Weight, type Width } from "~/theme/fonts";
import { useColors } from "~/theme/theme";
import type { Palette } from "~/theme/tokens";

export type Tone =
  | "default"
  | "muted"
  | "primary"
  | "brand"
  | "destructive"
  | "teal"
  | "red"
  | "warning"
  | "noteInk"
  | "pesoInk"
  | "inherit";

function toneColor(c: Palette, tone: Tone): string | undefined {
  switch (tone) {
    case "default":
      return c.foreground;
    case "muted":
      return c.mutedForeground;
    case "primary":
      return c.primary;
    case "brand":
      return c.brand;
    case "destructive":
      return c.destructive;
    case "teal":
      return c.teal;
    case "red":
      return c.red;
    case "warning":
      return c.warning;
    case "noteInk":
      return c.noteInk;
    case "pesoInk":
      return c.pesoInk;
    case "inherit":
      return undefined;
  }
}

export type TextProps = RNTextProps & {
  size?: Size;
  weight?: Weight;
  width?: Width;
  tone?: Tone;
  /** Tabular, lining numerals: every amount, at any size (the Tabular Rule). */
  figure?: boolean;
  /** The engraved legend: expanded bold caps, 0.12em tracking. */
  legend?: boolean;
  /** Letter spacing in em, as the design specifies it. */
  tracking?: number;
  align?: TextStyle["textAlign"];
  color?: string;
};

/**
 * Every piece of text in the app. One face (Archivo), set by weight and width
 * rather than `fontWeight`, on Tailwind's scale so sizes read as the design does.
 */
export function Text({
  size = "sm",
  weight = 400,
  width = "normal",
  tone = "default",
  figure,
  legend,
  tracking,
  align,
  color,
  style,
  maxFontSizeMultiplier = 1.6,
  ...props
}: TextProps) {
  const c = useColors();
  const [fontSize, lineHeight] = scale[size];
  const fam = legend ? face(700, "expanded") : face(weight, width);
  const em = legend ? (tracking ?? 0.12) : tracking;
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...props}
      style={[
        {
          fontFamily: fam,
          fontSize,
          lineHeight,
          color: color ?? toneColor(c, tone),
          textAlign: align,
          letterSpacing: em !== undefined ? em * fontSize : undefined,
          textTransform: legend ? "uppercase" : undefined,
          fontVariant: figure ? ["tabular-nums", "lining-nums"] : undefined,
        },
        style,
      ]}
    />
  );
}
