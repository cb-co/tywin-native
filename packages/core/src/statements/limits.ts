/** How big a statement PDF the importer accepts.
 *
 *  Real statements run well past 1MB — a text-layer PDF is a few hundred KB,
 *  but one carrying page images or a scanned insert runs to several MB. The app
 *  checks it before uploading, so the person gets a clear message instead of a
 *  failed request; the API checks it again on arrival. */
export const MAX_STATEMENT_BYTES = 10 * 1024 * 1024;
