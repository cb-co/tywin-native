/** Tailwind size for the note's denomination figure, by printed length, so
 *  eight digits plus `RD$` scales down on a 360px phone instead of wrapping.
 *
 *  Width model: every printed character is budgeted at 0.66em (Archivo
 *  expanded, extrabold, tabular, -0.03em tracking; the real cents render at
 *  0.6em so this is conservative). Content widths, note padding and page
 *  gutter subtracted, plus a 15px allowance:
 *    base (<640px)  265px (measured at 360px)
 *    sm+ (>=640px)  392px, the tightest case being md (768px viewport, 256px
 *                   sidebar, 48px main padding, 56px note padding); 640px has
 *                   ~537px and lg and up more, so md binds the `sm:` size.
 *  Base size fits when 0.66 * n * px <= 265, the `sm:` size when <= 392.
 *  The smallest step is text-xl; a figure past 20 characters stays there. */
export function fitFigureClass(text: string): string {
  const n = text.length;
  if (n <= 8) return "text-5xl sm:text-6xl";
  if (n <= 9) return "text-4xl sm:text-6xl";
  if (n <= 11) return "text-4xl sm:text-5xl";
  if (n <= 12) return "text-3xl sm:text-5xl";
  if (n <= 13) return "text-3xl sm:text-4xl";
  if (n <= 16) return "text-2xl sm:text-4xl";
  if (n <= 19) return "text-xl sm:text-3xl";
  return "text-xl sm:text-2xl";
}
