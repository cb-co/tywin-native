import { describe, expect, it } from "vitest";
import { atLimit, FREE_STATUS, isLimitFeature, parsePlanStatus, remaining, showsAds } from "./plans";

const sample = {
  plan: "pro",
  expiresAt: "2027-01-01T00:00:00Z",
  features: {
    accounts: { limit: null, period: null, used: 9 },
    ask: { limit: 100, period: "day", used: 100 },
    credit_cards: { limit: 2, period: null, used: 1 },
  },
};

describe("parsePlanStatus", () => {
  it("reads what plan_status() returns", () => {
    const s = parsePlanStatus(sample);
    expect(s.plan).toBe("pro");
    expect(s.expiresAt).toBe("2027-01-01T00:00:00Z");
    expect(s.features.ask).toEqual({ limit: 100, period: "day", used: 100 });
    expect(s.features.accounts?.limit).toBeNull();
  });

  it("falls back to Free on anything unreadable", () => {
    expect(parsePlanStatus(null)).toEqual(FREE_STATUS);
    expect(parsePlanStatus("pro")).toEqual(FREE_STATUS);
    expect(parsePlanStatus({ plan: "platinum" }).plan).toBe("free");
  });

  it("drops malformed features rather than guessing", () => {
    const s = parsePlanStatus({ plan: "free", features: { ask: 5, goals: { limit: "2", used: 1 } } });
    expect(s.features.ask).toBeUndefined();
    expect(s.features.goals).toEqual({ limit: null, period: null, used: 1 });
  });
});

describe("limits", () => {
  const s = parsePlanStatus(sample);

  it("knows when one more would be refused", () => {
    expect(atLimit(s, "ask")).toBe(true);
    expect(atLimit(s, "credit_cards")).toBe(false);
    expect(atLimit(s, "accounts")).toBe(false);
    expect(atLimit(s, "loans")).toBe(false);
  });

  it("counts what is left", () => {
    expect(remaining(s, "credit_cards")).toBe(1);
    expect(remaining(s, "ask")).toBe(0);
    expect(remaining(s, "accounts")).toBeNull();
  });

  it("shows ads to Free only", () => {
    expect(showsAds("free")).toBe(true);
    expect(showsAds("pro")).toBe(false);
  });

  it("recognises limit features", () => {
    expect(isLimitFeature("loans")).toBe(true);
    expect(isLimitFeature("ask")).toBe(false);
  });
});
