import { Hono, type Context, type Next } from "hono";
import { contextStorage } from "hono/context-storage";
import { requestContextFor, type AppEnv } from "#/context";
import { createClient } from "#/lib/supabase/server";
import { getExchangeRates } from "#/lib/fx";
import { baseCurrencyOf } from "@cigua/core/profile";
import { actions } from "#/api";
import { screens } from "#/screens";
import { ask } from "#/routes/ask";
import { confirmStatementImport } from "#/actions/statements";
import { refreshRecommendation } from "#/actions/recommendation";

/**
 * Cigua's API.
 *
 *   GET  /v1/health
 *   GET  /v1/screens/:screen?…          one screen's data, in one response
 *   POST /v1/actions/:module/:name       { args: [...] } -> { data }
 *   POST /v1/statements/confirm          multipart: the echoed preview + mappings
 *   POST /v1/recommendation              regenerate today's take if stale
 *   GET  /v1/fx                          live rates into the caller's base currency
 *   POST /v1/ask                         one streamed turn of Ask
 *
 * Every route but health needs `Authorization: Bearer <supabase access token>`
 * and answers 401 `{ "error": "unauthorized" }` without a valid one: refresh the
 * session once and retry, then sign out. `Accept-Language: es|en` picks the
 * language of any copy the API writes (errors, today's take).
 */
const app = new Hono<AppEnv>();

/** Opens the per-request scope every server module reads its caller, locale and bindings from. */
app.use("*", contextStorage());
app.use("*", async (c, next) => {
  c.set("request", requestContextFor(c.req.raw.headers));
  await next();
});

/** Verifies the bearer token once, up front, so the app gets a status code it can act on. */
async function requireUser(c: Context<AppEnv>, next: Next) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return c.json({ error: "unauthorized" }, 401);
  await next();
}

const noStore = { "cache-control": "private, no-store" };

app.get("/v1/health", (c) => c.json({ ok: true }));

app.use("/v1/screens/*", requireUser);
app.use("/v1/actions/*", requireUser);
app.use("/v1/statements/*", requireUser);
app.use("/v1/recommendation", requireUser);
app.use("/v1/fx", requireUser);

app.get("/v1/screens/:screen", async (c) => {
  const name = c.req.param("screen");
  if (!Object.hasOwn(screens, name)) return c.json({ error: "not_found" }, 404);
  const loader = screens[name as keyof typeof screens] as (p: Record<string, string>) => Promise<unknown>;
  const data = await loader(c.req.query());
  if (data === null) return c.json({ error: "not_found" }, 404);
  return c.json({ data }, 200, noStore);
});

/** Functions that take a form are served by the multipart route below, not as JSON. */
const MULTIPART_ONLY = new Set(["statements.confirmStatementImport"]);

app.post("/v1/actions/:module/:name", async (c) => {
  const moduleName = c.req.param("module");
  const name = c.req.param("name");
  if (!Object.hasOwn(actions, moduleName) || MULTIPART_ONLY.has(`${moduleName}.${name}`)) {
    return c.json({ error: "not_found" }, 404);
  }
  const mod = actions[moduleName as keyof typeof actions] as Record<string, unknown>;
  const fn = Object.hasOwn(mod, name) ? mod[name] : undefined;
  if (typeof fn !== "function") return c.json({ error: "not_found" }, 404);

  const body = (await c.req.json().catch(() => null)) as { args?: unknown } | null;
  if (!body || !Array.isArray(body.args)) return c.json({ error: "invalid_body" }, 400);

  const result = await (fn as (...args: unknown[]) => Promise<unknown>)(...body.args);
  return c.json({ data: result ?? null }, 200, noStore);
});

app.post("/v1/statements/confirm", async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: "invalid_form" }, 400);
  return c.json(await confirmStatementImport(form), 200, noStore);
});

app.post("/v1/recommendation", async (c) => c.json(await refreshRecommendation(), 200, noStore));

/** Rates are public, but served only to signed-in callers so this cannot become an open proxy. */
app.get("/v1/fx", async (c) => {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("base_currency").maybeSingle();
  const base = baseCurrencyOf(profile);
  return c.json({ base, rates: await getExchangeRates(base) }, 200, noStore);
});

app.post("/v1/ask", (c) => ask(c.req.raw));

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
  console.error("[api]", err);
  return c.json({ error: "internal" }, 500);
});

export default app;
