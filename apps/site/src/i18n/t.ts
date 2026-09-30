import { createTranslator } from "use-intl/core";
import coreEn from "@cigua/core/messages/en.json";
import coreEs from "@cigua/core/messages/es.json";
import type { Locale } from "@cigua/core/i18n/locale";
import siteEn from "./en.json";
import siteEs from "./es.json";

export type Namespace = "Marketing" | "Legal" | "Privacy" | "Terms";

/* Legal copy is the app's own (packages/core), so the site and the app's
   legal screens can't drift. Marketing is the site's alone. */
const MESSAGES = {
  en: { Legal: coreEn.Legal, Privacy: coreEn.Privacy, Terms: coreEn.Terms, Marketing: siteEn.Marketing },
  es: { Legal: coreEs.Legal, Privacy: coreEs.Privacy, Terms: coreEs.Terms, Marketing: siteEs.Marketing },
} as const;

export const MARKETING: Record<Locale, Record<string, string>> = {
  en: siteEn.Marketing,
  es: siteEs.Marketing,
};

export function translator<N extends Namespace>(locale: Locale, namespace: N) {
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace,
    timeZone: "America/Santo_Domingo",
    // A missing key or a bad argument fails the build instead of printing the key.
    onError(error) {
      throw error;
    },
  });
}
