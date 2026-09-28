import { describe, expect, test } from "vitest";
import { mapIncomeCycleToPayCycle, weeklyAnchorToIso } from "./pay-cycle-sync";

describe("weeklyAnchorToIso", () => {
  test("converts this table's Sunday=1..Saturday=7 to ISO Monday=1..Sunday=7", () => {
    expect(weeklyAnchorToIso(1)).toBe(7); // Sunday
    expect(weeklyAnchorToIso(2)).toBe(1); // Monday
    expect(weeklyAnchorToIso(3)).toBe(2); // Tuesday
    expect(weeklyAnchorToIso(6)).toBe(5); // Friday
    expect(weeklyAnchorToIso(7)).toBe(6); // Saturday
  });
});

describe("mapIncomeCycleToPayCycle", () => {
  test("monthly carries its anchor day across unchanged", () => {
    expect(mapIncomeCycleToPayCycle("monthly", 15)).toEqual({ payCycle: "monthly", anchorDay: 15 });
    expect(mapIncomeCycleToPayCycle("monthly", null)).toEqual({ payCycle: "monthly", anchorDay: null });
  });

  test("weekly remaps its anchor day to ISO", () => {
    expect(mapIncomeCycleToPayCycle("weekly", 6)).toEqual({ payCycle: "weekly", anchorDay: 5 });
    expect(mapIncomeCycleToPayCycle("weekly", null)).toEqual({ payCycle: "weekly", anchorDay: null });
  });

  test("semimonthly carries its first payday, null meaning the 1st/16th", () => {
    expect(mapIncomeCycleToPayCycle("semimonthly", 5)).toEqual({ payCycle: "semimonthly", anchorDay: 5 });
    expect(mapIncomeCycleToPayCycle("semimonthly", null)).toEqual({ payCycle: "semimonthly", anchorDay: null });
  });

  test("biweekly, yearly, and custom have no pay_cycle equivalent", () => {
    expect(mapIncomeCycleToPayCycle("biweekly", null)).toBeNull();
    expect(mapIncomeCycleToPayCycle("yearly", null)).toBeNull();
    expect(mapIncomeCycleToPayCycle("custom", null)).toBeNull();
  });
});
