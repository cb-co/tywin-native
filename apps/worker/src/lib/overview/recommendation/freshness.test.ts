import { describe, expect, it } from "vitest";
import { isStale, RECOMMENDATION_TTL_MS } from "./freshness";

const NOW = new Date("2026-08-11T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("isStale by age", () => {
  it("is fresh just inside the window", () => {
    expect(isStale(ago(RECOMMENDATION_TTL_MS - 60_000), "en", "en", NOW)).toBe(false);
  });

  it("is stale just outside the window", () => {
    expect(isStale(ago(RECOMMENDATION_TTL_MS + 60_000), "en", "en", NOW)).toBe(true);
  });

  // The boundary itself. Twelve hours old has USED its twelve hours.
  it("is stale exactly at the window", () => {
    expect(isStale(ago(RECOMMENDATION_TTL_MS), "en", "en", NOW)).toBe(true);
  });

  it("is stale for a timestamp it cannot parse", () => {
    expect(isStale("not a date", "en", "en", NOW)).toBe(true);
  });
});

/* The clause that stops someone who just switched to Spanish from reading
   English advice for the rest of the half-day window. */
describe("isStale by locale", () => {
  it("is stale when the text was written in another language", () => {
    expect(isStale(ago(60_000), "en", "es", NOW)).toBe(true);
  });

  it("is fresh when the language matches", () => {
    expect(isStale(ago(60_000), "es", "es", NOW)).toBe(false);
  });
});
