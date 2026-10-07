import en from "../messages/en.json";

/**
 * The Terms and the Privacy Policy, as the app and the website both render them.
 *
 * The copy lives in the message catalogue (`Terms`, `Privacy`); this module
 * holds the facts the copy refers to and the outline: which sections, in which
 * order, with which paragraphs. The outline is read from the English catalogue,
 * so adding a section or a paragraph is a copy change only; a test keeps the
 * Spanish catalogue in the same shape.
 *
 * Paragraphs are rich messages. Every paragraph is given the same values and
 * tags, and uses the ones it needs:
 *   {entity} {email}                 values
 *   <privacyLink> <termsLink> <link> tags (<link> wraps the contact email)
 */

/** Who "we" are. */
export const LEGAL_ENTITY = "Quantcore Solutions SRL";
export const LEGAL_CONTACT_EMAIL = "info.quantcoresolutions@gmail.com";
/** ISO date the documents last changed. Bump it with every change to the copy. */
export const LEGAL_UPDATED = "2026-10-06";

export type LegalDoc = "terms" | "privacy";
export const LEGAL_NAMESPACE = { terms: "Terms", privacy: "Privacy" } as const;
export const LEGAL_TAGS = ["privacyLink", "termsLink", "link"] as const;

export type LegalSection = {
  /** Message key of the section, e.g. "plans": its title is `plans.title`. */
  key: string;
  /** Message keys of its paragraphs, in order, e.g. ["plans.p1", "plans.p2"]. */
  paragraphs: string[];
};

export function legalOutline(doc: LegalDoc): LegalSection[] {
  const catalogue = en[LEGAL_NAMESPACE[doc]] as Record<string, unknown>;
  return Object.entries(catalogue)
    .filter((entry): entry is [string, Record<string, string>] => typeof entry[1] === "object" && entry[1] !== null)
    .map(([key, section]) => ({
      key,
      paragraphs: Object.keys(section)
        .filter((k) => /^p\d+$/.test(k))
        .map((k) => `${key}.${k}`),
    }));
}

/** The values every paragraph is formatted with. */
export const LEGAL_VALUES = { entity: LEGAL_ENTITY, email: LEGAL_CONTACT_EMAIL } as const;

/** "October 6, 2026" / "6 de octubre de 2026". */
export function legalUpdatedLabel(locale: string): string {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${LEGAL_UPDATED}T00:00:00Z`),
  );
}
