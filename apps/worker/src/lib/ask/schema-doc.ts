import SCHEMA_DOC from "./schema-doc.md";

/**
 * The prose half of the model's schema knowledge.
 *
 * Kept as markdown and bundled as text, so that correcting a wrong answer is a
 * prose edit, not a code change.
 */
export function schemaDoc(): string {
  return SCHEMA_DOC;
}

/**
 * Every column name the document claims exists, per view.
 *
 * Parsed out of the markdown rather than maintained separately, because a
 * second list would drift from the first exactly as fast as the first drifts
 * from the database.
 *
 * Structure-aware on purpose. Taking every backticked token in a section would
 * also collect the prose — `expense`, `income`, `credit_card` are values, not
 * columns — and a drift test that compares those against the generated types
 * fails for a reason that has nothing to do with drift. So only two shapes
 * count, and `schema-doc.md` says so where an editor will read it:
 *
 *   - a table whose FIRST cell lists the columns it describes, and
 *   - a paragraph opening `Columns:` and ending at the first full stop.
 *
 * A column outside both is invisible here, which is why the drift test checks
 * the generated types for columns the document forgot as well as the reverse.
 */
const IDENT_RE = /`([a-z_][a-z0-9_]*)`/g;

export function documentedColumns(): Map<string, string[]> {
  const out = new Map<string, string[]>();

  for (const section of schemaDoc().split(/^## /m).slice(1)) {
    const view = section.split(/\s/)[0].trim();
    if (!view.startsWith("q_")) continue;

    const names = new Set<string>();

    for (const line of section.split("\n")) {
      if (!line.startsWith("|")) continue;
      const cell = line.split("|")[1] ?? "";
      if (/^\s*-+\s*$/.test(cell)) continue; // the header separator
      if (/^\s*column\s*$/i.test(cell)) continue; // the header itself
      for (const m of cell.matchAll(IDENT_RE)) names.add(m[1]);
    }

    const list = section.match(/^Columns:([\s\S]*?)\./m);
    if (list) for (const m of list[1].matchAll(IDENT_RE)) names.add(m[1]);

    out.set(view, [...names]);
  }

  return out;
}
