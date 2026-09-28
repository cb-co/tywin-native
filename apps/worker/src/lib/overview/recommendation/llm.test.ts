import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("#/lib/llm/gemini", () => ({ gemini: vi.fn(() => "model"), defaultModelId: () => "gemini-3.5-flash-lite" }));

import { generateObject } from "ai";
import { gemini } from "#/lib/llm/gemini";
import { setTestBindings } from "#/env";
import { inferRecommendation } from "./llm";
import type { RecommendationSnapshot } from "./snapshot";

const snapshot: RecommendationSnapshot = {
  asOf: "2026-08-11",
  dayOfMonth: 11,
  daysLeftInMonth: 20,
  baseCurrency: "USD",
  netWorth: 12480,
  monthIncome: 4201,
  monthExpense: 2811,
  monthlyRecurringExpenses: 65,
  monthlyRecurringCardPayments: 0,
  monthlyRecurringIncome: 0,
  budgets: [{ category: "Dining", budget: 400, used: 320 }],
  accounts: [{ type: "savings", currency: "USD", balance: 4000 }],
  loans: [],
  goals: [],
  upcoming: [],
  trend: {
    monthToDate: { income: 4201, expense: 2811 },
    lastMonthSamePoint: { income: 4000, expense: 2300 },
    lastMonthExpense: 6900,
    projectedMonthExpense: 7922,
    savingsRatePct: 33,
  },
  topCategories: [{ category: "Dining", used: 320, lastMonthUsed: 211 }],
};

const mockReturn = (object: unknown) =>
  (generateObject as unknown as Mock).mockResolvedValue({ object });

const lastCall = () => (generateObject as unknown as Mock).mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inferRecommendation success", () => {
  it("returns the three fields", async () => {
    mockReturn({ headline: "Dining is running hot", body: "You are 80% through it.", tone: "watch" });
    expect(await inferRecommendation(snapshot, "en")).toEqual({
      headline: "Dining is running hot",
      body: "You are 80% through it.",
      tone: "watch",
    });
  });

  it("trims whitespace the model padded its answer with", async () => {
    mockReturn({ headline: "  Steady month  ", body: " Nothing needs attention. ", tone: "good" });
    expect(await inferRecommendation(snapshot, "en")).toMatchObject({
      headline: "Steady month",
      body: "Nothing needs attention.",
    });
  });

  /* The schema narrows `tone` to three strings, but a schema is a request, not
     a guarantee, and this value goes straight into a column with a CHECK on it.
     Narrowing here is what stops a refused insert from throwing away a good
     headline and body. */
  it("narrows a tone outside the set rather than failing", async () => {
    mockReturn({ headline: "Steady month", body: "Nothing needs attention.", tone: "URGENT" });
    expect(await inferRecommendation(snapshot, "en")).toMatchObject({ tone: "neutral" });
  });
});

/**
 * Every way of coming back empty returns null, and the caller writes nothing.
 * A missing recommendation is a missing nicety — the card simply does not
 * render — so none of these is worth surfacing.
 */
describe("inferRecommendation comes back null rather than throwing", () => {
  it.each([
    ["an empty headline", { headline: "", body: "Something.", tone: "good" }],
    ["a whitespace headline", { headline: "   ", body: "Something.", tone: "good" }],
    ["an empty body", { headline: "Steady month", body: "", tone: "good" }],
  ])("on %s", async (_label, object) => {
    mockReturn(object);
    expect(await inferRecommendation(snapshot, "en")).toBeNull();
  });

  it("when the call failed", async () => {
    (generateObject as unknown as Mock).mockRejectedValue(new Error("boom"));
    expect(await inferRecommendation(snapshot, "en")).toBeNull();
  });

  // An overrun is not special-cased: a slow guess is the same as no guess.
  it("when the call was aborted", async () => {
    (generateObject as unknown as Mock).mockRejectedValue(
      Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }),
    );
    expect(await inferRecommendation(snapshot, "en")).toBeNull();
  });
});

describe("inferRecommendation call shape", () => {
  it("bounds the call with an abort signal", async () => {
    mockReturn({ headline: "Steady month", body: "Nothing needs attention.", tone: "good" });
    await inferRecommendation(snapshot, "en");
    expect(lastCall().abortSignal).toBeInstanceOf(AbortSignal);
  });

  /* The text is GENERATED in a language, not translated into one, so the
     language has to reach the model. Naming it in the system prompt is the
     whole mechanism — there is nothing downstream that could correct it. */
  it("names the language in the system prompt", async () => {
    mockReturn({ headline: "Mes tranquilo", body: "Nada requiere atención.", tone: "good" });
    await inferRecommendation(snapshot, "es");
    expect(lastCall().system).toContain("Spanish");
  });

  it("falls back to English for a locale it does not know", async () => {
    mockReturn({ headline: "Steady month", body: "Nothing needs attention.", tone: "good" });
    await inferRecommendation(snapshot, "fr");
    expect(lastCall().system).toContain("English");
  });

  it("sends the snapshot as the prompt", async () => {
    mockReturn({ headline: "Steady month", body: "Nothing needs attention.", tone: "good" });
    await inferRecommendation(snapshot, "en");
    expect(lastCall().prompt).toContain("Dining");
  });
});

describe("inferRecommendation recent history", () => {
  const recent = [
    { headline: "Dining is running hot", body: "You are 80% through it." },
    { headline: "Savings on pace", body: "The trip fund is on track." },
  ];

  beforeEach(() => {
    mockReturn({ headline: "Steady month", body: "Nothing needs attention.", tone: "good" });
  });

  it("sends the recent recommendations alongside the snapshot", async () => {
    await inferRecommendation(snapshot, "en", null, recent);
    const prompt = JSON.parse(lastCall().prompt);
    expect(prompt.snapshot.baseCurrency).toBe("USD");
    expect(prompt.recentRecommendations).toEqual(recent);
  });

  it("tells the model not to repeat them", async () => {
    await inferRecommendation(snapshot, "en", null, recent);
    expect(lastCall().system).toMatch(/recentRecommendations/);
  });

  it("sends an empty list when there is no history yet", async () => {
    await inferRecommendation(snapshot, "en");
    expect(JSON.parse(lastCall().prompt).recentRecommendations).toEqual([]);
  });
});

/* The card is written by whichever model lib/llm/owner.ts picks; everything else
   about the call is identical, which is why only the model id is asserted. */
describe("inferRecommendation model choice", () => {
  const asked = () => (gemini as unknown as Mock).mock.calls[0][0];

  beforeEach(() => {
    setTestBindings({ OWNER_EMAIL: "me@example.com" });
    mockReturn({ headline: "Steady month", body: "Nothing needs attention.", tone: "good" });
  });
  afterEach(() => {
    setTestBindings(null);
  });

  it("uses the owner model for the owner", async () => {
    await inferRecommendation(snapshot, "en", "me@example.com");
    expect(asked()).toBe("gemini-3.7-flash");
  });

  it("uses the shared model for anyone else", async () => {
    await inferRecommendation(snapshot, "en", "someone@example.com");
    expect(asked()).toBe("gemini-3.5-flash-lite");
  });

  it("uses the shared model when no email is passed at all", async () => {
    await inferRecommendation(snapshot, "en");
    expect(asked()).toBe("gemini-3.5-flash-lite");
  });
});
