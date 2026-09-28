import "./pdf-polyfills";
import { scrubPii } from "@cigua/core/statements/scrub-pii";
import { statementText, type TextRun } from "@cigua/core/statements/layout";
import type { PDFPageProxy } from "unpdf/pdfjs";

export type ExtractResult =
  | { ok: true; text: string }
  | { ok: false; reason: "password_required" | "bad_password" | "unreadable" };

/**
 * Reads a statement PDF on the phone and returns its text, laid out the way the
 * statement reader expects, with personal details scrubbed. Only this text goes
 * to the API: the PDF and its password never leave the device.
 *
 * pdfjs (unpdf's build, made for runtimes without a DOM or Web Workers) is loaded
 * the first time a statement is read, not at launch. It runs text-only: no wasm
 * image decoders, and the standard fonts come from pdfjs's own metrics, which is
 * what a browser does, rather than from font files the app would have to ship.
 */
export async function extractStatementText(data: Uint8Array, password?: string): Promise<ExtractResult> {
  const { getDocument } = await import("unpdf/pdfjs");
  // pdfjs takes ownership of the buffer it is given; a copy keeps the caller's
  // bytes usable for a retry with a password.
  const loadingTask = getDocument({
    data: data.slice(),
    password,
    useSystemFonts: true,
    disableFontFace: true,
    useWasm: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    verbosity: 0,
  });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    await loadingTask.destroy();
    const e = err as { name?: string; code?: number };
    // code 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
    if (e.name === "PasswordException") return { ok: false, reason: e.code === 2 ? "bad_password" : "password_required" };
    return { ok: false, reason: "unreadable" };
  }

  try {
    const pages: TextRun[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      pages.push(await pageRuns(page));
      page.cleanup();
    }
    return { ok: true, text: scrubPii(statementText(pages)) };
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    await loadingTask.destroy();
  }
}

type TextChunk = Pick<Awaited<ReturnType<PDFPageProxy["getTextContent"]>>, "items">;

/**
 * A page's positioned text. Reads pdfjs's text stream directly: getTextContent
 * walks it with `for await`, which Babel compiles to a Symbol.asyncIterator
 * lookup that Expo's stream polyfill keys differently when Hermes lacks it.
 */
async function pageRuns(page: PDFPageProxy): Promise<TextRun[]> {
  const reader = page.streamTextContent().getReader();
  const runs: TextRun[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return runs;
    for (const item of (value as TextChunk).items) {
      if (!("str" in item) || !item.str.trim()) continue;
      runs.push({ str: item.str, x: item.transform[4], y: item.transform[5], w: item.width });
    }
  }
}

/** The picked file's bytes. */
export async function readPdf(uri: string): Promise<Uint8Array> {
  const { File } = await import("expo-file-system");
  return new Uint8Array(await new File(uri).arrayBuffer());
}
