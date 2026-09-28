/** The recurring-template filter behind Overview's "Upcoming" list and its
 *  "Disponible" figure. Kept out of queries.ts so it can be tested without a
 *  Supabase client, like its siblings here. */

/** Only what the rule reads. Both id fields are nullable in the table. */
export type OutgoingTemplate = {
  kind: string;
  to_account_id: string | null;
};

/**
 * Whether a recurring template is money actually leaving.
 *
 * This is the ONE rule both surfaces read. They have to agree: the hero figure
 * and the list of charges underneath it are two views of the same month, and a
 * template counted by one and not the other is a discrepancy a person can see.
 *
 * An expense always counts — nothing else on either surface knows about it.
 *
 * A payment counts only when it lands on a CREDIT CARD. The other two
 * destinations are both wrong to count, for different reasons:
 *
 *   to a loan    The loan's installment is already its own line, from
 *                loan_status, with the real due date and the real amount.
 *                Counting the template beside it bills the same money twice.
 *
 *   to own       A transfer between two of the person's own accounts. The money
 *                moves, but it never leaves — treating it as an upcoming charge,
 *                or subtracting it from what is available, makes a person poorer
 *                for having moved their own cash.
 *
 * A payment whose destination does not resolve — no account id, or an archived
 * account missing from the map — falls out with them. That is the safe side of
 * the guess: an unfinished template is not a bill.
 *
 * Income never reaches here; the query keeps the two outgoing kinds only.
 *
 * @param accountType Resolves an account id to its `accounts.type`.
 */
export function isOutgoing(
  template: OutgoingTemplate,
  accountType: (id: string) => string | undefined,
): boolean {
  if (template.kind === "expense") return true;
  if (template.kind !== "payment") return false;
  return !!template.to_account_id && accountType(template.to_account_id) === "credit_card";
}
