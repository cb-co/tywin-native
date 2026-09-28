/**
 * How long an inference call may run, which depends entirely on whether anyone
 * is waiting for it.
 *
 * Measured against the real endpoint, these calls answer in about 600ms when
 * the process has already made one — and take 9 to 70 SECONDS when it has not.
 * The first call in a fresh Node process is the slow one; a plain `fetch` to the
 * same host beforehand is enough to make the next one fast, so the cost is
 * something the SDK does on first use rather than the model thinking. The AI
 * SDK's own retries sit inside that window.
 *
 * That spread is the whole design problem. A budget short enough to keep a save
 * responsive is shorter than the cold call, so it loses the answer every time
 * the process is cold; a budget long enough to catch the cold call is far longer
 * than anyone will sit in front of a spinner. There is no single number that
 * works for a call made INSIDE a save, which is why the subscription colour is
 * no longer resolved there.
 */

/**
 * For inference that still blocks a save — currently only card art, inside
 * createAccount and updateAccount.
 *
 * Chosen to protect the save, knowing it forfeits the answer on a cold call: the
 * card is written without an accent and renders DEFAULT_CARD_ACCENT, and the
 * next edit of that card tries again. Card art has the same structural problem
 * the subscription colour just had, and wants the same treatment.
 */
export const BLOCKING_INFERENCE_BUDGET_MS = 6_000;

/**
 * For inference that runs after the save has already returned, where the only
 * cost of waiting is that a colour appears late.
 *
 * Generous on purpose. This is what makes the cold call — the case a blocking
 * budget can never afford — actually succeed, which is the difference between a
 * feature that works and one that silently writes nothing.
 */
export const DEFERRED_INFERENCE_BUDGET_MS = 90_000;

/**
 * An abort signal for one inference call.
 *
 * Passed to the AI SDK as `abortSignal`, which bounds the WHOLE operation
 * rather than one attempt — retries and backoff included. Capping attempts
 * instead would not have worked: a single slow attempt is the actual failure
 * mode, and it can outlast several fast retries on its own.
 */
export function inferenceSignal(budgetMs: number): AbortSignal {
  return AbortSignal.timeout(budgetMs);
}

/**
 * For the one inference the user actually sits and waits for.
 *
 * Bounds the WHOLE multi-step loop, not one call, so up to five inference turns
 * and the database round-trips between them share it.
 *
 * 45s, up from the 15s this started at, because the loop is now up to seven
 * inference turns with a database round-trip between each. This is the one
 * surface where the wait is legible while it happens — each query narrates
 * itself from the `purpose` the model supplies — so the ceiling that matters is
 * the one where someone gives up, not the one where a spinner gets boring.
 *
 * The failure this replaces was not a slow answer, it was no answer: a loop cut
 * off mid-plan renders "I ran out of tries", and someone who waited ten seconds
 * for that would rather have waited twenty-five and been told the number.
 */
export const CHAT_INFERENCE_BUDGET_MS = 45_000;
