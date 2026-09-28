import { describe, expect, it } from "vitest";
import { asTone, toneColor } from "./tone";

describe("toneColor", () => {
  it.each([
    ["good", "var(--success)"],
    ["watch", "var(--warning)"],
    ["neutral", "var(--brand)"],
  ])("maps %s to %s", (tone, expected) => {
    expect(toneColor(tone)).toBe(expected);
  });

  /* The tone arrives from a model and then from a text column. The schema and
     the check constraint both narrow it, but neither runs on a row already
     written, so a value outside the set must render as something rather than
     paint the tile `undefined`. */
  it("falls back to the neutral colour for anything else", () => {
    expect(toneColor("magenta")).toBe("var(--brand)");
  });
});

describe("asTone", () => {
  it("passes through a known tone", () => {
    expect(asTone("watch")).toBe("watch");
  });

  it("narrows an unknown tone to neutral", () => {
    expect(asTone("URGENT")).toBe("neutral");
  });
});
