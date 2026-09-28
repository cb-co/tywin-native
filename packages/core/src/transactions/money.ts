/**
 * Money helpers shared by the transaction form and its schema.
 *
 * A payment moves value between two accounts that may not share a currency, so
 * it carries two amounts: `amount` in the source account's currency and
 * `to_amount` in the destination's. Everything here produces the second from
 * the first — the DB stores both and never re-derives one from the other.
 */

import { baseRate } from "../fx";

/** Round to the 4 decimals `numeric(18,4)` keeps, so TS and Postgres agree. */
export function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function assertPositive(rate: number): void {
  if (!(rate > 0) || !Number.isFinite(rate)) {
    throw new Error(`Exchange rate must be a positive number, got ${rate}`);
  }
}

/**
 * Flip a rate between the two directions.
 *
 * The DB stores `exchange_rate` as base-currency units per 1 unit of the
 * transaction's currency (0.1742 USD per DOP). The form shows the reciprocal —
 * "1 USD = 5.741 DOP" — because the base currency is usually the stronger one
 * and that keeps the number a person types whole-ish.
 */
export function invertRate(rate: number): number {
  assertPositive(rate);
  return 1 / rate;
}

/**
 * The destination leg of a payment.
 *
 * `rate` is units of the destination currency per 1 unit of the source's, the
 * same direction the form displays.
 */
export function destinationAmount(amount: number, rate: number): number {
  assertPositive(rate);
  return round4(amount * rate);
}

/**
 * The rate a transaction is stored with: base-currency units per 1 unit of the
 * transaction's currency (`transactions.exchange_rate`).
 *
 * The user is never asked for this. It exists only so budgets, net worth and
 * cashflow can add a DOP row to a USD total — no money actually changed
 * currency, so the market rate is exactly the right answer and a prompt is
 * noise the user has no way to answer better than the FX service can.
 *
 * The one exception is a cross-currency payment that *lands* in the base
 * currency: there the user did convert, and told us the result via the
 * destination leg. Their own rate beats the market's, and it also keeps the
 * two legs of one payment worth the same in base (which `account_balances`
 * assumes when it credits the destination `base_amount`).
 */
export function resolveBaseRate({
  currency,
  baseCurrency,
  amount,
  toCurrency,
  toAmount,
  rates,
}: {
  currency: string;
  baseCurrency: string;
  amount: number;
  /** Destination account's currency, for payments. */
  toCurrency?: string | null;
  /** Destination leg, in `toCurrency`. */
  toAmount?: number | null;
  /** Market rates keyed as units-per-1-base, from getExchangeRates(baseCurrency). */
  rates: Record<string, number>;
}): number {
  if (currency === baseCurrency) return 1;
  if (
    toCurrency === baseCurrency &&
    toCurrency !== currency &&
    amount > 0 &&
    toAmount != null &&
    toAmount > 0
  ) {
    return toAmount / amount;
  }
  return baseRate(currency, baseCurrency, rates);
}
