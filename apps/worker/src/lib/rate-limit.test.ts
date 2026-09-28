import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

const T0 = 1_800_000_000_000;

describe("createRateLimiter", () => {
  it("allows up to max inside the window, then refuses", () => {
    const l = createRateLimiter({ max: 3, windowMs: 1000 });
    expect([l.take("u", T0), l.take("u", T0 + 1), l.take("u", T0 + 2)]).toEqual([true, true, true]);
    expect(l.take("u", T0 + 3)).toBe(false);
  });

  it("forgets hits older than the window", () => {
    const l = createRateLimiter({ max: 1, windowMs: 1000 });
    l.take("u", T0);
    expect(l.take("u", T0 + 1001)).toBe(true);
  });

  it("counts keys separately and resets", () => {
    const l = createRateLimiter({ max: 1, windowMs: 1000 });
    l.take("a", T0);
    expect(l.take("b", T0)).toBe(true);
    l.reset();
    expect(l.take("a", T0)).toBe(true);
  });

  /* Two limiters must not share state: the Ask cap and the statement cap are different budgets. */
  it("keeps separate limiters independent", () => {
    const a = createRateLimiter({ max: 1, windowMs: 1000 });
    const b = createRateLimiter({ max: 1, windowMs: 1000 });
    a.take("u", T0);
    expect(b.take("u", T0)).toBe(true);
  });
});
