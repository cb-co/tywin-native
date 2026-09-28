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
