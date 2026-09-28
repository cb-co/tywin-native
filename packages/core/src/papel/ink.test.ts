import { describe, it, expect } from "vitest";
import { stampInk, STAMP_SURFACE } from "./ink";
import { contrastRatio } from "../color";
import { SWATCHES } from "../palette";

const HOSTILE = ["#ffffff", "#fafafa", "#eeebf5", "#000000", "#111111", "#1d1829", "#ffff00", "#7f7f7f"];

describe("stampInk", () => {
  it("clears 3:1 on the light paper for any hex", () => {
    for (const hex of [...HOSTILE, ...SWATCHES]) {
      expect(contrastRatio(stampInk(hex, STAMP_SURFACE.light), STAMP_SURFACE.light), hex).toBeGreaterThanOrEqual(3);
    }
  });
  it("clears 3:1 on the dark paper for any hex", () => {
    for (const hex of [...HOSTILE, ...SWATCHES]) {
      expect(contrastRatio(stampInk(hex, STAMP_SURFACE.dark), STAMP_SURFACE.dark), hex).toBeGreaterThanOrEqual(3);
    }
  });
  it("leaves a colour that already passes untouched", () => {
    expect(stampInk("#4a1f8c", STAMP_SURFACE.light)).toBe("#4a1f8c");
  });
});
