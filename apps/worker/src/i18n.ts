import { createTranslator } from "use-intl/core";
import en from "@cigua/core/messages/en.json";
import es from "@cigua/core/messages/es.json";
import type { Locale } from "@cigua/core/i18n/locale";
import { currentRequest } from "./context";

/**
 * Copy the API writes itself: translated errors, today's take, statement warnings.
 * Same catalogue and formatter as the app, in the language the app sent.
 */
const MESSAGES = { en, es } as const;
export type Messages = typeof en;

export async function getLocale(): Promise<Locale> {
  return currentRequest().locale;
}

export async function getMessages(): Promise<Messages> {
  return MESSAGES[await getLocale()];
}

type Namespace = keyof Messages;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTranslations(namespace?: Namespace | { locale?: Locale; namespace?: Namespace }): Promise<any> {
  const ns = typeof namespace === "string" ? namespace : namespace?.namespace;
  const locale = (typeof namespace === "object" && namespace.locale) || (await getLocale());
  return createTranslator({ locale, messages: MESSAGES[locale], namespace: ns });
}
