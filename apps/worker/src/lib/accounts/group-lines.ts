/**
 * The lines of one physical card, projected for NAVIGATION: the detail page's
 * rail shows a line's siblings and links to them.
 *
 * Kept apart from `getCardGroupSiblings` / `resolveEffectiveBonus`. That pair
 * answers "which welcome-bonus goal governs this card", and its row type is
 * threaded through the account form and the detail actions; widening that type
 * to serve a nav rail would make one shape answer to two unrelated features.
 */
import { compareCardLines, isCardLine, type CardLine } from "@cigua/core/accounts/card-lines";

/** The account columns the rail needs. A subset of the accounts row. */
export type GroupLineRow = {
  id: string;
  card_line: string | null;
  is_archived: boolean;
};

export type CardGroupLine = {
  id: string;
  /** Which line this is; the app labels it (DOP, USD, Cuotas). */
  line: CardLine;
  /** True for the line whose page is being rendered. */
  isCurrent: boolean;
};

/**
 * Projects a group's account rows into rail segments, always DOP, USD, Cuotas.
 *
 * Archived lines are dropped, because the accounts grid drops them too and a
 * rail that offers a route to a card you have retired is offering a dead end.
 * The EXCEPTION is the current line: its own detail page stays reachable after
 * archiving, and a rail rendered there that omitted the page you are standing on
 * would show no segment as current.
 */
export function buildCardGroupLines(rows: GroupLineRow[], currentId: string): CardGroupLine[] {
  return rows
    .filter((r) => isCardLine(r.card_line) && (!r.is_archived || r.id === currentId))
    .sort((a, b) => compareCardLines(a.card_line, b.card_line))
    .map((r) => ({ id: r.id, line: r.card_line as CardLine, isCurrent: r.id === currentId }));
}
