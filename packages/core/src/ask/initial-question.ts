/**
 * The longest question that may arrive by URL.
 *
 * Matches the `maxLength` on the Overview entry that writes these links, so a
 * question typed there always survives the trip. Anything longer did not come
 * from that box.
 */
export const MAX_INITIAL_QUESTION = 300;

/**
 * A question handed to /ask through `?q=`, or null.
 *
 * The Overview entry is a text box on one page that submits to another, so the
 * question travels in the URL — which makes this a string from outside the app
 * that ends up in a model prompt and on the bill. Not a security boundary (the
 * guard, RLS and the rate limiter are all still in the way, and the worst case
 * is the asker's own data), but it is a spend boundary: a link is shareable and
 * arriving on the page sends it without anyone pressing anything.
 *
 * So: trimmed, and refused outright past MAX_INITIAL_QUESTION rather than
 * truncated. Cutting a question in half changes what was asked and the person
 * would never know why the answer was strange — refusing leaves them looking at
 * an empty box they can type into, which is at least honest.
 */
export function initialQuestion(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;

  const question = raw.trim();
  if (!question) return null;
  if (question.length > MAX_INITIAL_QUESTION) return null;

  return question;
}
