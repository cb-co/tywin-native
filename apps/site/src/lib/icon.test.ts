import { describe, expect, it } from "vitest";
import { Check } from "lucide-static";
import { icon } from "./icon";

describe("icon", () => {
  it("hides the glyph from assistive tech and drops lucide's class", () => {
    const svg = icon(Check);
    expect(svg).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(svg).not.toMatch(/<svg[^>]*class=/);
  });

  it("sets the stroke width", () => {
    expect(icon(Check, 3)).toContain('stroke-width="3"');
  });
});
