import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { accountFormInput } from "./schema";
import type { AccountType } from "./meta";

/** The account dialog's own field shape: every input is a string because that is
 *  what the DOM holds, and `accountInput` coerces on the way out. */
export type AccountFormValues = {
  name: string;
  type: AccountType;
  currency: string;
  bank_id: string;
  starting_balance: string;
  transfer_tax_rate: string;
  network_fee_amount: string;
  network_fee_optional: boolean;
  credit_limit: string;
  last4: string;
  statement_closing_day: string;
  payment_due_day: string;
  current_balance: string;
  card_group_id: string;
  welcome_bonus_goal_amount: string;
  welcome_bonus_goal_currency: string;
  welcome_bonus_due_date: string;
  has_welcome_bonus_goal: boolean;
  /** True when the card's balance comes from a statement, so the dialog shows no
   *  field for it and nothing typed here may reach — or block — the submit. */
  balance_is_anchored: boolean;
  /* Card-group structure. These two decide whether the card is saved as a group
     and what lines it gets — see lib/accounts/card-lines.ts. The `usd_*` and
     `installments_*` pairs belong to the extra lines; the primary line reuses
     `credit_limit`/`current_balance` above. */
  is_multi_currency: boolean;
  has_installments: boolean;
  usd_credit_limit: string;
  usd_current_balance: string;
  installments_credit_limit: string;
  installments_current_balance: string;
  principal: string;
  interest_rate: string;
  term_months: string;
  original_term_months: string;
  start_date: string;
  installment_amount: string;
};

/** Every "" becomes undefined — mirrors what `accountInput`'s superRefine checks for
 *  conditionally-required numeric fields. */
export function blankToUndefined<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === "" ? undefined : v]),
  ) as T;
}

/** Bridges the gap between what the *controls* hold and what `accountInput` accepts.
 *  Lives here, apart from the dialog, because it has to run twice over the same submit —
 *  once in the resolver to populate `errors`, once to build the server payload — and every
 *  bug this form has had was those two paths disagreeing. A field that normalizes on one
 *  path but not the other fails validation with nothing on screen to explain it, since
 *  none of the fields below render a FieldError.
 *
 *  Two mismatches to close:
 *  - `bank_id`/`card_group_id` hold the "none"/"new" sentinels their Selects need. Neither
 *    is a UUID nor "", so the schema's `.uuid().or(literal(""))` rejects both.
 *  - The welcome-bonus fields keep whatever was typed into them after the toggle goes back
 *    off, and the schema's bonus rule is all-or-nothing: a leftover value in any one of the
 *    three demands the other two, reported onto fields the closed toggle no longer renders.
 *    Clearing the trio here matches what the payload has always sent. (The trio now also
 *    starts empty — the goal currency has no default — so a card whose toggle was never
 *    touched is already consistent; this covers the toggle-on-then-off path.)
 *  - The extra card lines follow the same rule for the same reason: a limit typed for a
 *    USD line, then un-toggled, would otherwise keep demanding a line that no longer
 *    renders — and, worse, would be carried into the saved card as a line nobody asked
 *    for. */
export function normalizeFormValues(values: AccountFormValues): AccountFormValues {
  const sentinel = (v: string) => (v === "none" || v === "new" ? "" : v);
  return {
    ...values,
    bank_id: sentinel(values.bank_id),
    card_group_id: sentinel(values.card_group_id),
    ...(values.has_welcome_bonus_goal
      ? null
      : {
          welcome_bonus_goal_amount: "",
          welcome_bonus_goal_currency: "",
          welcome_bonus_due_date: "",
        }),
    /* An anchored card renders no balance field, and the stored balance it was seeded
       with can be NEGATIVE — a card in credit after an overpayment, which
       `recompute_card_balance` produces quite legitimately. The schema's `min(0)` would
       then reject a field that is not on screen, stopping the edit dead with nothing to
       explain it. Blanking it defers to the schema's `.default(0)`, and the server
       discards the column for anchored cards regardless. */
    ...(values.balance_is_anchored ? { current_balance: "" } : null),
    ...(values.is_multi_currency ? null : { usd_credit_limit: "", usd_current_balance: "" }),
    ...(values.has_installments
      ? null
      : { installments_credit_limit: "", installments_current_balance: "" }),
  };
}

/** The dialog's resolver. Validates `accountFormInput` against the cleaned values — the only
 *  shape the schema accepts — while handing `handleSubmit`'s valid callback the form's OWN
 *  values back.
 *
 *  That hand-back is the whole point and cannot be delegated to `zodResolver`'s `raw: true`,
 *  which returns whatever values it was called with: here the cleaned copy, whose
 *  "none"/"new" sentinels `normalizeFormValues` has already flattened to "". `onSubmit`
 *  reads those sentinels to decide whether it must create a bank or card group before
 *  saving, so the flattened copy turned "New bank…"/"New group…" into silent no-ops — the
 *  typed name was dropped and the account saved unlinked. Parsed output is equally wrong:
 *  it coerces numbers to their schema types and drops `has_welcome_bonus_goal`, which is
 *  form-only state `onSubmit` still needs.
 *
 *  Lives here beside the two normalizers it composes so the round trip stays testable
 *  without a DOM. */
export function accountResolver(): Resolver<AccountFormValues, unknown, AccountFormValues> {
  const validate = zodResolver(accountFormInput, undefined, { raw: true });
  return (async (values: AccountFormValues, context, options) => {
    const result = await validate(
      blankToUndefined(normalizeFormValues(values)) as AccountFormValues,
      context,
      options as never,
    );
    if (Object.keys(result.errors).length > 0) return result;
    return { values, errors: {} };
  }) as Resolver<AccountFormValues, unknown, AccountFormValues>;
}
