import { expect, test } from "vitest";
import { formatDate } from "./format";

test("formats an ISO date in the given locale", () => {
  expect(formatDate("2026-07-22", "en")).toBe("Jul 22, 2026");
  expect(formatDate("2026-07-22", "es")).toBe("22 jul 2026");
});

test("never shifts the date across a UTC-offset boundary", () => {
  // A date-only string must render the same calendar day regardless of the
  // machine's local timezone — this is what timeZone: "UTC" buys us.
  const result = formatDate("2026-01-01", "en");
  expect(result).toBe("Jan 1, 2026");
});

test("accepts custom Intl.DateTimeFormat options", () => {
  expect(formatDate("2026-07-22", "en", { month: "short", day: "numeric" })).toBe("Jul 22");
});
