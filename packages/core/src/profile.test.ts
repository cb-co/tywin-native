import { expect, test } from "vitest";
import {
  DEFAULT_BASE_CURRENCY,
  baseCurrencyOf,
  profileLabel,
  profileInitial,
  greetingName,
} from "./profile";

test("a profile without a base currency is worth pesos, not dollars", () => {
  expect(DEFAULT_BASE_CURRENCY).toBe("DOP");
  expect(baseCurrencyOf(null)).toBe("DOP");
  expect(baseCurrencyOf(undefined)).toBe("DOP");
  expect(baseCurrencyOf({ base_currency: null })).toBe("DOP");
});

test("a stored base currency is used as-is", () => {
  expect(baseCurrencyOf({ base_currency: "USD" })).toBe("USD");
  expect(baseCurrencyOf({ base_currency: "EUR" })).toBe("EUR");
});

test("display name wins over email", () => {
  expect(profileLabel("Ana Lucía Ferrer", "aferrer@corre.io")).toBe("Ana Lucía Ferrer");
  expect(profileInitial("Ana Lucía Ferrer", "aferrer@corre.io")).toBe("A");
  expect(greetingName("Ana Lucía Ferrer", "aferrer@corre.io")).toBe("Ana");
});

test("falls back to the email local part when no display name is set", () => {
  expect(profileLabel(null, "aferrer@corre.io")).toBe("aferrer");
  expect(profileInitial(null, "aferrer@corre.io")).toBe("A");
  expect(greetingName(null, "aferrer@corre.io")).toBe("aferrer");
});

test("blank and whitespace-only display names fall through, not render empty", () => {
  expect(profileLabel("", "aferrer@corre.io")).toBe("aferrer");
  expect(profileLabel("   ", "aferrer@corre.io")).toBe("aferrer");
  expect(profileInitial("   ", "aferrer@corre.io")).toBe("A");
});

test("avatar always has a glyph, even with nothing to work from", () => {
  expect(profileInitial(null, null)).toBe("?");
  expect(profileInitial(null, "")).toBe("?");
  expect(profileLabel(null, null)).toBe("");
});

test("greeting uses no email fallback when the caller passes none", () => {
  // The overview greeting passes `null` for email on purpose: greeting
  // someone by their email local part reads worse than the plain title.
  expect(greetingName(null, null)).toBe("");
  expect(greetingName("Bahar", null)).toBe("Bahar");
});
