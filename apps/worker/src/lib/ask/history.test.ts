import { describe, expect, it } from "vitest";
import { MAX_TOTAL_BYTES, stillTooLarge, trimHistory } from "./history";

/** An assistant turn the size the real ones are: prose plus its tool rows. */
function heavy(i: number) {
  return {
    id: `a${i}`,
    role: "assistant",
    parts: [{ type: "tool-askQuery", output: { rows: Array.from({ length: 60 }, () => ({
      description: "7-ELEVEN 15525 0007155252, SEATAC",
      occurred_at: "2026-08-09T00:00:00+00:00",
      base_total_amount: 4.18,
      currency: "USD",
    })) } }],
  };
}

const ask = (i: number) => ({ id: `u${i}`, role: "user", parts: [{ type: "text", text: "q" }] });

describe("trimHistory", () => {
  it("leaves a short conversation alone", () => {
    const messages = [ask(1), heavy(1), ask(2)];
    expect(trimHistory(messages)).toEqual(messages);
  });

  /* The failure this replaces: a data-heavy answer made the NEXT question a 400.
     Forgetting the beginning of an unpersisted chat is the cheaper loss. */
  it("drops the oldest turns instead of refusing the question", () => {
    const messages = [...Array.from({ length: 40 }, (_, i) => [ask(i), heavy(i)]).flat(), ask(99)];
    const trimmed = trimHistory(messages);

    expect(stillTooLarge(trimmed)).toBe(false);
    expect(trimmed.length).toBeLessThan(messages.length);
  });

  it("always keeps the question being asked", () => {
    const messages = [...Array.from({ length: 40 }, (_, i) => heavy(i)), ask(99)];
    const trimmed = trimHistory(messages);
    expect(trimmed.at(-1)).toEqual(ask(99));
  });

  /* A transcript that opens on an assistant turn — or on a tool result whose
     call was trimmed away — is a shape a provider may reject outright. */
  it("opens the trimmed transcript on a user turn", () => {
    const messages = [...Array.from({ length: 40 }, (_, i) => [ask(i), heavy(i)]).flat(), ask(99)];
    expect(trimHistory(messages)[0].role).toBe("user");
  });

  it("reports a single question that cannot fit at all", () => {
    const huge = { id: "u1", role: "user", parts: [{ type: "text", text: "x".repeat(MAX_TOTAL_BYTES + 1) }] };
    expect(stillTooLarge(trimHistory([huge]))).toBe(true);
  });
});
