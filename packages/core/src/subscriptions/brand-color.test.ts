import { describe, expect, it } from "vitest";
import { hasBrandColor } from "./brand-color";
import { readableForeground } from "../color";

describe("hasBrandColor", () => {
  it("accepts a 6-digit hex in either case", () => {
    expect(hasBrandColor("#E50914")).toBe(true);
    expect(hasBrandColor("#1db954")).toBe(true);
  });

  it("rejects the absent cases, so the mark falls back to the theme token", () => {
    expect(hasBrandColor(null)).toBe(false);
    expect(hasBrandColor(undefined)).toBe(false);
    expect(hasBrandColor("")).toBe(false);
  });

  // Shorthand and named colours must not pass: the mark styles from this value
  // and measures its foreground against it, and "#FFF" parses as a blue.
  it.each(["#FFF", "red", "rgb(1,2,3)", "#1234567"])("rejects %o", (color) => {
    expect(hasBrandColor(color)).toBe(false);
  });
});

// The point of measuring rather than assuming: brand colours span the full
// lightness range, unlike the mid-to-dark card accents.
describe("the mark's letter stays readable across brand colours", () => {
  it.each([
    ["#E50914", "#ffffff"], // Netflix red
    ["#1DB954", "#14141c"], // Spotify green — light enough that white fails
    ["#000000", "#ffffff"], // a genuinely black brand
    ["#F5C518", "#14141c"], // a pale yellow
  ])("puts a legible letter on %s", (fill, expected) => {
    expect(readableForeground(fill)).toBe(expected);
  });
});
