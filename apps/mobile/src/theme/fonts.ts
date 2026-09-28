/**
 * Archivo, the one face, cut two ways like an engraver's plate: the normal cut
 * for reading, the expanded cut for the printed legend and the denomination.
 *
 * React Native cannot drive a variable font's width axis, so the widths ship as
 * static instances (assets/fonts, embedded at build time by the expo-font plugin).
 * Each file's family name is its file name, so one name works on iOS and Android.
 * Always set a family, never `fontWeight`: Android would synthesise a fake bold.
 */
export type Weight = 400 | 500 | 600 | 700 | 800 | 900;
export type Width = "normal" | "semi" | "expanded";

const NORMAL: Record<Weight, string> = {
  400: "Archivo-Regular",
  500: "Archivo-Medium",
  600: "Archivo-SemiBold",
  700: "Archivo-Bold",
  800: "Archivo-ExtraBold",
  900: "Archivo-ExtraBold",
};

const SEMI: Record<Weight, string> = {
  400: "ArchivoSemiExpanded-SemiBold",
  500: "ArchivoSemiExpanded-SemiBold",
  600: "ArchivoSemiExpanded-SemiBold",
  700: "ArchivoSemiExpanded-Bold",
  800: "ArchivoSemiExpanded-ExtraBold",
  900: "ArchivoSemiExpanded-ExtraBold",
};

const EXPANDED: Record<Weight, string> = {
  400: "ArchivoExpanded-SemiBold",
  500: "ArchivoExpanded-SemiBold",
  600: "ArchivoExpanded-SemiBold",
  700: "ArchivoExpanded-Bold",
  800: "ArchivoExpanded-ExtraBold",
  900: "ArchivoExpanded-Black",
};

export function face(weight: Weight = 400, width: Width = "normal"): string {
  return (width === "expanded" ? EXPANDED : width === "semi" ? SEMI : NORMAL)[weight];
}

/** Tailwind's type scale, which the design was set in: [fontSize, lineHeight]. */
export const scale = {
  "2xs": [10, 14],
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
  xl: [20, 28],
  "2xl": [24, 32],
  "3xl": [30, 36],
  "4xl": [36, 40],
  "5xl": [48, 50],
  "6xl": [60, 62],
} as const;

export type Size = keyof typeof scale;
