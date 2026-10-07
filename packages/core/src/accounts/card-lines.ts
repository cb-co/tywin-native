/**
 * The lines one physical credit card is saved as.
 *
 * A Dominican card carries at most three, and always the same three: a DOP
 * revolving line, a USD revolving line, and a cuotas (installments) line, which
 * issuers bill in pesos. Each is its own account row, tagged with its line in
 * `accounts.card_line`; the database holds a card to one of each and pins each
 * line's currency. Everything that needs to tell a card's lines apart — the
 * account dialog, the statement importer, the accounts grid, the detail page's
 * rail — reads the tag rather than a currency or a name.
 */

/** Every line a card can have, in display order. Also the statement section keys. */
export const CARD_LINES = ["DOP", "USD", "CUOTAS"] as const;
export type CardLine = (typeof CARD_LINES)[number];

/** The currencies a card is held in. */
export const CARD_CURRENCIES = ["DOP", "USD"] as const;
export type CardCurrency = (typeof CARD_CURRENCIES)[number];

export function isCardLine(value: unknown): value is CardLine {
  return (CARD_LINES as readonly unknown[]).includes(value);
}

export function isCardCurrency(value: unknown): value is CardCurrency {
  return (CARD_CURRENCIES as readonly unknown[]).includes(value);
}

/** Cuotas are billed in pesos; the other two lines are named for their currency. */
export function cardLineCurrency(line: CardLine): CardCurrency {
  return line === "USD" ? "USD" : "DOP";
}

/** Sorts a card's lines into DOP, USD, Cuotas. Untagged rows go last. */
export function compareCardLines(a: string | null, b: string | null): number {
  const rank = (l: string | null) => (isCardLine(l) ? CARD_LINES.indexOf(l) : CARD_LINES.length);
  return rank(a) - rank(b);
}

/** What a line reads as on its own: the currency, or the localised word for cuotas. */
export function cardLineLabel(line: CardLine, installmentsLabel: string): string {
  return line === "CUOTAS" ? installmentsLabel : line;
}

/** The name a line is saved under: the card's, then which line it is. */
export function cardLineName(cardName: string, line: CardLine, installmentsLabel: string): string {
  return `${cardName} · ${cardLineLabel(line, installmentsLabel)}`;
}

export type CardLineSpec = {
  line: CardLine;
  /** Form field holding this line's credit limit. */
  limitField: "credit_limit" | "usd_credit_limit" | "installments_credit_limit";
  /** Form field holding this line's balance owed. */
  balanceField: "current_balance" | "usd_current_balance" | "installments_current_balance";
};

/**
 * The lines the account dialog's answers imply, or `[]` for an ordinary
 * single-line card.
 *
 * A card only gets the lines it was asked for — DOP + USD, DOP + Cuotas, or all
 * three. Every grouped card has its DOP line: USD is the second currency of a
 * peso card, and cuotas are billed in pesos. An empty result is the signal that
 * no group is needed at all, so callers can branch on it instead of re-deriving
 * "did either toggle get turned on".
 *
 * The DOP line reuses the dialog's own `credit_limit`/`current_balance` fields,
 * so a card that only gained a cuotas line keeps asking for its revolving limit
 * in the same field it always did.
 */
export function cardLineSpecs({
  multiCurrency,
  installments,
}: {
  multiCurrency: boolean;
  installments: boolean;
}): CardLineSpec[] {
  if (!multiCurrency && !installments) return [];

  const specs: CardLineSpec[] = [{ line: "DOP", limitField: "credit_limit", balanceField: "current_balance" }];
  if (multiCurrency) specs.push({ line: "USD", limitField: "usd_credit_limit", balanceField: "usd_current_balance" });
  if (installments)
    specs.push({ line: "CUOTAS", limitField: "installments_credit_limit", balanceField: "installments_current_balance" });
  return specs;
}
