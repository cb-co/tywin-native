import { becomesTransaction, type ParsedStatement } from "./types";

export type SheetRow = {
  key: string;
  /** `DD/MM`, as the statement prints it. */
  date: string;
  /** The bank's own text, untouched. */
  text: string;
  /** A non-negative magnitude in the section's currency. */
  amount: number;
  /** A negative line: money back to the card. */
  credit: boolean;
};

/**
 * The first `limit` lines that become transactions (payments and adjustments are left off) of one section of the statement the dialog has
 * already parsed, plus how many were left off. Reads the JSON the client
 * echoes back on confirm, so no request is needed and no figure is invented.
 * Anything unreadable degrades to an empty sheet rather than throwing inside
 * a dialog.
 */
export function sheetRows(
  parsedStatement: string | null,
  sectionKey: string,
  limit: number,
): { rows: SheetRow[]; more: number } {
  if (!parsedStatement) return { rows: [], more: 0 };
  let parsed: ParsedStatement;
  try {
    parsed = JSON.parse(parsedStatement) as ParsedStatement;
  } catch {
    return { rows: [], more: 0 };
  }
  const section = parsed.sections?.find((s) => s.sectionKey === sectionKey);
  if (!section?.lines) return { rows: [], more: 0 };
  const real = section.lines.filter((l) => becomesTransaction(l.kind));
  const rows = real.slice(0, limit).map((l) => {
    const madeOn = l.madeOn ?? "";
    return {
      key: `${sectionKey}-${l.lineNo}`,
      date: `${madeOn.slice(8, 10)}/${madeOn.slice(5, 7)}`,
      text: l.description ?? "",
      amount: Math.abs(l.amountCents) / 100,
      credit: l.amountCents < 0,
    };
  });
  return { rows, more: Math.max(0, real.length - rows.length) };
}
