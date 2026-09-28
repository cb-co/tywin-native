import { describe, expect, test } from "vitest";
import { cardBackfillFromSection } from "./backfill";

const blank = { statement_closing_day: null, payment_due_day: null, credit_limit: null };
const section = { periodEnd: "2026-08-15", dueDate: "2026-09-05", creditLimitCents: 15000000 };

describe("cardBackfillFromSection", () => {
  test("fills every null column from the statement", () => {
    expect(cardBackfillFromSection(blank, section)).toEqual({
      statement_closing_day: 15,
      payment_due_day: 5,
      credit_limit: 150000,
    });
  });

  test("never overwrites a column the user already set", () => {
    const known = { statement_closing_day: 20, payment_due_day: 10, credit_limit: 100000 };
    expect(cardBackfillFromSection(known, section)).toEqual({});
  });

  test("fills only the columns that are null", () => {
    expect(cardBackfillFromSection({ ...blank, credit_limit: 100000 }, section)).toEqual({
      statement_closing_day: 15,
      payment_due_day: 5,
    });
  });

  test("leaves due day and limit alone when the statement did not report them", () => {
    const sparse = { periodEnd: "2026-08-15", dueDate: null, creditLimitCents: null };
    expect(cardBackfillFromSection(blank, sparse)).toEqual({ statement_closing_day: 15 });
  });

  test("reads the day off the ISO string, not a parsed Date", () => {
    // new Date("2026-08-01") is 31 Jul in any negative-offset timezone, which is
    // every timezone in this product's market.
    const first = { periodEnd: "2026-08-01", dueDate: "2026-09-01", creditLimitCents: null };
    expect(cardBackfillFromSection(blank, first)).toEqual({
      statement_closing_day: 1,
      payment_due_day: 1,
    });
  });
});
