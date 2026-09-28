import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { IntlProvider } from "use-intl";
import { getLocales } from "expo-localization";
import en from "@cigua/core/messages/en.json";
import es from "@cigua/core/messages/es.json";
import { isLocale, type Locale } from "@cigua/core/i18n/locale";
import { prefs, PREF } from "./storage";

const MESSAGES = { en, es } as const;

declare module "use-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}

/**
 * Spanish is the default for a new install: the product is Dominican by default,
 * not by setting. A device set to English opens in English; anything else opens
 * in Spanish. A choice made in the app always wins and is remembered.
 */
function initialLocale(): Locale {
  const stored = prefs.get(PREF.locale);
  if (isLocale(stored)) return stored;
  const device = getLocales()[0]?.languageCode ?? "es";
  return device === "en" ? "en" : "es";
}

type LocaleValue = { locale: Locale; setLocale: (l: Locale) => void };
const Ctx = createContext<LocaleValue | null>(null);

/** The app's language for this process, readable outside React (the API client sends it). */
let current: Locale = initialLocale();
export function currentLocale(): Locale {
  return current;
}

/** One message in the current language, for code that runs outside React (the API client). */
export function plainMessage(ns: "App", key: keyof (typeof en)["App"]): string;
export function plainMessage(ns: "Common", key: keyof (typeof en)["Common"]): string;
export function plainMessage(ns: "App" | "Common", key: string): string {
  return (MESSAGES[current][ns] as Record<string, string>)[key] ?? key;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setState] = useState<Locale>(current);

  const setLocale = useCallback((next: Locale) => {
    current = next;
    prefs.set(PREF.locale, next);
    setState(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <Ctx.Provider value={value}>
      <IntlProvider
        locale={locale}
        messages={MESSAGES[locale]}
        onError={() => {
          // A missing key renders the key path; the catalogues are checked at compile time.
        }}
      >
        {children}
      </IntlProvider>
    </Ctx.Provider>
  );
}

export function useAppLocale(): LocaleValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppLocale must be used within LocaleProvider");
  return ctx;
}
