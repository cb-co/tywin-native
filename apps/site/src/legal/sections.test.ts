import { describe, expect, it } from "vitest";
import { legalOutline } from "@cigua/core/legal";
import { CONTACT_EMAIL, lastUpdated, legalDoc } from "./sections";

describe("legalDoc", () => {
  it("renders every section of the shared outline", () => {
    for (const doc of ["terms", "privacy"] as const) {
      const outline = legalOutline(doc);
      for (const locale of ["en", "es"] as const) {
        const { sections } = legalDoc(locale, doc);
        expect(sections).toHaveLength(outline.length);
        sections.forEach((s, i) => expect(s.paragraphs).toHaveLength(outline[i].paragraphs.length));
      }
    }
  });

  it("links Terms → Privacy inside the reader's language", () => {
    expect(legalDoc("es", "terms").sections[0].paragraphs[1]).toContain('href="/privacy"');
    expect(legalDoc("en", "terms").sections[0].paragraphs[1]).toContain('href="/en/privacy"');
  });

  it("links the contact email and names the operator", () => {
    const terms = legalDoc("en", "terms").sections;
    expect(terms.at(-1)!.paragraphs[0]).toContain(`href="mailto:${CONTACT_EMAIL}"`);
    expect(terms[0].paragraphs[0]).toContain("Quantcore Solutions SRL");
    expect(legalDoc("es", "privacy").sections.at(-1)!.paragraphs[0]).toContain(`href="mailto:${CONTACT_EMAIL}"`);
  });

  it("leaves no ICU placeholder unfilled and no markup but links", () => {
    for (const locale of ["en", "es"] as const) {
      for (const doc of ["terms", "privacy"] as const) {
        for (const s of legalDoc(locale, doc).sections) {
          expect(s.title).not.toMatch(/[<{]/);
          for (const p of s.paragraphs) {
            expect(p).not.toMatch(/\{\w+/);
            expect(p).not.toMatch(/<(?!\/?a[\s>])/);
          }
        }
      }
    }
  });

  it("dates the documents in the reader's language", () => {
    expect(lastUpdated("es")).toMatch(/de \w+ de 2026/);
  });
});
