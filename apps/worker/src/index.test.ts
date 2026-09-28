import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const maybeSingle = vi.fn();
vi.mock("#/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ maybeSingle }) }),
  })),
}));
vi.mock("#/lib/fx", () => ({ getExchangeRates: vi.fn(async () => ({ DOP: 1, USD: 0.016 })) }));
vi.mock("#/actions/statements", () => ({
  parseStatement: vi.fn(async () => ({ preview: { parserId: "p" } })),
  confirmStatementImport: vi.fn(async () => ({ importId: "imp-1", uncategorized: 2 })),
  deleteCardStatement: vi.fn(async (id: string) => ({ deleted: id })),
}));
vi.mock("#/actions/recommendation", () => ({
  refreshRecommendation: vi.fn(async () => ({ refreshed: true })),
}));
vi.mock("#/actions/transactions", () => ({
  createTransaction: vi.fn(async (input: unknown) => ({ id: "t1", echo: input })),
}));
vi.mock("#/screens", () => ({
  screens: {
    session: vi.fn(async () => ({ email: "a@b.c" })),
    goal: vi.fn(async (p: Record<string, string>) => (p.id === "g1" ? { id: "g1" } : null)),
  },
}));
vi.mock("#/routes/ask", () => ({ ask: vi.fn(async () => new Response("stream")) }));

import app from "./index";
import { confirmStatementImport, parseStatement } from "#/actions/statements";
import { createTransaction } from "#/actions/transactions";

const signedIn = () => getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
const signedOut = () => getUser.mockResolvedValue({ data: { user: null } });
const auth = { authorization: "Bearer token", "accept-language": "es" };

function call(path: string, init: RequestInit = {}) {
  return app.request(path, { ...init, headers: { ...auth, ...(init.headers ?? {}) } });
}

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: { base_currency: "DOP" } });
});

describe("API router", () => {
  it("answers health without a session", async () => {
    signedOut();
    const res = await app.request("/v1/health");
    expect(res.status).toBe(200);
  });

  it.each([
    ["GET", "/v1/screens/session"],
    ["POST", "/v1/actions/transactions/createTransaction"],
    ["POST", "/v1/statements/confirm"],
    ["POST", "/v1/recommendation"],
    ["GET", "/v1/fx"],
  ])("%s %s answers 401 when signed out", async (method, path) => {
    signedOut();
    const res = await call(path, { method });
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("serves a screen's data", async () => {
    signedIn();
    const res = await call("/v1/screens/session");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { email: "a@b.c" } });
  });

  it("404s a screen whose subject does not exist, and an unknown screen", async () => {
    signedIn();
    expect((await call("/v1/screens/goal?id=nope")).status).toBe(404);
    expect((await call("/v1/screens/goal?id=g1")).status).toBe(200);
    expect((await call("/v1/screens/constructor")).status).toBe(404);
  });

  it("dispatches an action with its JSON arguments", async () => {
    signedIn();
    const res = await call("/v1/actions/transactions/createTransaction", {
      method: "POST",
      body: JSON.stringify({ args: [{ amount: 5 }] }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(200);
    expect(createTransaction).toHaveBeenCalledWith({ amount: 5 });
    await expect(res.json()).resolves.toEqual({ data: { id: "t1", echo: { amount: 5 } } });
  });

  it("refuses unknown actions, inherited properties and the upload-only functions", async () => {
    signedIn();
    const post = (path: string) =>
      call(path, { method: "POST", body: JSON.stringify({ args: [] }), headers: { "content-type": "application/json" } });
    expect((await post("/v1/actions/transactions/nope")).status).toBe(404);
    expect((await post("/v1/actions/nope/createTransaction")).status).toBe(404);
    expect((await post("/v1/actions/transactions/toString")).status).toBe(404);
    expect((await post("/v1/actions/__proto__/constructor")).status).toBe(404);
    expect((await post("/v1/actions/statements/confirmStatementImport")).status).toBe(404);
    expect((await post("/v1/actions/statements/deleteCardStatement")).status).toBe(200);
  });

  it("rejects an action body without an args array", async () => {
    signedIn();
    const res = await call("/v1/actions/transactions/createTransaction", {
      method: "POST",
      body: JSON.stringify({ input: 1 }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("reads a statement's text through the actions route", async () => {
    signedIn();
    const input = { text: "15/08  UBER  100.00", fileName: "s.pdf", accountId: "a1" };
    const res = await call("/v1/actions/statements/parseStatement", {
      method: "POST",
      body: JSON.stringify({ args: [input] }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(200);
    expect(parseStatement).toHaveBeenCalledWith(input);
  });

  it("hands the multipart confirm form to the importer", async () => {
    signedIn();
    const fd = new FormData();
    fd.append("account_id", "a1");
    const res = await call("/v1/statements/confirm", { method: "POST", body: fd });
    expect(res.status).toBe(200);
    expect(confirmStatementImport).toHaveBeenCalledOnce();
  });

  it("serves rates in the caller's base currency", async () => {
    signedIn();
    const res = await call("/v1/fx");
    await expect(res.json()).resolves.toEqual({ base: "DOP", rates: { DOP: 1, USD: 0.016 } });
  });
});
