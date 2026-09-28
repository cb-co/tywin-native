/** The account, category and group options every transaction form offers. */

export type QuickAddAccount = {
  id: string;
  name: string;
  currency: string;
  type: string;
  network_fee_optional: boolean;
  bank_id: string | null;
  /* Both are needed client-side to preview what a row will cost before it is
     saved; the stored figures still come from the insert trigger. */
  transfer_tax_rate: number;
  network_fee_amount: number;
};

export type QuickAddCategory = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  /** The group this category rolls up to by default. The form shows it as the
   *  override select's resting value, so a person can see what they are
   *  departing from before they depart from it. */
  budget_group_id: string | null;
};

export type QuickAddBudgetGroup = {
  id: string;
  name: string;
  emoji: string | null;
};
