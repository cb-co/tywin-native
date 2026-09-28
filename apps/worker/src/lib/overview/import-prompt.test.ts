import { describe, expect, test } from "vitest";
import { importPromptState } from "./import-prompt";

const now = new Date("2026-08-18T12:00:00Z");

describe("importPromptState", () => {
  test("prompts a user with no cards at all", () => {
    expect(importPromptState([], now)).toBe("never");
  });

  test("prompts a user whose cards have never been imported", () => {
    expect(importPromptState([{ latest_period_end: null }], now)).toBe("never");
  });

  test("nags when every card's newest statement is older than the window", () => {
    expect(importPromptState([{ latest_period_end: "2026-07-01" }], now)).toBe("overdue");
  });

  test("stays quiet when a statement is recent", () => {
    expect(importPromptState([{ latest_period_end: "2026-08-08" }], now)).toBe("none");
  });

  test("stays quiet when any one card is current", () => {
    const cards = [{ latest_period_end: "2026-05-01" }, { latest_period_end: "2026-08-08" }];
    expect(importPromptState(cards, now)).toBe("none");
  });

  test("treats the window edge as still current", () => {
    // 35 days before 18 Aug is 14 Jul.
    expect(importPromptState([{ latest_period_end: "2026-07-14" }], now)).toBe("none");
  });
});
