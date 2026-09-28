import { describe, expect, test } from "vitest";
import { isOutgoing } from "./outgoing";

const TYPES: Record<string, string> = {
  card: "credit_card",
  loan: "loan",
  checking: "checking",
  savings: "savings",
};
const typeOf = (id: string) => TYPES[id];

describe("isOutgoing", () => {
  test("an expense counts, whatever it points at", () => {
    expect(isOutgoing({ kind: "expense", to_account_id: null }, typeOf)).toBe(true);
    expect(isOutgoing({ kind: "expense", to_account_id: "loan" }, typeOf)).toBe(true);
  });

  test("a payment to a credit card counts", () => {
    expect(isOutgoing({ kind: "payment", to_account_id: "card" }, typeOf)).toBe(true);
  });

  test("a payment to a loan does not — loan_status already bills it", () => {
    expect(isOutgoing({ kind: "payment", to_account_id: "loan" }, typeOf)).toBe(false);
  });

  test("a payment between own accounts does not — the money never leaves", () => {
    expect(isOutgoing({ kind: "payment", to_account_id: "checking" }, typeOf)).toBe(false);
    expect(isOutgoing({ kind: "payment", to_account_id: "savings" }, typeOf)).toBe(false);
  });

  test("a payment with no resolvable destination does not", () => {
    expect(isOutgoing({ kind: "payment", to_account_id: null }, typeOf)).toBe(false);
    expect(isOutgoing({ kind: "payment", to_account_id: "deleted" }, typeOf)).toBe(false);
  });

  test("income never counts, even if the query ever let it through", () => {
    expect(isOutgoing({ kind: "income", to_account_id: "checking" }, typeOf)).toBe(false);
  });
});
