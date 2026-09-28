/**
 * What to call a credit line added from the import dialog.
 *
 * A Dominican statement carries its installments as a section of its own, in
 * the same currency as the consumos section beside it — and `card_statements`
 * is unique on `(account_id, period_end)`, so the two cannot share a line. The
 * cuotas section therefore lands on a line of its own, and naming that line by
 * its currency produced "Amex Platinum · DOP" sitting under a DOP line, which
 * reads as a duplicate card rather than as the installments facility it is.
 *
 * Naming it for what it is also matches the statement: cuotas is printed with
 * its own credit limit and its own balance, which is why it is a line at all.
 */

/** The extractor writes `${currency}_CUOTAS`; mappings saved by earlier parsers
 *  carry the halves the other way round. Both name the same thing. */
export function isInstallmentSection(sectionKey: string): boolean {
  return /(^|_)CUOTAS(_|$)/i.test(sectionKey);
}

export type LineNameForm = "plain" | "installments" | "installmentsWithCurrency";

export function suggestLineName({
  cardName,
  currency,
  sectionKey,
  takenNames,
  maxLength,
  format,
}: {
  cardName: string;
  currency: string;
  sectionKey: string;
  /** Names already on this card. A cuotas line only needs its currency spelled
   *  out when the card carries cuotas in more than one. */
  takenNames: string[];
  maxLength: number;
  /** Supplied by the caller so this stays pure — the real one calls next-intl. */
  format: (form: LineNameForm, card: string, currency: string) => string;
}): string {
  const compose = (card: string) => {
    if (!isInstallmentSection(sectionKey)) return format("plain", card, currency);
    const plain = format("installments", card, currency);
    return takenNames.includes(plain) ? format("installmentsWithCurrency", card, currency) : plain;
  };

  /* The card is trimmed rather than the composed string: cutting the tail would
     drop the very word that makes the line identifiable. */
  const full = compose(cardName);
  if (full.length <= maxLength) return full;
  return compose(cardName.slice(0, Math.max(1, cardName.length - (full.length - maxLength))).trim());
}
