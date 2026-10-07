import { describe, expect, it } from "vitest";
import { MARKETING, translator } from "./t";

describe("Marketing copy", () => {
  it("has the same keys in en and es", () => {
    expect(Object.keys(MARKETING.es).sort()).toEqual(Object.keys(MARKETING.en).sort());
  });

  it("dropped every web-login string", () => {
    for (const k of ["logIn", "getStarted", "haveAccount", "helpLink"]) {
      expect(MARKETING.en).not.toHaveProperty(k);
    }
  });
});

describe("translator", () => {
  it("interpolates values", () => {
    expect(translator("en", "Marketing")("cuotaBadge", { n: 4, total: 12 })).toBe("Cuota 4 of 12");
  });

  it("applies ICU plurals", () => {
    const t = translator("en", "Marketing");
    expect(t("cuotaLeft", { n: 1 })).toBe("1 cuota left");
    expect(t("cuotaLeft", { n: 8 })).toBe("8 cuotas left");
  });

  it("reads the legal namespaces from @cigua/core", () => {
    expect(translator("es", "Legal")("updated", { date: "X" })).toBe("Última actualización: X");
  });

  it("renders rich tags through markup", () => {
    const html = translator("en", "Terms").markup("data.p1", { privacyLink: (c) => `<a href="/privacy">${c}</a>` });
    expect(html).toContain('<a href="/privacy">');
  });

  it("throws on a missing key instead of printing it", () => {
    expect(() => translator("en", "Marketing")("noSuchKey" as never)).toThrow();
  });
});
