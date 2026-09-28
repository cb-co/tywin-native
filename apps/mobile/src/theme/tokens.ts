import tokens from "@cigua/core/tokens.json";

/**
 * Papel Moneda colour, per theme.
 *
 * Paper and ink are the only two things that invert. The note fields (violet,
 * peso) are fixed: a note never goes dark, and a primary button is a small piece
 * of note, so `primary` is note violet in both themes. Teal and red are the only
 * status colours; amber (`warning`) is the peso family used for attention.
 *
 * In dark, surfaces climb one unbroken ladder and no two rungs share a value:
 * background < card < muted < popover < accent < secondary < border < input.
 */
type Camel<S extends string> = S extends `${infer A}-${infer B}` ? `${A}${Capitalize<Camel<B>>}` : S;
type Camelized<T> = { [K in keyof T as K extends string ? Camel<K> : never]: T[K] };

function camelize<T extends Record<string, string>>(o: T): Camelized<T> {
  return Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()), v]),
  ) as Camelized<T>;
}

const fixed = camelize(tokens.fixed);

export const light = {
  ...fixed,
  ...camelize(tokens.light),
  background: "#eeebf5",
  foreground: "#1b1530",
  card: "#ffffff",
  cardForeground: "#1b1530",
  popover: "#ffffff",
  popoverForeground: "#1b1530",
  primary: "#4a1f8c",
  primaryForeground: "#f8f5ff",
  secondary: "#e4dff0",
  secondaryForeground: "#1b1530",
  secondaryHover: "#d9d2ea",
  muted: "#e4dff0",
  mutedForeground: "#544a6c",
  accent: "#e4dff0",
  accentForeground: "#1b1530",
  brand: "#4a1f8c",
  brandForeground: "#f8f5ff",
  brandMuted: "#e4dcf7",
  destructive: "#b3302a",
  destructiveForeground: "#ffffff",
  success: "#0e6e60",
  successForeground: "#ffffff",
  warning: "#a14a0f",
  warningForeground: "#ffffff",
  border: "#cdc3e3",
  input: "#544a6c",
  ring: "#4a1f8c",
  chart: ["#4a1f8c", "#7a5a00", "#0a7a6a", "#a2461e", "#8b3fa8", "#5f7a1c", "#1a6f9c", "#b03a68"],
  /** The FAB seal's one shadow. */
  shadowFloat: "rgba(43, 17, 87, 0.55)",
  scrim: "rgba(27, 21, 48, 0.4)",
};

export type Palette = typeof light;

export const dark: Palette = {
  ...fixed,
  ...camelize(tokens.dark),
  background: "#15111f",
  foreground: "#efebf8",
  card: "#1d1829",
  cardForeground: "#efebf8",
  muted: "#221c30",
  mutedForeground: "#b2a8c9",
  popover: "#282137",
  popoverForeground: "#efebf8",
  primary: "#4a1f8c",
  primaryForeground: "#f8f5ff",
  accent: "#2f2742",
  accentForeground: "#efebf8",
  secondary: "#372e4d",
  secondaryForeground: "#efebf8",
  secondaryHover: "#41375a",
  border: "#3b3252",
  input: "#4a4064",
  brand: "#a488ec",
  brandForeground: "#1b1530",
  brandMuted: "#2f2742",
  destructive: "#f0766c",
  destructiveForeground: "#1f0705",
  success: "#4fc2ae",
  successForeground: "#04140b",
  warning: "#ffb27a",
  warningForeground: "#1f0e22",
  ring: "#a488ec",
  chart: ["#a488ec", "#D88C1F", "#2FB39D", "#F36549", "#BA6DDC", "#97AA48", "#35A8E1", "#ED5B85"],
  shadowFloat: "rgba(0, 0, 0, 0.7)",
  scrim: "rgba(0, 0, 0, 0.55)",
};

/** Engraved, not rounded: sheets are cut paper. */
export const radius = {
  /** Small controls and badges. */
  control: 3,
  /** Sheets, buttons, dialogs. */
  sheet: 4,
  /** A banknote. */
  note: 6,
  /** A card face (the physical object). */
  card: 18,
};

/** Motion tokens (ms). Motion only animates transform and opacity. */
export const duration = { fast: 160, base: 380, slow: 620 };
