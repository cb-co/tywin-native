/**
 * PDF → layout-preserved text for the statement parsers.
 *
 * pdfjs gives positioned text runs; parsers need lines where columns are
 * separated by 2+ spaces. Runs are grouped into rows by y (0.5pt tolerance —
 * real columns share an exact baseline y; see note below), sorted by x, and
 * joined with spacing proportional to the horizontal gap.
 * Passwords are used in memory only — never persisted (spec §3.1).
 *
 * pdfjs comes from unpdf, which builds it for Workers with the DOMMatrix/Path2D
 * polyfills and the in-process pdf worker already wired in.
 */
import { getResolvedPDFJS } from "unpdf";
import { STANDARD_FONTS } from "./standard-fonts";

/**
 * Hands pdfjs a standard font program from the bundle when a statement names one
 * without embedding it (see ./standard-fonts). pdfjs constructs it with its data
 * URLs, which there are none of here, and asks for files by name.
 */
class BundledFontData {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const font = kind === "standardFontDataUrl" ? STANDARD_FONTS[filename] : undefined;
    if (!font) throw new Error(`No bundled ${kind} data for ${filename}`);
    // A copy: pdfjs may transfer it to its worker, and the bundled bytes serve every request.
    return new Uint8Array(font.slice(0));
  }
}

export type ExtractResult =
  | { ok: true; text: string }
  | { ok: false; reason: "password_required" | "bad_password" | "unreadable" };

type Run = { str: string; x: number; y: number; w: number };

export async function extractStatementText(
  data: Uint8Array,
  password?: string,
): Promise<ExtractResult> {
  const { getDocument } = await getResolvedPDFJS();
  // pdfjs transfers (detaches) the input buffer to its worker via a
  // structuredClone transfer list — the caller's `data` would be unusable
  // after a single call, and a second extractStatementText() call reusing
  // the same buffer (wrong-password retry, or a caller that re-parses the
  // same in-memory bytes) throws DataCloneError: "Cannot transfer object of
  // unsupported type." Pass pdfjs a private copy so the caller's buffer is
  // never consumed and repeated calls on the same input keep working.
  const loadingTask = getDocument({
    data: data.slice(),
    password,
    // Fonts come from the bundle, through the in-process worker's message port.
    BinaryDataFactory: BundledFontData,
    useWorkerFetch: false,
  });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    // destroy() lives on the loading task, not on a (never-resolved) doc
    // proxy; call it here too so a wrong-password retry doesn't leak a worker
    // per attempt.
    await loadingTask.destroy();
    const e = err as { name?: string; code?: number };
    if (e.name === "PasswordException") {
      // code 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
      return { ok: false, reason: e.code === 2 ? "bad_password" : "password_required" };
    }
    return { ok: false, reason: "unreadable" };
  }

  try {
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const runs: Run[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        runs.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width,
        });
      }
      // Group into rows by y (descending page order). Columns within one real
      // row share an *exact* baseline y in these statements (0.00pt diff);
      // stray page furniture (running footer notes, page numbers) can land
      // within a couple points of an unrelated table row's y, so a loose
      // tolerance here risks splicing that furniture into a transaction line
      // and corrupting the parser regexes. 0.5pt allows for float rounding
      // noise while still keeping distinct visual rows apart.
      runs.sort((a, b) => b.y - a.y || a.x - b.x);
      const rows: Run[][] = [];
      for (const run of runs) {
        const row = rows[rows.length - 1];
        if (row && Math.abs(row[0].y - run.y) <= 0.5) row.push(run);
        else rows.push([run]);
      }
      const lines = rows.map((row) => {
        row.sort((a, b) => a.x - b.x);
        let line = "";
        let cursor = 0; // running x in pt
        for (const run of row) {
          const gap = run.x - cursor;
          // ~4pt per character; 2+ spaces marks a column boundary for the
          // parsers. A gap over 6pt (more than a space-and-a-half at this
          // scale) is treated as a genuine column break and floored to 2
          // spaces even if the rounded gap/4 would give fewer, so adjacent
          // columns with a modest gap don't collapse to a single space.
          const spaces = line === "" ? Math.round(run.x / 4) : Math.max(gap > 6 ? 2 : 1, Math.round(gap / 4));
          line += " ".repeat(Math.max(spaces, line === "" ? 0 : 1)) + run.str;
          cursor = run.x + run.w;
        }
        return line;
      });
      pages.push(lines.join("\n"));
    }
    return { ok: true, text: pages.join("\n") };
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    // destroy() lives on the loading task, not on the resolved
    // PDFDocumentProxy; run unconditionally so a mid-loop failure doesn't
    // leak the worker/transport.
    await loadingTask.destroy();
  }
}
