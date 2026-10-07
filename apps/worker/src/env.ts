import { tryGetContext } from "hono/context-storage";

/** The Worker's configuration: vars in wrangler.jsonc, secrets via `wrangler secret put`. */
export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  /** Secret. */
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  /** Every structured-output call (statements, card art, brands, today's take). */
  GOOGLE_MODEL?: string;
  /** The Ask loop. */
  GOOGLE_ASK_MODEL?: string;
  /** Secret. The one account whose Ask and today's take run on OWNER_MODEL. */
  OWNER_EMAIL?: string;
  OWNER_MODEL?: string;
  /** "1" logs each Ask query's purpose and SQL. Local development only. */
  ASK_TRACE?: string;
  /**
   * Secret. Signs each Ask statement so `ask_query` runs nothing the guard has
   * not seen. Must equal the Vault secret `ask_query_secret` (see
   * supabase/migrations/20261006120000_ask_query_signed.sql).
   */
  ASK_QUERY_SECRET?: string;
  /**
   * Sign in with Apple token revocation on account deletion (App Store
   * guideline 5.1.1(v)). The key is the .p8 from Apple Developer → Keys with
   * "Sign in with Apple" enabled, PEM text included. Secrets. Without all four,
   * deletion still works and revocation is skipped.
   */
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  /** The app's bundle ID, which is the client ID for native Sign in with Apple. */
  APPLE_CLIENT_ID?: string;
};

let testBindings: Partial<Bindings> | null = null;

/** One binding for the request being served. Undefined outside a request (and when unset). */
export function env<K extends keyof Bindings>(name: K): Bindings[K] | undefined {
  if (testBindings) return testBindings[name];
  return tryGetContext<{ Bindings: Bindings }>()?.env?.[name];
}

/** Test seam: pin the bindings `env()` returns. `null` restores the real ones. */
export function setTestBindings(values: Partial<Bindings> | null): void {
  testBindings = values;
}
