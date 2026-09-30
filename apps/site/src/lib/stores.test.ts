import { describe, expect, it } from "vitest";
import { storeBadges } from "./stores";

describe("storeBadges", () => {
  it("renders an empty URL as a non-link", () => {
    expect(storeBadges({ appStore: "", googlePlay: "  " })).toEqual([
      { id: "appStore", href: null },
      { id: "googlePlay", href: null },
    ]);
  });

  it("links a set URL", () => {
    const url = "https://play.google.com/store/apps/details?id=x";
    expect(storeBadges({ appStore: "", googlePlay: url })[1]).toEqual({ id: "googlePlay", href: url });
  });

  it("fails the build on a URL without https://", () => {
    expect(() => storeBadges({ appStore: "apps.apple.com/app/id1", googlePlay: "" })).toThrow(/appStore/);
  });
});
