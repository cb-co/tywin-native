/**
 * The currency lines of one physical card, projected for NAVIGATION.
 *
 * The read-time counterpart to `card-lines.ts`: that module decides which lines
 * a card is SAVED as when the account dialog's two questions are answered, this
 * one reads the lines back off the accounts table so a line's detail page can
 * show its siblings and link to them.
 *
 * Kept apart from `getCardGroupSiblings` / `resolveEffectiveBonus` as well. That
 * pair answers "which welcome-bonus goal governs this card", and its row type is
 * threaded through the account form and the detail actions; widening that type
 * to serve a nav rail would make one shape answer to two unrelated features.
 */

/** The account columns the rail needs. A subset of the accounts row. */
export type GroupLineRow = {
  id: string;
  name: string;
  currency: string;
  is_archived: boolean;
};

export type CardGroupLine = {
  id: string;
  /** What the segment reads — see `cardLineLabel`. */
  label: string;
  /** True for the line whose page is being rendered. */
  isCurrent: boolean;
};

/** Leading/trailing separator debris left behind once a prefix is removed. */
const EDGE_PUNCTUATION = /^[\s·\-–—:|,/]+|[\s·\-–—:|,/]+$/g;

function words(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

/**
 * What one line is called, once its card's name is taken out of it.
 *
 * A line's stored name almost always restates the card: the account dialog
 * generates "Visa Infinite · USD", and hand-made lines are commonly just "AMEX
 * Platinum" twice over. Printing those verbatim in a switcher wastes the whole
 * width on the one fact every segment shares — the detail page's breadcrumb and
 * card face have already said which card this is — and leaves two segments
 * reading identically, which is the failure the rail exists to fix.
 *
 * So: drop the leading words the line shares with its group, keep the remainder.
 *
 *   "VISA GOLD ROSE · USD" in "VISA GOLD ROSE" → "USD"
 *   "AMEX Cuotas"          in "AMEX Platinum"  → "Cuotas"
 *
 * When nothing survives — a line named exactly after its card, which is the
 * common case for cards created before the dialog generated names — the
 * currency code stands in. It is the true distinguishing fact anyway, and a
 * card's lines are rarely two of the same currency.
 *
 * Comparison is case-insensitive because the same card is written "VISA GOLD
 * ROSE" and "Visa Infinite" in the same table; matching is per WORD rather than
 * by raw string prefix so "AMEX Cuotas" sheds "AMEX" instead of failing to match
 * "AMEX Platinum" and printing in full.
 */
export function cardLineLabel(lineName: string, groupName: string, currency: string): string {
  const line = words(lineName);
  const group = words(groupName);

  let shared = 0;
  while (
    shared < line.length &&
    shared < group.length &&
    line[shared].toLowerCase() === group[shared].toLowerCase()
  ) {
    shared++;
  }

  const remainder = line.slice(shared).join(" ").replace(EDGE_PUNCTUATION, "");
  return remainder || currency;
}

/**
 * Projects a group's account rows into rail segments, in the order given.
 *
 * Archived lines are dropped, because the accounts grid drops them too and a
 * rail that offers a route to a card you have retired is offering a dead end.
 * The EXCEPTION is the current line: its own detail page stays reachable after
 * archiving, and a rail rendered there that omitted the page you are standing on
 * would show no segment as current.
 */
export function buildCardGroupLines(
  rows: GroupLineRow[],
  groupName: string,
  currentId: string,
): CardGroupLine[] {
  return rows
    .filter((r) => !r.is_archived || r.id === currentId)
    .map((r) => ({
      id: r.id,
      label: cardLineLabel(r.name, groupName, r.currency),
      isCurrent: r.id === currentId,
    }));
}
