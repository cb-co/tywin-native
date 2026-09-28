import { describe, expect, it } from "vitest";
import { buildGoalHistory } from "./history";

const TODAY = new Date(2026, 7, 3); // 2026-08-03

const c = (amount: number, date: string) => ({
  base_amount: amount,
  occurred_at: `${date}T12:00:00+00:00`,
});

describe("buildGoalHistory", () => {
  it("carries a contribution that predates the window into the opening balance", () => {
    // Funded a year ago, untouched since: every month in the window reads 5000,
    // not a line that starts at 0 and jumps.
    const points = buildGoalHistory([c(5000, "2025-08-01")], { months: 6, today: TODAY });
    expect(points.map((p) => p.balance)).toEqual([5000, 5000, 5000, 5000, 5000, 5000]);
  });

  it("returns a flat zero line with no contributions", () => {
    const points = buildGoalHistory([], { months: 6, today: TODAY });
    expect(points.map((p) => p.balance)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("lets a withdrawal bring the line down", () => {
    const points = buildGoalHistory(
      [c(1000, "2026-05-10"), c(-400, "2026-06-15")],
      { months: 6, today: TODAY },
    );
    // Mar, Apr: 0. May: 1000. Jun, Jul, Aug: 600.
    expect(points.map((p) => p.balance)).toEqual([0, 0, 1000, 600, 600, 600]);
  });

  it("lets a withdrawal drive the balance negative", () => {
    const points = buildGoalHistory(
      [c(200, "2026-06-01"), c(-500, "2026-07-01")],
      { months: 6, today: TODAY },
    );
    // Mar-May: 0. Jun: 200. Jul, Aug: -300 after the withdrawal.
    expect(points.map((p) => p.balance)).toEqual([0, 0, 0, 200, -300, -300]);
  });

  it("excludes contributions dated in the future", () => {
    const points = buildGoalHistory(
      [c(1000, "2026-08-01"), c(9000, "2026-12-25")],
      { months: 6, today: TODAY },
    );
    // The December contribution must not count toward any earlier month.
    expect(points.every((p) => p.balance <= 1000)).toBe(true);
    expect(points.at(-1)!.balance).toBe(1000);
  });

  it("sums several contributions landing in the same month", () => {
    const points = buildGoalHistory(
      [c(100, "2026-08-01"), c(50, "2026-08-02"), c(25, "2026-08-03")],
      { months: 6, today: TODAY },
    );
    expect(points.at(-1)!.balance).toBe(175);
  });

  it("handles a first contribution that falls inside the window", () => {
    const points = buildGoalHistory([c(300, "2026-07-01")], { months: 6, today: TODAY });
    // Mar-Jun: 0. Jul, Aug: 300.
    expect(points.map((p) => p.balance)).toEqual([0, 0, 0, 0, 300, 300]);
  });

  it("returns `months` points, oldest first, with short-month labels ending at today's month", () => {
    const points = buildGoalHistory([], { months: 6, today: TODAY });
    expect(points).toHaveLength(6);
    expect(points.map((p) => p.month)).toEqual([
      "2026-03-01",
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ]);
    expect(points.at(-1)).toEqual({ month: "2026-08-01", label: "Aug", balance: 0 });
  });

  it("defaults to a 6-month window when opts are omitted", () => {
    const points = buildGoalHistory([], {});
    expect(points).toHaveLength(6);
  });
});
