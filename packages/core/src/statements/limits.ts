/** How big a statement PDF the importer accepts.
 *
 *  Real statements run well past 1MB — a text-layer PDF is a few hundred KB,
 *  but one carrying page images or a scanned insert runs to several MB. The app
 *  checks it before uploading, so the person gets a clear message instead of a
 *  failed request; the API checks it again on arrival. */
export const MAX_STATEMENT_BYTES = 10 * 1024 * 1024;

/** How much statement text the reader accepts. The phone pulls the text out of
 *  the PDF and sends only that; a long statement runs to a few hundred KB of
 *  text, so anything past this is not a statement. */
export const MAX_STATEMENT_TEXT_CHARS = 600_000;
