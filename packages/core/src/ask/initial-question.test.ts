import { describe, expect, it } from "vitest";
import { initialQuestion, MAX_INITIAL_QUESTION } from "./initial-question";

describe("initialQuestion", () => {
  it("passes a real question through", () => {
    expect(initialQuestion("how much did I spend on groceries?")).toBe(
      "how much did I spend on groceries?",
    );
  });

  it("trims", () => {
    expect(initialQuestion("  what did I spend  ")).toBe("what did I spend");
  });

  it.each([[null], [undefined], [""], ["   "]])("ignores %s", (raw) => {
    expect(initialQuestion(raw)).toBeNull();
  });

  /* Arriving on the page sends this without anyone pressing anything, and a
     link is shareable — so the length that the Overview box can produce is the
     length that is accepted. */
  it("accepts a question at the limit", () => {
    const q = "a".repeat(MAX_INITIAL_QUESTION);
    expect(initialQuestion(q)).toBe(q);
  });

  it("refuses one past it rather than cutting it in half", () => {
    expect(initialQuestion("a".repeat(MAX_INITIAL_QUESTION + 1))).toBeNull();
  });

  it("ignores a non-string, which is what a repeated ?q= arrives as", () => {
    expect(initialQuestion(["a", "b"] as unknown as string)).toBeNull();
  });
});
