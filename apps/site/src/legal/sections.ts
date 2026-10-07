import type { Locale } from "@cigua/core/i18n/locale";
import { LEGAL_CONTACT_EMAIL, LEGAL_NAMESPACE, LEGAL_VALUES, legalOutline, legalUpdatedLabel, type LegalDoc } from "@cigua/core/legal";
import { pathFor } from "../i18n/paths";
import { translator } from "../i18n/t";

export const CONTACT_EMAIL = LEGAL_CONTACT_EMAIL;
export type { LegalDoc };
/** Paragraphs are HTML (some carry a link), rendered with set:html. */
export type Section = { title: string; paragraphs: string[] };

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c]);

export function lastUpdated(locale: Locale): string {
  return legalUpdatedLabel(locale);
}

/**
 * Terms and Privacy as sections, from the outline the app's legal screen also
 * renders (packages/core/src/legal.ts), so the two cannot drift.
 */
export function legalDoc(locale: Locale, doc: LegalDoc): { title: string; sections: Section[] } {
  const t = translator(locale, LEGAL_NAMESPACE[doc]);
  const k = t as unknown as { (key: string): string; markup: (key: string, values: Record<string, unknown>) => string };
  const tags = {
    privacyLink: (c: string) => `<a href="${pathFor(locale, "privacy")}">${c}</a>`,
    termsLink: (c: string) => `<a href="${pathFor(locale, "terms")}">${c}</a>`,
    link: (c: string) => `<a href="mailto:${CONTACT_EMAIL}">${c}</a>`,
  };
  const values = { entity: esc(LEGAL_VALUES.entity), email: esc(LEGAL_VALUES.email) };

  const sections = legalOutline(doc).map((s) => ({
    title: esc(k(`${s.key}.title`)),
    paragraphs: s.paragraphs.map((p) => k.markup(p, { ...values, ...tags })),
  }));
  return { title: k("title"), sections };
}
