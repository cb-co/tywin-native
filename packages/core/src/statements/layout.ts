/**
 * Positioned PDF text → the layout-preserved lines the statement reader expects.
 *
 * pdfjs gives text runs with positions; the reader wants lines where columns are
 * separated by 2+ spaces. Runs are grouped into rows by y, sorted by x, and joined
 * with spacing proportional to the horizontal gap.
 */

/** One pdfjs text run: its string, baseline origin (pt) and advance width (pt). */
export type TextRun = { str: string; x: number; y: number; w: number };

/**
 * One page's runs as lines, top to bottom.
 *
 * Rows group on y within 0.5pt. Columns within one real row share an exact
 * baseline in these statements; page furniture (running footer notes, page
 * numbers) can land within a couple of points of an unrelated row, so a loose
 * tolerance would splice it into a transaction line and break the reader. 0.5pt
 * absorbs float noise while keeping distinct rows apart.
 */
export function pageLines(input: TextRun[]): string[] {
  const runs = input.filter((r) => r.str.trim());
  runs.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextRun[][] = [];
  for (const run of runs) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - run.y) <= 0.5) row.push(run);
    else rows.push([run]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let line = "";
    let cursor = 0; // running x in pt
    for (const run of row) {
      const gap = run.x - cursor;
      // ~4pt per character; 2+ spaces marks a column boundary. A gap over 6pt
      // (more than a space and a half at this scale) is a genuine column break and
      // floors to 2 spaces even when gap/4 rounds lower, so adjacent columns with a
      // modest gap don't collapse into one.
      const spaces = line === "" ? Math.round(run.x / 4) : Math.max(gap > 6 ? 2 : 1, Math.round(gap / 4));
      line += " ".repeat(Math.max(spaces, line === "" ? 0 : 1)) + run.str;
      cursor = run.x + run.w;
    }
    return line;
  });
}

/** Every page's lines, pages joined with a newline. */
export function statementText(pages: TextRun[][]): string {
  return pages.map((p) => pageLines(p).join("\n")).join("\n");
}
