/**
 * Series colours for a chart whose slices have no identity colour of their own.
 *
 * These are theme tokens, not literal hex, which is what separates them from
 * `SWATCHES` in lib/palette.ts: a swatch is stored on a row and has to survive a
 * theme switch, whereas these are picked at render time and should follow the
 * theme. Reach for them only as a *fallback* — a category that carries a stored
 * colour always draws in that colour, so the same category keeps one identity
 * across every chart in the app.
 */
export const CHART_FALLBACK = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];
