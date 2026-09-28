/**
 * Closes markdown that is still arriving, so a streaming answer never flashes
 * its own syntax.
 *
 * The answer is rendered token by token as the model writes it, which means the
 * renderer is handed a half-written string many times a second. Mid-word, a
 * bolded figure looks like `You spent **$464` — valid markdown with no closing
 * delimiter, so a CommonMark parser is right to render the asterisks as text.
 * The result is that every figure in every answer stutters through a literal
 * `**` before snapping into bold, which is exactly the noise a person reads as
 * the app being broken.
 *
 * `streamdown` exists to solve this and brings `mermaid` with it — a diagram
 * engine, to format a list of card transactions. This function is the part of
 * it this product actually needs.
 *
 * Deliberately narrow: bold and code spans only. Single asterisks are left
 * exactly as they arrive, because issuer descriptors contain them — "TST* Kedai
 * Makan Capitol" is a real statement line — and CommonMark already reads that
 * one as text, since an asterisk followed by a space cannot open emphasis.
 * Balancing it would invent an italic run across the rest of the answer.
 */
export function closeOpenMarkdown(text: string): string {
  /* Backticks first. Inside an open code span every other delimiter is literal,
     so the bold count below has to be taken on the text OUTSIDE the spans or a
     `base_amount` mid-stream would be read as an opening emphasis run. */
  const segments = text.split("`");
  const codeSpanOpen = segments.length % 2 === 0;
  const outsideCode = segments.filter((_, i) => i % 2 === 0).join("");

  const bolds = outsideCode.match(/\*\*/g)?.length ?? 0;
  const boldOpen = bolds % 2 === 1;

  /* Order matters: the code span closes against the backtick that opened it,
     and only then can a bold run that started before it be closed around the
     whole thing. */
  return `${text}${codeSpanOpen ? "`" : ""}${boldOpen ? "**" : ""}`;
}
