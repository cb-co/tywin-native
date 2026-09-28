type Slice = { name: string; value: number; color: string; emoji?: string | null; categoryId?: string | null };

export type ShareRow = {
  name: string;
  value: number;
  color: string;
  emoji?: string | null;
  pct: number;
  rest: boolean;
  /** The category (or categories, for the folded rest row) this row stands
   *  in for — see the function comment. */
  categoryIds: (string | null)[];
};

/** Ledger rows for a spend breakdown. Rows past `max` fold into one trailing
 *  `rest` row (its `name` is left empty for the caller to localise) so the
 *  printed amounts always add up to the total.
 *
 *  Every row carries `categoryIds` — the folded ones it stands in for, not
 *  just the one it's named after — so a caller that lets someone drill into
 *  a row (tap it, see the transactions behind it) can do that for the rest
 *  row too: querying its own single category would silently miss every
 *  other category padded into it. */
export function shareRows(data: Slice[], total: number, max = 7): ShareRow[] {
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const head = data
    .slice(0, max)
    .map((s) => ({ ...s, pct: pct(s.value), rest: false, categoryIds: [s.categoryId ?? null] }));
  const tail = data.slice(max);
  if (tail.length === 0) return head;
  const value = tail.reduce((sum, s) => sum + s.value, 0);
  return [
    ...head,
    {
      name: "",
      value,
      color: "var(--muted-foreground)",
      pct: pct(value),
      rest: true,
      categoryIds: tail.map((s) => s.categoryId ?? null),
    },
  ];
}
