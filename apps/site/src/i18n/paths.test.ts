import { describe, expect, it } from "vitest";
import { otherLocale, pathFor } from "./paths";

describe("pathFor", () => {
  it.each([
    ["en", "home", "/"],
    ["en", "privacy", "/privacy"],
    ["en", "terms", "/terms"],
    ["es", "home", "/es"],
    ["es", "privacy", "/es/privacy"],
    ["es", "terms", "/es/terms"],
  ] as const)("%s %s → %s", (locale, page, path) => {
    expect(pathFor(locale, page)).toBe(path);
  });

  it("flips the locale", () => {
    expect(otherLocale("en")).toBe("es");
    expect(otherLocale("es")).toBe("en");
  });
});
