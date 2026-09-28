/**
 * A recurring payment is a transaction template: everything a person would type
 * into quick-add, saved once and recorded again each cycle. These are the rules
 * for turning the template into the row.
 */

import { crossRate } from "../fx";
import { isBankAccount, type AccountType } from "../accounts/meta";

export const RECURRING_KINDS = ["expense", "payment", "income"] as const;
export type RecurringKind = (typeof RECURRING_KINDS)[number];

/**
 * Whether a template charged to this account may carry the transfer tax and
 * commission at all.
 *
 * Those are bank debit charges, so they follow the SOURCE, the same rule
 * quick-add's resolveFeeDefaults applies: a card swipe or a cash payment is
 * never taxed. Income is a flat no regardless of account — the same rule
 * manual income transactions already follow (lib/transactions/defaults.ts).
 * The form hides the toggles for anything else, and {@link recordedFlags}
 * drops them even if a stale template still has them set — say, one whose
 * account was switched from checking to a card.
 */
export function templateAllowsFees(
  kind: RecurringKind,
  srcType: string | null | undefined,
): boolean {
  return kind !== "income" && !!srcType && isBankAccount(srcType as AccountType);
}

/** The fee and budget flags the recorded transaction is written with. */
export function recordedFlags({
  kind,
  srcType,
  include_tax,
  include_commission,
}: {
  kind: RecurringKind;
  srcType: string | null | undefined;
  include_tax: boolean;
  include_commission: boolean;
}): { include_tax: boolean; include_commission: boolean; exclude_from_budget: boolean } {
  const fees = templateAllowsFees(kind, srcType);
  return {
    include_tax: fees && include_tax,
    include_commission: fees && include_commission,
    /* A card charge stays off the budget, as subscription charges always have:
       the card PAYMENT is what spends the money. Only expenses carry the flag —
       transactions/actions zeroes it for payments as well. */
    exclude_from_budget: kind === "expense" && srcType === "credit_card",
  };
}

/**
 * A suggested destination leg for a cross-currency payment, at market.
 *
 * No spread here, unlike estimateSettledAmount in ./charge: that one guesses at
 * what a card issuer takes on a foreign charge, while a payment between your own
 * accounts is converted at whatever rate the person actually got — which they
 * type over this. Null when the pair has no rate.
 */
export function estimateDestinationAmount({
  amount,
  from,
  to,
  rates,
}: {
  amount: number;
  from: string;
  to: string;
  rates: Record<string, number>;
}): number | null {
  const rate = crossRate(from, to, rates);
  if (!rate) return null;
  return Math.round(amount * rate * 100) / 100;
}
