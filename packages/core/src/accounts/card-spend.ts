import { CHART_FALLBACK } from "../chart-series";

/** The columns the distribution actually reads. Deliberately a structural type
 *  rather than the generated Row: the query selects two columns, and asking
 *  callers for a whole transaction would be a lie about what this needs. */
export type CardSpendTransaction = {
  category_id: string | null;
  total_amount: number | string | null;
};

export type SpendCategory = { id: string; name: string; color: string | null; emoji?: string | null };

/** The shape the Insights spend ledger is fed — which is what lets this reuse
 *  `<SpendLedger>` rather than grow a second ledger component that would drift
 *  from it. */
export type SpendSlice = {
  name: string;
  value: number;
  color: string;
  emoji?: string | null;
  /** Null for the uncategorized/deleted-category bucket — nothing to drill into. */
  categoryId: string | null;
};

/**
 * What a card was charged for, by category, over whatever window the caller
 * selected.
 *
 * Amounts stay in the CARD's own currency and are never converted: every
 * transaction here posted to one account, so they already share a currency and
 * summing them needs no rate. That is also why a card group's other currency
 * lines are not folded in — a DOP line and a USD line only add up through
 * today's FX rate, which would make the panel's total drift day to day while
 * the underlying charges sat still.
 *
 * The inclusion rule is NOT the one `spend_distribution` uses for the Insights
 * ledger, because this panel answers a different question. `exclude_from_budget`
 * rows are kept (the caller does not filter them): they are excluded from
 * budgets, not from reality — the charge hit the card and is sitting in the
 * balance shown at the top of the page. Dropping them would leave a ledger that
 * quietly disagreed with the statement above it.
 */
export function cardSpendDistribution(
  transactions: CardSpendTransaction[],
  categories: SpendCategory[],
  uncategorizedLabel: string,
): SpendSlice[] {
  const catById = new Map(categories.map((c) => [c.id, c]));

  // Keyed by category id, with "" standing in for a charge whose category was
  // deleted out from under it (`category_id` is ON DELETE SET NULL). Those fold
  // into a single slice rather than one slice each.
  const totals = new Map<string, number>();
  for (const t of transactions) {
    const value = Number(t.total_amount ?? 0);
    // Guards a NaN from a malformed numeric as much as it drops zero rows: a
    // NaN slice renders as an invisible wedge and poisons the total.
    if (!(value > 0)) continue;
    const key = t.category_id ?? "";
    totals.set(key, (totals.get(key) ?? 0) + value);
  }

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    // Indexed AFTER the sort, so the fallback colours run in the ledger's own
    // order instead of the order rows happened to arrive in.
    .map(([id, value], i) => {
      const cat = catById.get(id);
      return {
        name: cat?.name ?? uncategorizedLabel,
        value,
        color: cat?.color ?? CHART_FALLBACK[i % CHART_FALLBACK.length],
        emoji: cat?.emoji,
        categoryId: cat?.id ?? null,
      };
    });
}

/** Σ of the slices. Taken off the distribution rather than the raw rows so the
 *  centred total can never disagree with the arcs drawn around it. */
export function spendTotal(slices: SpendSlice[]): number {
  return slices.reduce((sum, s) => sum + s.value, 0);
}
