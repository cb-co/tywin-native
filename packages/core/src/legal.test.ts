import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { LEGAL_NAMESPACE, LEGAL_TAGS, legalOutline, legalUpdatedLabel, type LegalDoc } from "./legal";

const DOCS: LegalDoc[] = ["terms", "privacy"];

function shape(o: Record<string, unknown>): unknown {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "object" && v ? shape(v as Record<string, unknown>) : typeof v]));
}

describe("legal outline", () => {
  it("reads every section in order, each with a title and at least one paragraph", () => {
    for (const doc of DOCS) {
      const outline = legalOutline(doc);
      expect(outline.length).toBeGreaterThan(10);
      const catalogue = en[LEGAL_NAMESPACE[doc]] as unknown as Record<string, Record<string, string>>;
      outline.forEach((s, i) => {
        expect(catalogue[s.key].title).toMatch(new RegExp(`^${i + 1}\\. `));
        expect(s.paragraphs.length).toBeGreaterThan(0);
      });
    }
  });

  it("is the same shape in Spanish", () => {
    for (const doc of DOCS) {
      expect(shape(es[LEGAL_NAMESPACE[doc]] as Record<string, unknown>)).toEqual(shape(en[LEGAL_NAMESPACE[doc]] as Record<string, unknown>));
    }
  });

  it("uses only the values and tags the renderers supply", () => {
    for (const catalogue of [en, es]) {
      for (const doc of DOCS) {
        const ns = catalogue[LEGAL_NAMESPACE[doc]] as Record<string, unknown>;
        for (const section of Object.values(ns)) {
          if (typeof section !== "object" || !section) continue;
          for (const text of Object.values(section as Record<string, string>)) {
            for (const [, name] of text.matchAll(/\{(\w+)\}/g)) expect(["entity", "email"]).toContain(name);
            for (const [, tag] of text.matchAll(/<\/?(\w+)>/g)) expect(LEGAL_TAGS).toContain(tag);
            // ICU would read a quote before a brace as an escape.
            expect(text).not.toMatch(/'\{/);
          }
        }
      }
    }
  });

  it("names the operator, the law and the contact in both languages", () => {
    for (const catalogue of [en, es]) {
      expect(catalogue.Terms.about.p1).toContain("{entity}");
      expect(catalogue.Terms.law.p1).toMatch(/Dominican Republic|República Dominicana/);
      expect(catalogue.Privacy.controller.p1).toContain("172-13");
      expect(catalogue.Privacy.ai.p1).toMatch(/Gemini/);
    }
  });

  it("formats the date in the reader's language", () => {
    expect(legalUpdatedLabel("en")).toBe("October 6, 2026");
    expect(legalUpdatedLabel("es")).toBe("6 de octubre de 2026");
  });
});
