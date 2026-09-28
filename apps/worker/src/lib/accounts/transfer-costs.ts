export type TransferCostRow = { fee_amount: number | null; tax_amount: number | null };

/**
 * Fees and tax one account paid, in its own currency.
 *
 * Every row is a transaction whose `account_id` is this account, so no FX:
 * transactions_compute_amounts() derives tax from the source account's
 * transfer_tax_rate and commission from its network_fee_amount, both in that
 * account's currency, on ANY transaction type — an expense paid from checking
 * carries them just like a transfer does.
 */
export function sumAccountTransferCosts(rows: TransferCostRow[]): { fees: number; tax: number } {
  let fees = 0;
  let tax = 0;
  for (const r of rows) {
    fees += Number(r.fee_amount ?? 0);
    tax += Number(r.tax_amount ?? 0);
  }
  return { fees: Math.round(fees * 100) / 100, tax: Math.round(tax * 100) / 100 };
}
