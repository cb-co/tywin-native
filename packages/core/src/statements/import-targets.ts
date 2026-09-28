/**
 * Turning the flat list of card accounts a statement could be imported onto
 * into the list of *physical cards* a person would recognise.
 *
 * Every currency line of a grouped card is its own account row, so a single
 * "Visa Infinite" with DOP, USD and cuotas lines arrives as three targets. Shown
 * raw that reads as three cards, which is the wrong question entirely — nobody
 * chooses which line of their card a statement belongs to; the statement covers
 * the whole card. The server rebuilds the real option list from the group on
 * both parse and confirm, so any one of the lines is an equally correct handle
 * on the card and the choice of which is not load-bearing.
 */

export type ImportTarget = {
  id: string;
  name: string;
  currency: string;
  last4: string | null;
  /** Set when this account is one line of a multi-line physical card. */
  cardGroupId: string | null;
  /** The physical card's name. Null for an ungrouped card, whose own name is it. */
  groupName: string | null;
};

export type ImportTargetRow = {
  /** The account to run the import against — for a grouped card, the first of
   *  its lines. `loadAccountContext` expands it back to the whole group. */
  accountId: string;
  label: string;
  /** Null for a grouped card: it holds several, so naming one would mislead. */
  currency: string | null;
  last4: string | null;
};

/** One row per physical card, in the order the accounts arrived. */
export function collapseImportTargets(targets: ImportTarget[]): ImportTargetRow[] {
  const rows: ImportTargetRow[] = [];
  const rowByGroup = new Map<string, ImportTargetRow>();

  for (const t of targets) {
    if (!t.cardGroupId) {
      rows.push({ accountId: t.id, label: t.name, currency: t.currency, last4: t.last4 });
      continue;
    }
    const existing = rowByGroup.get(t.cardGroupId);
    if (existing) {
      // Only some lines of a card tend to carry the digits; the first that does wins.
      existing.last4 ??= t.last4;
      continue;
    }
    const row: ImportTargetRow = {
      accountId: t.id,
      // A group with no name of its own still has to be called something, and
      // its first line's name is the closest thing to the card's.
      label: t.groupName ?? t.name,
      currency: null,
      last4: t.last4,
    };
    rowByGroup.set(t.cardGroupId, row);
    rows.push(row);
  }

  return rows;
}
