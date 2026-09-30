import type { Locale } from "@cigua/core/i18n/locale";

export type Page = "home" | "privacy" | "terms";

const SLUG: Record<Page, string> = { home: "", privacy: "privacy", terms: "terms" };

/** English is unprefixed; every other locale lives under /<locale>. No trailing slash. */
export function pathFor(locale: Locale, page: Page): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  const slug = SLUG[page];
  if (!slug) return prefix || "/";
  return `${prefix}/${slug}`;
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "es" : "en";
}
