/**
 * How much conversation may be replayed into one question.
 *
 * The client is the only place this chat exists — nothing is persisted — so every
 * question arrives carrying the whole transcript, and a transcript is not just
 * prose. Each assistant turn brings its tool input, its tool OUTPUT (rows), and
 * the provider's thought signatures back with it. One answer about sixteen
 * transactions is a four-kilobyte message before anyone has typed a follow-up.
 *
 * Which is what a per-message cap got wrong: it measured the wrong thing, at the
 * wrong size, and turned a successful data-heavy answer into a 400 on the NEXT
 * question. The thing worth bounding was never one message — it is the prompt,
 * and therefore the total.
 */
export const MAX_MESSAGES = 40;

/** Roughly 50k tokens of transcript, tool rows included. */
export const MAX_TOTAL_BYTES = 200_000;

type Turn = { role: string };

/**
 * Drops the oldest turns until the transcript fits, rather than refusing it.
 *
 * Refusing is the wrong shape of answer to "this conversation got long": the
 * person did nothing wrong, their question is perfectly good, and a 400 reads as
 * the feature breaking. Forgetting the beginning of a chat nobody persists costs
 * almost nothing by comparison — and it is what every long conversation
 * eventually needs anyway.
 *
 * The last turn is always kept: it is the question being asked. And trimming
 * stops on a `user` turn, because a conversation that opens on an assistant
 * message — or worse, on a tool result whose call has been trimmed away — is a
 * shape providers are entitled to reject.
 */
export function trimHistory<T extends Turn>(messages: T[]): T[] {
  let start = 0;
  const last = messages.length - 1;

  while (start < last && JSON.stringify(messages.slice(start)).length > MAX_TOTAL_BYTES) {
    start++;
  }

  while (start < last && messages[start].role !== "user") start++;

  return messages.slice(start);
}

/** Whether even the trimmed transcript is too large to send. */
export function stillTooLarge<T extends Turn>(messages: T[]): boolean {
  return JSON.stringify(messages).length > MAX_TOTAL_BYTES;
}
