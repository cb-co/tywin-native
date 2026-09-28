/**
 * Recording a subscription charge, when the merchant bills in one currency and
 * the card settles in another.
 *
 * A subscription carries two different facts, and the schema keeps them apart:
 *
 *   - `amount` + `currency` are what the MERCHANT bills. Netflix bills USD 15.99
 *     whether it lands on a dollar card or a peso one. This is stable, and it is
 *     what the monthly-subscriptions forecast converts and totals.
 *   - What actually leaves the account is a different number in a different
 *     currency, and it moves month to month: the bank applies its own rate plus
 *     a spread, sometimes a flat foreign-transaction fee on top.
 *
 * Only the second belongs on the transaction, because `account_balances`
 * subtracts `total_amount` from the account raw — a row denominated in the
 * merchant's currency debits the card that many pesos.
 *
 * The awkward part is timing. The authorisation email arrives in the billing
 * currency within seconds; the converted figure is not known until the charge
 * posts days later. So at the moment someone records the charge they usually
 * cannot know the real number, and refusing to proceed without it would make
 * the button unusable. Hence an estimate that leans deliberately high.
 */

import { crossRate } from "../fx";

/**
 * How far above the interbank rate to place the estimate.
 *
 * Card issuers never give you the market rate on a foreign charge; 3-5% over is
 * typical once the network margin and the issuer's own foreign-transaction fee
 * are both in. Estimating at market would understate every foreign charge, and
 * these accumulate in one direction — a card would drift steadily richer than
 * it is. Leaning high instead means the balance errs toward owing slightly too
 * much, which is the safer way to be wrong about money you owe.
 *
 * One number, one place, if a particular issuer proves further off.
 */
export const CARD_FX_SPREAD = 0.04;

/** Whether recording this charge needs a settled figure at all. */
export function chargeCrossesCurrency(
  subCurrency: string,
  accountCurrency: string | null | undefined,
): boolean {
  return !!accountCurrency && subCurrency !== accountCurrency;
}

/**
 * What the charge will probably cost in the account's currency: the billed
 * amount at market, plus {@link CARD_FX_SPREAD}.
 *
 * Null when the pair's rate is unknown (a failed FX request), because a hint
 * pulled out of thin air is worse than no hint — the field simply starts empty
 * and the person types what they know.
 *
 * The uplift raises the account-currency figure in either direction. A dollar
 * sub on a peso card costs more pesos than market; a peso sub on a dollar card
 * costs more dollars. Both are the issuer taking its cut, so both go up.
 */
export function estimateSettledAmount({
  subAmount,
  subCurrency,
  accountCurrency,
  rates,
}: {
  subAmount: number;
  subCurrency: string;
  accountCurrency: string;
  rates: Record<string, number>;
}): number | null {
  const rate = crossRate(subCurrency, accountCurrency, rates);
  if (!rate) return null;
  // 2dp, not the 4 the column keeps: this lands in a step="0.01" money field
  // and 986.2047 reads as noise.
  return Math.round(subAmount * rate * (1 + CARD_FX_SPREAD) * 100) / 100;
}

export type SettledCharge = { amount: number } | { needsSettledAmount: true };

/**
 * The amount and currency to write the charge with.
 *
 * Same currency on both sides: the billed amount, and any settled figure passed
 * is ignored rather than trusted — there is nothing to convert, so a
 * disagreement could only be a bug.
 *
 * Different currencies: a positive settled figure is required. Never computed
 * here even though {@link estimateSettledAmount} exists, because an estimate is
 * a suggestion someone accepted, not a value this function may invent. The
 * caller offers it; the caller sends it back.
 */
export function settledCharge({
  subAmount,
  subCurrency,
  accountCurrency,
  settledAmount,
}: {
  subAmount: number;
  subCurrency: string;
  accountCurrency: string;
  settledAmount?: number | null;
}): SettledCharge {
  if (!chargeCrossesCurrency(subCurrency, accountCurrency)) return { amount: subAmount };
  if (!settledAmount || !(settledAmount > 0)) return { needsSettledAmount: true };
  return { amount: settledAmount };
}
