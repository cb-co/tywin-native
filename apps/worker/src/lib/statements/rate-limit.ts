import { createRateLimiter } from "#/lib/rate-limit";

/**
 * How many statements one person may send to extraction per window.
 *
 * Every parse is a PDF render plus a Gemini call, and until the native app existed
 * the only way to trigger one was the upload dialog, which paced itself. A phone
 * can POST in a loop. Ten in ten minutes is well above an honest session (a
 * person with five cards importing each, with a retry or two) and far below a
 * quota-burning one.
 */
export const STATEMENT_PARSE_MAX_PER_WINDOW = 10;
export const STATEMENT_PARSE_WINDOW_MS = 10 * 60_000;

const limiter = createRateLimiter({
  max: STATEMENT_PARSE_MAX_PER_WINDOW,
  windowMs: STATEMENT_PARSE_WINDOW_MS,
});

export function takeStatementParseToken(userId: string, now: number): boolean {
  return limiter.take(userId, now);
}

/** Test seam. */
export function resetStatementParseRateLimit(): void {
  limiter.reset();
}
