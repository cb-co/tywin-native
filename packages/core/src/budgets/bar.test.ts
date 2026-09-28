import { describe, it, expect } from "vitest";
import { barPct, meterArgs } from "./bar";
import { meterFill } from "../papel/meter";

describe("barPct", () => {
  it("is the fraction of the budget used", () => {
    expect(barPct(250, 500)).toBe(50);
  });

  it("clamps to the track rather than overflowing it", () => {
    expect(barPct(900, 500)).toBe(100);
  });

  it("never goes negative, so a refund cannot draw backwards", () => {
    expect(barPct(-40, 500)).toBe(0);
  });

  // Spending against no budget is not 0% of anything. An empty bar would read
  // as "nothing spent here", which is the opposite of what happened.
  it("fills completely for spend against no budget", () => {
    expect(barPct(120, 0)).toBe(100);
  });

  it("is empty when there is neither budget nor spend", () => {
    expect(barPct(0, 0)).toBe(0);
  });
});

describe("meterArgs", () => {
  it("passes a real budget through", () => {
    expect(meterArgs(40, 100)).toEqual({ used: 40, total: 100 });
  });
  it("fills fully, without reading as over, when spend has no budget", () => {
    const { used, total } = meterArgs(25, 0);
    expect(meterFill(used, total)).toEqual({ pct: 100, over: false });
  });
  it("stays empty when there is neither spend nor budget", () => {
    const { used, total } = meterArgs(0, 0);
    expect(meterFill(used, total)).toEqual({ pct: 0, over: false });
  });
  it("agrees with barPct on the unbudgeted cases", () => {
    expect(barPct(25, 0)).toBe(100);
    expect(barPct(0, 0)).toBe(0);
  });
});

describe("meterArgs with an over status", () => {
  it("prints an unbudgeted overspend as an over meter", () => {
    const { used, total } = meterArgs(216.5, 0, true);
    expect(meterFill(used, total)).toEqual({ pct: 100, over: true });
  });
  it("keeps an unbudgeted, not-over row full but not over", () => {
    for (const args of [meterArgs(216.5, 0, false), meterArgs(216.5, 0)]) {
      expect(meterFill(args.used, args.total)).toEqual({ pct: 100, over: false });
    }
  });
  it("leaves a real budget's over state to the numbers", () => {
    expect(meterArgs(40, 100, true)).toEqual({ used: 40, total: 100 });
  });
});
