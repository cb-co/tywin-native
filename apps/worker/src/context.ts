import { getContext } from "hono/context-storage";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@cigua/core/supabase/types";
import { isLocale, localeFromAcceptLanguage, type Locale } from "@cigua/core/i18n/locale";
import type { Bindings } from "#/env";

/**
 * The request being served, available to any server module without threading it
 * through every call. Created once per request by the router's first middleware
 * and read through Hono's context storage.
 */
export type RequestContext = {
  /** The language the person picked in the app, sent as `Accept-Language`. */
  locale: Locale;
  /** The Supabase access token from `Authorization: Bearer`, unverified. */
  token: string | null;
  /** Built on first use and reused for the rest of the request. */
  supabase?: SupabaseClient<Database>;
};

export type AppEnv = { Bindings: Bindings; Variables: { request: RequestContext } };

export function bearerToken(authorization: string | null | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

export function requestContextFor(headers: Headers): RequestContext {
  const header = headers.get("accept-language");
  const explicit = header?.trim().toLowerCase();
  return {
    locale: isLocale(explicit) ? explicit : localeFromAcceptLanguage(header ?? null),
    token: bearerToken(headers.get("authorization")),
  };
}

export function currentRequest(): RequestContext {
  return getContext<AppEnv>().var.request;
}
