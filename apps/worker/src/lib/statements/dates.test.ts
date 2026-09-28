import { describe, expect, it } from "vitest";
import { ddmmyyyyToIso, monthBeforePlusDay } from "./dates";

describe("ddmmyyyyToIso", () => {
  it("parses slash and dash forms", () => {
    expect(ddmmyyyyToIso("25/06/2026")).toBe("2026-06-25");
    expect(ddmmyyyyToIso("15-07-2026")).toBe("2026-07-15");
  });
});

describe("monthBeforePlusDay", () => {
  it("computes the day after the previous cutoff", () => {
    expect(monthBeforePlusDay("2026-06-25")).toBe("2026-05-26");
    expect(monthBeforePlusDay("2027-01-10")).toBe("2026-12-11");
  });
  it("clamps to the previous month's last day when the cutoff day overflows it", () => {
    expect(monthBeforePlusDay("2026-03-30")).toBe("2026-03-01"); // Feb clamps to 28
    expect(monthBeforePlusDay("2026-05-31")).toBe("2026-05-01"); // Apr clamps to 30
    expect(monthBeforePlusDay("2026-01-31")).toBe("2026-01-01");
  });
});
