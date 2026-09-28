/**
 * The currency lines one physical credit card is saved as.
 *
 * A card group used to be something you assembled by hand: create the group,
 * then create each line and remember to point it at the group. Nobody but the
 * author of that form could guess it. Now two questions decide it — "does it
 * have installments?" and "is it multi-currency?" — and the answers imply the
 * lines exactly, which is what this module computes.
 *
 * The currencies are fixed rather than chosen: installments are billed in DOP,
 * and a multi-currency card here is always the DOP + USD pair. Fixing them is
 * what lets the dialog ask for a limit per line instead of asking the person to
 * describe the card's structure a second time.
 */

/** Currency of the installments ("cuotas") line. */
export const INSTALLMENTS_CURRENCY = "DOP";

/** The pair a multi-currency card is split into, in display order. */
export const MULTI_CURRENCY_CODES = ["DOP", "USD"] as const;

export type CardLineKey = "primary" | "usd" | "installments";

export type CardLineSpec = {
  key: CardLineKey;
  currency: string;
  /** Form field holding this line's credit limit. */
  limitField: "credit_limit" | "usd_credit_limit" | "installments_credit_limit";
  /** Form field holding this line's balance owed. */
  balanceField: "current_balance" | "usd_current_balance" | "installments_current_balance";
};

/**
 * The lines a card is saved as, or `[]` when it is an ordinary single-line card.
 *
 * An empty result is the signal that no group is needed at all, so callers can
 * branch on it instead of re-deriving "did either toggle get turned on".
 *
 * The primary line reuses the dialog's own `credit_limit`/`current_balance`
 * fields, so a card that only gained an installments line keeps asking for its
 * revolving limit in the same field it always did. When the card is
 * multi-currency the primary line IS the DOP one — the currency select is moot
 * at that point, since the pair is fixed.
 */
export function cardLineSpecs({
  multiCurrency,
  installments,
  currency,
}: {
  multiCurrency: boolean;
  installments: boolean;
  /** The dialog's currency select. Only used when the card is not multi-currency. */
  currency: string;
}): CardLineSpec[] {
  if (!multiCurrency && !installments) return [];

  const specs: CardLineSpec[] = multiCurrency
    ? [
        { key: "primary", currency: MULTI_CURRENCY_CODES[0], limitField: "credit_limit", balanceField: "current_balance" },
        { key: "usd", currency: MULTI_CURRENCY_CODES[1], limitField: "usd_credit_limit", balanceField: "usd_current_balance" },
      ]
    : [{ key: "primary", currency, limitField: "credit_limit", balanceField: "current_balance" }];

  if (installments)
    specs.push({
      key: "installments",
      currency: INSTALLMENTS_CURRENCY,
      limitField: "installments_credit_limit",
      balanceField: "installments_current_balance",
    });

  return specs;
}

/**
 * What a line is called once saved.
 *
 * The group carries the card's name, so a line only needs to say which line it
 * is. Currency alone won't do it: a card with installments carries two DOP
 * lines, and the group tile headlines the name, not the currency.
 */
export function cardLineName(cardName: string, spec: CardLineSpec, installmentsLabel: string): string {
  return `${cardName} · ${spec.key === "installments" ? installmentsLabel : spec.currency}`;
}
