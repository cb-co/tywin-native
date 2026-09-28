import { describe, expect, it } from "vitest";
import { computePace, type PaceInput } from "./pace";

const TODAY = new Date(2026, 7, 3); // 2026-08-03

const contrib = (amount: number, date: string) => ({
  base_amount: amount,
  occurred_at: `${date}T12:00:00+00:00`,
});

const input = (over: Partial<PaceInput> = {}): PaceInput => ({
  saved: 0,
  shortfall: 0,
  target: 1000,
  targetDate: null,
  contributions: [],
  today: TODAY,
  ...over,
});

describe("computePace — precedence", () => {
  it("reports a shortfall ahead of anything else", () => {
    // Even a completed goal is not really funded if money was borrowed back.
    expect(
      computePace(input({ saved: 1200, target: 1000, shortfall: 300 })),
    ).toEqual({ kind: "shortfall", amount: 300 });
  });

  it("reports completion once the target is reached and fully backed", () => {
    expect(computePace(input({ saved: 1000, target: 1000 }))).toEqual({ kind: "complete" });
  });

  it("reports overdue ahead of no-pace when the date has passed", () => {
    expect(
      computePace(input({ saved: 100, targetDate: "2026-06-30", contributions: [] })),
    ).toEqual({ kind: "overdue" });
  });

  it("reports no-pace when nothing has been contributed", () => {
    expect(computePace(input({ saved: 0, contributions: [] }))).toEqual({ kind: "no-pace" });
  });
});

describe("computePace — with a target date", () => {
  it("is on track when actual meets required", () => {
    // 800 saved of 1000, 5 months to Dec => need 40/mo. 390 over 3 months = 130/mo.
    const p = computePace(
      input({
        saved: 800,
        target: 1000,
        targetDate: "2026-12-31",
        contributions: [
          contrib(130, "2026-06-10"),
          contrib(130, "2026-07-10"),
          contrib(130, "2026-08-01"),
        ],
      }),
    );
    expect(p).toEqual({ kind: "on-track", required: 40, actual: 130 });
  });

  it("is behind when actual falls short of required", () => {
    // 100 of 1000, 3 months to Oct => need 300/mo. 30 over 3 months = 10/mo.
    const p = computePace(
      input({
        saved: 100,
        target: 1000,
        targetDate: "2026-10-31",
        contributions: [contrib(10, "2026-06-10"), contrib(20, "2026-07-10")],
      }),
    );
    expect(p).toEqual({ kind: "behind", required: 300, actual: 10 });
  });

  it("treats a target inside the current month as one month of runway", () => {
    const p = computePace(
      input({
        saved: 900,
        target: 1000,
        targetDate: "2026-08-28",
        contributions: [contrib(300, "2026-08-01")],
      }),
    );
    expect(p).toEqual({ kind: "on-track", required: 100, actual: 300 });
  });
});

describe("computePace — without a target date", () => {
  it("projects months remaining at the recent rate", () => {
    // 2400 of 10000 => 7600 to go at 200/mo => 38 months.
    const p = computePace(
      input({
        saved: 2400,
        target: 10000,
        contributions: [
          contrib(200, "2026-06-05"),
          contrib(200, "2026-07-05"),
          contrib(200, "2026-08-02"),
        ],
      }),
    );
    expect(p).toEqual({ kind: "projection", actual: 200, months: 38 });
  });

  it("rounds a partial month up", () => {
    const p = computePace(
      input({ saved: 0, target: 250, contributions: [contrib(100, "2026-08-01")] }),
    );
    // 100 over a single elapsed month = 100/mo; 250/100 = 2.5 => 3.
    expect(p).toEqual({ kind: "projection", actual: 100, months: 3 });
  });

  it("reports no-pace when withdrawals cancel the contributions out", () => {
    const p = computePace(
      input({
        saved: 0,
        target: 1000,
        contributions: [contrib(300, "2026-07-01"), contrib(-300, "2026-08-01")],
      }),
    );
    expect(p).toEqual({ kind: "no-pace" });
  });
});

describe("computePace — the averaging window", () => {
  it("averages over three months once the goal is that old", () => {
    const p = computePace(
      input({
        saved: 300,
        target: 5000,
        contributions: [
          contrib(300, "2026-01-05"), // outside the 3-month window
          contrib(300, "2026-06-05"),
          contrib(300, "2026-07-05"),
          contrib(300, "2026-08-05"),
        ],
      }),
    );
    expect(p.kind).toBe("projection");
    expect((p as { actual: number }).actual).toBe(300); // 900 / 3, January excluded
  });

  it("divides by the months actually elapsed for a young goal", () => {
    const p = computePace(
      input({ saved: 500, target: 5000, contributions: [contrib(500, "2026-08-01")] }),
    );
    // One month old: 500/1, not 500/3.
    expect((p as { actual: number }).actual).toBe(500);
  });
});
