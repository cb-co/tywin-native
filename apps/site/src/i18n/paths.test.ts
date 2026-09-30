import { describe, expect, it } from "vitest";
import { otherLocale, pathFor } from "./paths";

describe("pathFor", () => {
  it.each([
    ["es", "home", "/"],
    ["es", "privacy", "/privacy"],
    ["es", "terms", "/terms"],
    ["en", "home", "/en"],
    ["en", "privacy", "/en/privacy"],
    ["en", "terms", "/en/terms"],
  ] as const)("%s %s → %s", (locale, page, path) => {
    expect(pathFor(locale, page)).toBe(path);
  });

  it("flips the locale", () => {
    expect(otherLocale("en")).toBe("es");
    expect(otherLocale("es")).toBe("en");
  });
});
