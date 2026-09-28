import { beforeEach, describe, expect, it } from "vitest";
import {
  ASK_MAX_PER_WINDOW,
  ASK_WINDOW_MS,
  resetAskRateLimit,
  takeAskToken,
} from "./rate-limit";

const T0 = 1_800_000_000_000;

beforeEach(resetAskRateLimit);

describe("takeAskToken", () => {
  it("allows a burst up to the cap", () => {
    for (let i = 0; i < ASK_MAX_PER_WINDOW; i++) {
      expect(takeAskToken("u1", T0 + i)).toBe(true);
    }
  });

  it("refuses the one after the cap", () => {
    for (let i = 0; i < ASK_MAX_PER_WINDOW; i++) takeAskToken("u1", T0 + i);
    expect(takeAskToken("u1", T0 + ASK_MAX_PER_WINDOW)).toBe(false);
  });

  it("forgets requests older than the window", () => {
    for (let i = 0; i < ASK_MAX_PER_WINDOW; i++) takeAskToken("u1", T0 + i);
    expect(takeAskToken("u1", T0 + ASK_WINDOW_MS + 1)).toBe(true);
  });

  /* One person hitting the cap must not lock anyone else out — the limiter is
     there to bound one person's spend, not the instance's. */
  it("counts each person separately", () => {
    for (let i = 0; i < ASK_MAX_PER_WINDOW; i++) takeAskToken("u1", T0 + i);
    expect(takeAskToken("u2", T0)).toBe(true);
  });

  it("keeps refusing while the burst is still inside the window", () => {
    for (let i = 0; i < ASK_MAX_PER_WINDOW; i++) takeAskToken("u1", T0 + i);
    expect(takeAskToken("u1", T0 + ASK_WINDOW_MS - 1)).toBe(false);
  });
});
