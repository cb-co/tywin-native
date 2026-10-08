import type { createClient } from "#/lib/supabase/server";
import { dayAfter } from "@cigua/core/overview/card-due";

export type CardRow = {
  account_id: string | null;
  latest_statement_balance: number | null;
  latest_period_end: string | null;
};

/** Payments made against each card's latest statement, in the card's own
 *  currency — i.e. transactions into the card dated after that statement
 *  closed. Anything on or before the closing date is already netted into
 *  `statement_balance`, and later charges belong to the next statement, so its
 *  closing date is the only correct cut-off. Mirrors the coalesce the balance
 *  views use for the destination leg (20260720093500_payment_destination_amount).
 */
export async function statementPaymentsByCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cards: CardRow[],
): Promise<Map<string, number>> {
  const settled = cards.filter(
    (c): c is CardRow & { account_id: string; latest_period_end: string } =>
      !!c.account_id && !!c.latest_period_end && c.latest_statement_balance != null,
  );
  if (settled.length === 0) return new Map();

  // One round trip for every card: filter from the earliest cut-off, then
  // apply each card's own cut-off in memory.
  const earliest = settled.reduce(
    (min, c) => (c.latest_period_end < min ? c.latest_period_end : min),
    settled[0].latest_period_end,
  );

  const { data: rows } = await supabase
    .from("transactions")
    .select("to_account_id,amount,to_amount,occurred_at")
    .eq("type", "payment")
    .in(
      "to_account_id",
      settled.map((c) => c.account_id),
    )
    .gte("occurred_at", dayAfter(earliest));

  const cutoff = new Map(settled.map((c) => [c.account_id, dayAfter(c.latest_period_end)]));
  const paid = new Map<string, number>();
  for (const r of rows ?? []) {
    const id = r.to_account_id;
    if (!id) continue;
    const from = cutoff.get(id);
    if (!from || r.occurred_at.slice(0, 10) < from) continue;
    paid.set(id, (paid.get(id) ?? 0) + Number(r.to_amount ?? r.amount ?? 0));
  }
  return paid;
}
