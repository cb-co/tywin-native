import { describe, expect, test } from "vitest";
import { accountResolver, blankToUndefined, normalizeFormValues } from "./form-values";
import type { AccountFormValues } from "./form-values";
import { ACCOUNT_TYPE_VALUES, type AccountType } from "./meta";

function form(overrides: Partial<AccountFormValues> = {}): AccountFormValues {
  return {
    name: "Sapphire Preferred",
    type: "credit_card",
    currency: "USD",
    bank_id: "none",
    starting_balance: "0",
    transfer_tax_rate: "0.002",
    network_fee_amount: "0",
    network_fee_optional: true,
    credit_limit: "5000",
    last4: "",
    statement_closing_day: "12",
    payment_due_day: "5",
    current_balance: "0",
    card_group_id: "",
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
    ...overrides,
  };
}

const resolve = (values: AccountFormValues) =>
  accountResolver()(values, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  } as never);

describe("normalizeFormValues", () => {
  test("flattens the Select sentinels the schema can't accept", () => {
    const out = normalizeFormValues(form({ bank_id: "new", card_group_id: "none" }));
    expect(out.bank_id).toBe("");
    expect(out.card_group_id).toBe("");
  });

  test("clears the extra card lines when their toggles are off", () => {
    const out = normalizeFormValues(
      form({
        is_multi_currency: false,
        has_installments: false,
        usd_credit_limit: "3000",
        usd_current_balance: "120",
        installments_credit_limit: "5000",
        installments_current_balance: "40",
      }),
    );
    expect(out.usd_credit_limit).toBe("");
    expect(out.usd_current_balance).toBe("");
    expect(out.installments_credit_limit).toBe("");
    expect(out.installments_current_balance).toBe("");
  });

  test("keeps the lines whose toggle is on", () => {
    const out = normalizeFormValues(
      form({
        is_multi_currency: true,
        has_installments: false,
        usd_credit_limit: "3000",
        installments_credit_limit: "5000",
      }),
    );
    expect(out.usd_credit_limit).toBe("3000");
    expect(out.installments_credit_limit).toBe("");
  });

  /* The balance field is gone from an anchored card's dialog, so whatever it was seeded
     with has to stop mattering — including the negative balance a card in credit after
     an overpayment legitimately carries, which `min(0)` would otherwise reject on a box
     that is not on screen. */
  test("blanks the balance of an anchored card, negative or not", () => {
    expect(
      normalizeFormValues(form({ balance_is_anchored: true, current_balance: "-50" }))
        .current_balance,
    ).toBe("");
    expect(
      normalizeFormValues(form({ balance_is_anchored: true, current_balance: "1200" }))
        .current_balance,
    ).toBe("");
  });

  test("leaves the balance alone on a card with no statement to anchor to", () => {
    expect(
      normalizeFormValues(form({ balance_is_anchored: false, current_balance: "1200" }))
        .current_balance,
    ).toBe("1200");
  });

  test("clears the welcome-bonus trio when the toggle is off", () => {
    const out = normalizeFormValues(
      form({
        has_welcome_bonus_goal: false,
        welcome_bonus_goal_amount: "4000",
        welcome_bonus_goal_currency: "USD",
        welcome_bonus_due_date: "2026-01-01",
      }),
    );
    expect(out.welcome_bonus_goal_amount).toBe("");
    expect(out.welcome_bonus_goal_currency).toBe("");
    expect(out.welcome_bonus_due_date).toBe("");
  });
});

describe("blankToUndefined", () => {
  test("turns every empty string into undefined", () => {
    expect(blankToUndefined({ a: "", b: "x", c: 0, d: false })).toEqual({
      a: undefined,
      b: "x",
      c: 0,
      d: false,
    });
  });
});

describe("accountResolver", () => {
  /* The regression this file exists for. The dialog's onSubmit branches on
     `card_group_id === "new"` / `bank_id === "new"` to create the group or bank before
     saving; a resolver that hands back its own cleaned input flattens both to "" first, so
     "New group…"/"New bank…" saved an unlinked account and dropped the typed name. */
  test("hands back the raw values, sentinels intact, on success", async () => {
    const values = form({ bank_id: "new", card_group_id: "new" });
    const { values: out, errors } = await resolve(values);
    expect(errors).toEqual({});
    expect(out).toEqual(values);
  });

  test("does not coerce or strip form-only fields", async () => {
    const { values: out } = await resolve(form({ has_welcome_bonus_goal: false }));
    // Strings stay strings (the schema would have coerced them to numbers) and
    // `has_welcome_bonus_goal` survives even though `accountInput` has no such field.
    expect(out.credit_limit).toBe("5000");
    expect(out).toHaveProperty("has_welcome_bonus_goal", false);
  });

  test("validates against the cleaned values, so a sentinel is not a uuid error", async () => {
    const { errors } = await resolve(form({ bank_id: "new", card_group_id: "new" }));
    expect(errors).not.toHaveProperty("bank_id");
    expect(errors).not.toHaveProperty("card_group_id");
  });

  test("still reports real errors and withholds values", async () => {
    const { values: out, errors } = await resolve(form({ credit_limit: "" }));
    expect(errors).toHaveProperty("credit_limit");
    expect(out).toEqual({});
  });

  test("keeps a leftover bonus value from erroring once the toggle is off", async () => {
    const { errors } = await resolve(
      form({ has_welcome_bonus_goal: false, welcome_bonus_goal_amount: "4000" }),
    );
    expect(errors).toEqual({});
  });

  /* The regression this guards: an anchored card sitting at a credit balance could not
     be edited at all. `min(0)` rejected `current_balance`, and the field it rejected had
     already been removed from the dialog — so the Save button did nothing, forever, with
     no error anywhere on screen. */
  test("lets an anchored card in credit through the submit", async () => {
    const { values: out, errors } = await resolve(
      form({ balance_is_anchored: true, current_balance: "-50" }),
    );
    expect(errors).toEqual({});
    // The raw value still comes back untouched — the server is what drops the column.
    expect(out.current_balance).toBe("-50");
  });

  test("still rejects a negative balance a person actually typed", async () => {
    const { errors } = await resolve(
      form({ balance_is_anchored: false, current_balance: "-50" }),
    );
    expect(errors).toHaveProperty("current_balance");
  });

  test("demands a limit for every line the toggles turned on", async () => {
    const { errors } = await resolve(form({ is_multi_currency: true, has_installments: true }));
    expect(errors).toHaveProperty("usd_credit_limit");
    expect(errors).toHaveProperty("installments_credit_limit");
  });

  test("asks for nothing extra when both toggles are off", async () => {
    const { errors } = await resolve(form({ is_multi_currency: false, has_installments: false }));
    expect(errors).toEqual({});
  });

  test("a line limit typed then un-toggled is not a required field any more", async () => {
    const { errors } = await resolve(
      form({ is_multi_currency: false, usd_credit_limit: "", installments_credit_limit: "" }),
    );
    expect(errors).toEqual({});
  });
});

/* The card-group toggles and their per-line limits were added to the schema every account
   type shares, so every other type submits through them now whether it wants to or not.
   These walk each creatable type through the real resolver — the dialog's actual gate —
   rather than trusting that the type guards inside the refinement are in the right place. */
describe("accountResolver across account types", () => {
  /** A minimal valid form for `type`, filled the way its dialog branch fills it. */
  function forType(type: AccountType): AccountFormValues {
    const cardFields = { credit_limit: "5000", statement_closing_day: "12", payment_due_day: "5" };
    const blankCard = { credit_limit: "", statement_closing_day: "", payment_due_day: "" };
    if (type === "credit_card") return form({ type, ...cardFields });
    if (type === "loan")
      return form({
        type,
        ...blankCard,
        principal: "10000",
        term_months: "36",
        installment_amount: "320",
      });
    return form({ type, ...blankCard });
  }

  test.each(ACCOUNT_TYPE_VALUES)("%s submits clean", async (type) => {
    const { values: out, errors } = await resolve(forType(type));
    expect(errors).toEqual({});
    expect(out).toHaveProperty("type", type);
  });

  /* A stale limit left in the form by someone who toggled multi-currency on, changed
     their mind, and switched the type picker must not block a savings account — the
     line refinement is credit-card-only, and this is what proves the guard is there. */
  test.each(ACCOUNT_TYPE_VALUES.filter((t) => t !== "credit_card"))(
    "%s ignores leftover card-line values",
    async (type) => {
      const { errors } = await resolve(
        forType(type as AccountType),
      );
      expect(errors).toEqual({});
      const { errors: withLeftovers } = await resolve({
        ...forType(type as AccountType),
        is_multi_currency: true,
        has_installments: true,
        usd_credit_limit: "",
        installments_credit_limit: "",
      });
      expect(withLeftovers).toEqual({});
    },
  );
});
