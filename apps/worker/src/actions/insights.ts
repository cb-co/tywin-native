import { z } from "zod";
import { getInsightsSpendTransactions } from "#/lib/insights/queries";
import type { TransactionWithRefs } from "#/lib/transactions/queries";

const spendDrilldown = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryIds: z.array(z.string().uuid().nullable()).min(1),
});

/**
 * The transactions behind one Insights spend-distribution row (a single
 * category, or every category folded into the "everything else" row).
 * Returns an empty list on bad input rather than an error: this runs on a
 * row tap, and a toast for a malformed argument would be noise the user
 * cannot act on.
 */
export async function loadInsightsSpendTransactions(
  rawMonth: unknown,
  rawCategoryIds: unknown,
): Promise<TransactionWithRefs[]> {
  const parsed = spendDrilldown.safeParse({ month: rawMonth, categoryIds: rawCategoryIds });
  if (!parsed.success) return [];
  return getInsightsSpendTransactions(parsed.data.month, parsed.data.categoryIds);
}
