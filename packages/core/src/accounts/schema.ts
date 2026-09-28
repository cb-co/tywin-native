import { z } from "zod";
import { ACCOUNT_TYPE_VALUES } from "./meta";

/** How long a card or account name may be. Shared so anything that *composes*
 *  a name — the statement import suggesting a line name, say — can trim to fit
 *  instead of discovering the cap as a zod error in the wrong language. */
export const NAME_MAX_LENGTH = 80;

const accountBase = z.object({
  name: z.string().trim().min(1, "Name is required").max(NAME_MAX_LENGTH),
  type: z.enum(ACCOUNT_TYPE_VALUES),
  currency: z.string().trim().length(3, "Use a 3-letter code").toUpperCase(),
  starting_balance: z.coerce.number().finite().default(0),
  color: z.string().trim().max(9).optional().or(z.literal("")),
  bank_id: z.string().uuid().optional().or(z.literal("")),

  // Fee settings (all types)
  transfer_tax_rate: z.coerce.number().min(0).max(1).default(0.002),
  network_fee_amount: z.coerce.number().min(0).default(0),
  network_fee_optional: z.boolean().default(true),

  // Credit-card fields
  credit_limit: z.coerce.number().min(0).optional(),
  statement_closing_day: z.coerce.number().int().min(1).max(31).optional(),
  payment_due_day: z.coerce.number().int().min(1).max(31).optional(),
  current_balance: z.coerce.number().min(0).default(0),
  card_group_id: z.string().uuid().optional().or(z.literal("")),
  // Four digits or nothing. The pattern is checked here on purpose: the
  // `color` field above is `max(9)` with no pattern, which is exactly how a
  // malformed hex reached the card face, and the database's own check
  // constraint is a backstop that surfaces as an opaque error rather than a
  // usable message.
  last4: z
    .string()
    .trim()
    .regex(/^[0-9]{4}$/, "Enter exactly four digits")
    .optional()
    .or(z.literal("")),
  welcome_bonus_goal_amount: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().min(0).optional(),
  ),
  welcome_bonus_goal_currency: z.string().trim().length(3, "Use a 3-letter code").toUpperCase().optional().or(z.literal("")),
  welcome_bonus_due_date: z.string().optional().or(z.literal("")),

  // Loan fields
  principal: z.coerce.number().min(0).optional(),
  interest_rate: z.coerce.number().min(0).max(1).optional(),
  term_months: z.coerce.number().int().min(1).max(1200).optional(),
  original_term_months: z.coerce.number().int().min(1).max(1200).optional(),
  start_date: z.string().optional().or(z.literal("")),
  installment_amount: z.coerce.number().min(0).optional(),
});

type AccountBase = z.infer<typeof accountBase>;

function refineAccount(v: AccountBase, ctx: z.RefinementCtx) {
  if (v.type === "credit_card") {
    for (const f of ["credit_limit", "statement_closing_day", "payment_due_day"] as const) {
      if (v[f] === undefined)
        ctx.addIssue({ code: "custom", path: [f], message: "Required for credit cards" });
    }
    /* All three or none. Reported on each field that is actually empty rather than
       collectively on the amount: the currency has no default and must be picked, so
       pinning its absence to a different field leaves the user staring at an error on
       a box they already filled. */
    const bonusFields = {
      welcome_bonus_goal_amount: v.welcome_bonus_goal_amount,
      welcome_bonus_goal_currency: v.welcome_bonus_goal_currency,
      welcome_bonus_due_date: v.welcome_bonus_due_date,
    };
    const entries = Object.entries(bonusFields);
    const blank = ([, f]: [string, unknown]) => f === undefined || f === "";
    if (!entries.every(blank)) {
      for (const entry of entries.filter(blank))
        ctx.addIssue({
          code: "custom",
          path: [entry[0]],
          message: "Set the goal amount, currency, and due date together, or leave all blank",
        });
    }
  }
  if (v.type === "loan") {
    for (const f of ["principal", "term_months", "installment_amount"] as const) {
      if (v[f] === undefined)
        ctx.addIssue({ code: "custom", path: [f], message: "Required for loans" });
    }
    if (v.original_term_months !== undefined && v.term_months !== undefined && v.original_term_months < v.term_months)
      ctx.addIssue({
        code: "custom",
        path: ["original_term_months"],
        message: "Can't be less than the remaining term",
      });
  }
}

/** One account row, as the server writes it. Every card line of a grouped card
 *  is validated with this too — a line IS an account. */
export const accountInput = accountBase.superRefine(refineAccount);

export type AccountInput = z.infer<typeof accountInput>;

/**
 * The narrow path used by statement import: a card the user has not described yet.
 *
 * `refineAccount` demands credit_limit, statement_closing_day and payment_due_day
 * for a credit card, which is right for the full form and wrong here — those are
 * exactly the three fields a statement backfills, so requiring them would put a
 * five-field form in front of the feature that exists to save typing. The columns
 * are nullable and `card_status` already returns a null utilization_pct rather than
 * dividing by a null limit.
 */
export const cardStubInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(NAME_MAX_LENGTH),
  currency: z.string().trim().length(3, "Use a 3-letter code").toUpperCase(),
  last4: z
    .string()
    .trim()
    .regex(/^[0-9]{4}$/, "Enter exactly four digits")
    .optional()
    .or(z.literal("")),
});

export type CardStubInput = z.infer<typeof cardStubInput>;

/**
 * What the account dialog validates: `accountInput` plus the extra card lines.
 *
 * The two toggles ("has installments" / "is multi-currency") are the only way to
 * build a card group now, and each one they turn on adds a line that needs its
 * own limit and its own balance. Those live here rather than in `accountInput`
 * because they never reach the database as columns — the dialog fans them out
 * into one `accountInput` payload per line. Validating them alongside the rest
 * is what puts the error under the right box instead of in a toast.
 */
export const accountFormInput = accountBase
  .extend({
    is_multi_currency: z.boolean().default(false),
    has_installments: z.boolean().default(false),
    usd_credit_limit: z.coerce.number().min(0).optional(),
    usd_current_balance: z.coerce.number().min(0).default(0),
    installments_credit_limit: z.coerce.number().min(0).optional(),
    installments_current_balance: z.coerce.number().min(0).default(0),
  })
  .superRefine((v, ctx) => {
    refineAccount(v, ctx);
    if (v.type !== "credit_card") return;
    if (v.is_multi_currency && v.usd_credit_limit === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["usd_credit_limit"],
        message: "Required for credit cards",
      });
    if (v.has_installments && v.installments_credit_limit === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["installments_credit_limit"],
        message: "Required for credit cards",
      });
  });
