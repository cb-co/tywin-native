import { describe, expect, it } from "vitest";
import { closeOpenMarkdown } from "./markdown";

describe("closeOpenMarkdown", () => {
  it("leaves finished markdown alone", () => {
    const done = "You spent **$464.08** on your Amex.";
    expect(closeOpenMarkdown(done)).toBe(done);
  });

  it("leaves plain prose alone", () => {
    expect(closeOpenMarkdown("There is nothing recorded for July.")).toBe(
      "There is nothing recorded for July.",
    );
  });

  it("closes a bold run that is still arriving", () => {
    expect(closeOpenMarkdown("You spent **$464")).toBe("You spent **$464**");
  });

  it("closes only the last of several bold runs", () => {
    expect(closeOpenMarkdown("**Aug 9:** 7-Eleven, **Aug 10")).toBe(
      "**Aug 9:** 7-Eleven, **Aug 10**",
    );
  });

  it("closes an unterminated code span", () => {
    expect(closeOpenMarkdown("the column `base_amount")).toBe("the column `base_amount`");
  });

  /* The case that makes a naive asterisk count wrong. Issuer descriptors carry
     literal asterisks — "TST* Kedai Makan Capitol" is a real row from a real
     statement — and CommonMark already reads that one as text, because an
     asterisk followed by a space cannot open emphasis. Closing it would invent
     an italic run across the rest of the answer. */
  it("does not close a lone asterisk that came from the data", () => {
    const row = "- Aug 9: TST* Kedai Makan Capitol ($35.22)";
    expect(closeOpenMarkdown(row)).toBe(row);
  });

  it("does not mistake a bullet marker for emphasis", () => {
    const list = "* Alimentación\n* Transporte";
    expect(closeOpenMarkdown(list)).toBe(list);
  });

  it("survives the empty string", () => {
    expect(closeOpenMarkdown("")).toBe("");
  });

  it("closes both a bold run and a code span in the same chunk", () => {
    expect(closeOpenMarkdown("**total** so far is `464")).toBe("**total** so far is `464`");
  });
});
