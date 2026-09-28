import { describe, expect, it, test } from "vitest";
import { transactionInput } from "./schema";

/* A transaction is denominated in its own account's currency — the bank settles
 * in what the account holds, whatever the merchant billed. So the currency is a
 * fact about the account, and the client no longer sends one: the server reads
 * it off `accounts` (see currencyContext in app/(app)/transactions/actions.ts).
 *
 * These tests pin that down, because the failure it prevents is silent:
 * `account_balances` applies `amount` to the account raw, so a row that says
 * "50 EUR" while sitting on a USD card takes 50 USD off that card. */

const valid = {
  type: "expense" as const,
  account_id: "11111111-1111-4111-8111-111111111111",
  category_id: "22222222-2222-4222-8222-222222222222",
  amount: "15.99",
  occurred_at: "2026-07-28",
};

describe("transactionInput currency", () => {
  test("parses without a currency at all", () => {
    const parsed = transactionInput.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  test("does not surface a currency even when one is sent", () => {
    const parsed = transactionInput.safeParse({ ...valid, currency: "EUR" });
    expect(parsed.success).toBe(true);
    // Stripped, not honoured: a client that still posts one cannot influence
    // the currency the row is written with.
    expect(parsed.success && "currency" in parsed.data).toBe(false);
  });
});

describe("transactionInput destination leg", () => {
  test("accepts a payment carrying to_amount", () => {
    const parsed = transactionInput.safeParse({
      ...valid,
      type: "payment",
      category_id: "",
      to_account_id: "33333333-3333-4333-8333-333333333333",
      to_amount: "960",
    });
    expect(parsed.success).toBe(true);
  });

  /* to_amount is the destination account's currency leg, so it is meaningless
   * on a row with no destination. */
  test("rejects to_amount on an expense", () => {
    const parsed = transactionInput.safeParse({ ...valid, to_amount: "960" });
    expect(parsed.success).toBe(false);
  });

  test("rejects a payment into the account it came from", () => {
    const parsed = transactionInput.safeParse({
      ...valid,
      type: "payment",
      category_id: "",
      to_account_id: valid.account_id,
    });
    expect(parsed.success).toBe(false);
  });
});

/* The importer is now allowed to write a null category to `statement_line_id`-
 * backed expenses (see lib/statements/categorize.ts and
 * app/(app)/accounts/statement-actions.ts) — but that exception lives in the
 * database CHECK constraint, not here. A manually-entered expense still has to
 * carry a category; this pins that down so a future change to the shared
 * schema can't loosen it by accident. */
describe("transactionInput", () => {
  it("still refuses a manual expense with no category", () => {
    const parsed = transactionInput.safeParse({
      type: "expense",
      account_id: "11111111-1111-1111-1111-111111111111",
      amount: 100,
      occurred_at: "2026-08-19T10:00:00.000Z",
      category_id: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues.some((i) => i.path.includes("category_id"))).toBe(true);
  });
});
