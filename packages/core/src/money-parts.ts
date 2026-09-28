import { moneyFormatter, type MoneyOpts } from "./format";

export type MoneyParts = {
  /** Currency symbol, sign and integer digits — rendered at full size. */
  head: string;
  /** The locale's decimal separator, or "" when there is no fraction. */
  sep: string;
  /** Fraction digits, rendered small and muted. "" when there is none. */
  cents: string;
};

/**
 * Splits a formatted money string so the cents can be de-emphasised.
 *
 * Uses `formatToParts` rather than splitting on ".", because the decimal
 * separator is locale-dependent and the currency symbol can sit on either side
 * of the number.
 */
export function splitMoney(
  amount: number,
  currency: string,
  opts?: MoneyOpts,
): MoneyParts {
  const sign = opts?.signed && amount > 0 ? "+" : "";
  const parts = moneyFormatter(currency, opts).formatToParts(amount);
  const join = (ps: Intl.NumberFormatPart[]) => ps.map((p) => p.value).join("");

  // Compact notation's "." belongs to the mantissa ("$8.8K"), not to cents.
  const i = opts?.compact ? -1 : parts.findIndex((p) => p.type === "decimal");
  if (i === -1) return { head: sign + join(parts), sep: "", cents: "" };

  return {
    head: sign + join(parts.slice(0, i)),
    sep: parts[i].value,
    cents: join(parts.slice(i + 1)),
  };
}
