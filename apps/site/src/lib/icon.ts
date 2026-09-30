/** A lucide-static SVG string, decorative: hidden from assistive tech, lucide's class dropped. */
export function icon(svg: string, strokeWidth?: number): string {
  let out = svg.trim().replace(/<svg([^>]*)>/, (_, attrs: string) => {
    const kept = attrs.replace(/\s+class="[^"]*"/, "");
    return `<svg${kept} aria-hidden="true" focusable="false">`;
  });
  if (strokeWidth !== undefined) out = out.replace(/stroke-width="[^"]*"/, `stroke-width="${strokeWidth}"`);
  return out;
}
