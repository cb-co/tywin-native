import { describe, expect, test } from "vitest";
import { accountInput, cardStubInput } from "./schema";
import {
  blankToUndefined,
  normalizeFormValues,
  type AccountFormValues,
} from "./form-values";

/* These pin down what the add-account form actually submits, not just what the schema
 * likes in the abstract. `accountInput` runs twice over the same submit — once in the
 * dialog's resolver to populate `errors`, once on the server — and the whole class of bug
 * here is the two disagreeing about a field the user never touched. The disagreement is
 * silent by construction: the fields normalizeFormValues touches render no FieldError, so
 * a rejection there stops the submit with nothing on screen to explain it. */

const base: AccountFormValues = {
  name: "Visa Infinite",
  type: "credit_card",
  currency: "USD",
  bank_id: "none",
  starting_balance: "0",
  transfer_tax_rate: "0.002",
  network_fee_amount: "0",
  network_fee_optional: true,
  credit_limit: "5000",
  last4: "",
  statement_closing_day: "15",
  payment_due_day: "5",
  current_balance: "0",
  card_group_id: "none",
  welcome_bonus_goal_amount: "",
  welcome_bonus_goal_currency: "",
  welcome_bonus_due_date: "",
  has_welcome_bonus_goal: false,
  balance_is_anchored: false,
  is_multi_currency: false,
  has_installments: false,
  usd_credit_limit: "",
  usd_current_balance: "0",
  installments_credit_limit: "",
  installments_current_balance: "0",
  principal: "",
  interest_rate: "",
  term_months: "",
  original_term_months: "",
  start_date: "",
  installment_amount: "",
};

/** Exactly what the dialog's resolver hands to `accountInput`. */
const validate = (values: AccountFormValues) =>
  accountInput.safeParse(blankToUndefined(normalizeFormValues(values)));

describe("account form submit", () => {
  test("accepts a credit card with the bonus toggle off", () => {
    const parsed = validate(base);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  test("accepts a credit card with a fully filled bonus goal", () => {
    const parsed = validate({
      ...base,
      has_welcome_bonus_goal: true,
      welcome_bonus_goal_amount: "3000",
      welcome_bonus_goal_currency: "USD",
      welcome_bonus_due_date: "2026-12-31",
    });
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  /* The goal currency has no default — it opens blank so the user has to pick one. Each
     of these asserts the complaint lands on the empty field itself, because that is the
     only field rendering a FieldError for it. */
  test("rejects a bonus goal whose currency was never picked", () => {
    const parsed = validate({
      ...base,
      has_welcome_bonus_goal: true,
      welcome_bonus_goal_amount: "3000",
      welcome_bonus_due_date: "2026-12-31",
    });
    expect(parsed.success).toBe(false);
    expect(!parsed.success && parsed.error.issues.map((i) => i.path.join("."))).toEqual([
      "welcome_bonus_goal_currency",
    ]);
  });

  test("rejects a bonus goal missing its due date", () => {
    const parsed = validate({
      ...base,
      has_welcome_bonus_goal: true,
      welcome_bonus_goal_amount: "3000",
      welcome_bonus_goal_currency: "USD",
    });
    expect(parsed.success).toBe(false);
    expect(!parsed.success && parsed.error.issues.map((i) => i.path.join("."))).toEqual([
      "welcome_bonus_due_date",
    ]);
  });

  test("accepts the 'none'/'new' select sentinels for bank and card group", () => {
    const parsed = validate({ ...base, bank_id: "new", card_group_id: "new" });
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  // The toggle-off case is credit-card-only — the bonus rule is gated on the type — so
  // these guard the paths that were already working against the fix regressing them.
  test("accepts a checking account", () => {
    const parsed = validate({ ...base, type: "checking", credit_limit: "", statement_closing_day: "", payment_due_day: "" });
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  test("accepts a loan", () => {
    const parsed = validate({
      ...base,
      type: "loan",
      credit_limit: "",
      statement_closing_day: "",
      payment_due_day: "",
      principal: "10000",
      term_months: "36",
      installment_amount: "320",
    });
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });
});

describe("cardStubInput", () => {
  test("accepts a card with no limit, closing day or due day", () => {
    const r = cardStubInput.safeParse({ name: "Popular Visa", currency: "dop", last4: "4921" });
    expect(r.success).toBe(true);
    expect(r.data?.currency).toBe("DOP");
  });

  test("accepts a card with no last4 at all", () => {
    expect(cardStubInput.safeParse({ name: "Popular Visa", currency: "DOP" }).success).toBe(true);
  });

  test("rejects a malformed last4", () => {
    const r = cardStubInput.safeParse({ name: "Popular Visa", currency: "DOP", last4: "49" });
    expect(r.success).toBe(false);
  });

  test("accountInput still requires the three card fields", () => {
    const r = accountInput.safeParse({ name: "Popular Visa", type: "credit_card", currency: "DOP" });
    expect(r.success).toBe(false);
  });
});
