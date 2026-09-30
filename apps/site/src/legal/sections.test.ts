import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL, legalDoc } from "./sections";

describe("legalDoc", () => {
  it("has the web and app's section counts", () => {
    expect(legalDoc("en", "terms").sections).toHaveLength(9);
    expect(legalDoc("en", "privacy").sections).toHaveLength(8);
    expect(legalDoc("en", "privacy").sections[0].paragraphs).toHaveLength(2);
  });

  it("links Terms → Privacy inside the reader's language", () => {
    expect(legalDoc("es", "terms").sections[5].paragraphs[0]).toContain('href="/privacy"');
    expect(legalDoc("en", "terms").sections[5].paragraphs[0]).toContain('href="/en/privacy"');
  });

  it("links the contact email", () => {
    expect(legalDoc("en", "terms").sections[8].paragraphs[0]).toContain(`href="mailto:${CONTACT_EMAIL}"`);
    expect(legalDoc("es", "privacy").sections[7].paragraphs[0]).toContain(`href="mailto:${CONTACT_EMAIL}"`);
  });

  it("leaves no ICU placeholder unfilled", () => {
    for (const locale of ["en", "es"] as const) {
      for (const doc of ["terms", "privacy"] as const) {
        for (const s of legalDoc(locale, doc).sections) {
          for (const p of s.paragraphs) expect(p).not.toMatch(/\{\w+/);
        }
      }
    }
  });

  it("escapes plain paragraphs", () => {
    for (const s of legalDoc("en", "privacy").sections.slice(1, 7)) {
      expect(s.paragraphs[0]).not.toMatch(/<(?!\/?a[\s>])/);
    }
  });
});
