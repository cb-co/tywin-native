import type { Locale } from "@cigua/core/i18n/locale";
import { pathFor } from "../i18n/paths";
import { translator } from "../i18n/t";

export const LAST_UPDATED = "July 20, 2026";
export const CONTACT_EMAIL = "info.quantcoresolutions@gmail.com";

export type LegalDoc = "privacy" | "terms";
/** Paragraphs are HTML (some carry a link), rendered with set:html. */
export type Section = { title: string; paragraphs: string[] };

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c]);
const mailto = (chunks: string) => `<a href="mailto:${CONTACT_EMAIL}">${chunks}</a>`;

/** Terms and Privacy as sections, mirroring apps/mobile/src/app/legal/[doc].tsx. */
export function legalDoc(locale: Locale, doc: LegalDoc): { title: string; sections: Section[] } {
  if (doc === "terms") {
    const t = translator(locale, "Terms");
    const k = t as unknown as (key: string) => string;
    const sections = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({
      title: esc(k(`s${i}Title`)),
      paragraphs: [
        i === 6
          ? t.markup("s6Body", { privacyLink: (c) => `<a href="${pathFor(locale, "privacy")}">${c}</a>` })
          : i === 9
            ? t.markup("s9Body", { email: CONTACT_EMAIL, link: mailto })
            : esc(k(`s${i}Body`)),
      ],
    }));
    return { title: t("title"), sections };
  }

  const t = translator(locale, "Privacy");
  const k = t as unknown as (key: string) => string;
  const sections: Section[] = [
    { title: esc(t("s1Title")), paragraphs: [esc(t("s1Body1")), esc(t("s1Body2"))] },
    ...[2, 3, 4, 5, 6, 7].map((i) => ({ title: esc(k(`s${i}Title`)), paragraphs: [esc(k(`s${i}Body`))] })),
    { title: esc(t("s8Title")), paragraphs: [t.markup("s8Body", { email: CONTACT_EMAIL, link: mailto })] },
  ];
  return { title: t("title"), sections };
}
