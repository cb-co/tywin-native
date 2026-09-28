import { describe, expect, test } from "vitest";
import { buildCardGroupLines, cardLineLabel } from "./group-lines";
import type { GroupLineRow } from "./group-lines";

function row(overrides: Partial<GroupLineRow>): GroupLineRow {
  return { id: "a", name: "USD line", currency: "USD", is_archived: false, ...overrides };
}

describe("cardLineLabel", () => {
  /* The three naming conventions actually present in the accounts table: names
     the dialog generated, hand-made names identical to the card's, and hand-made
     names that share only the brand word. */
  test("keeps what follows the card's name", () => {
    expect(cardLineLabel("VISA GOLD ROSE · USD", "VISA GOLD ROSE", "USD")).toBe("USD");
    expect(cardLineLabel("VISA GOLD ROSE · DOP", "VISA GOLD ROSE", "DOP")).toBe("DOP");
  });

  test("falls back to the currency when the line is named exactly after its card", () => {
    expect(cardLineLabel("Visa Infinite", "Visa Infinite", "USD")).toBe("USD");
    expect(cardLineLabel("Visa Infinite", "Visa Infinite", "DOP")).toBe("DOP");
  });

  test("sheds only the words actually shared with the card", () => {
    expect(cardLineLabel("AMEX Cuotas", "AMEX Platinum", "DOP")).toBe("Cuotas");
  });

  test("matches words case-insensitively", () => {
    expect(cardLineLabel("visa infinite · Cuotas", "VISA INFINITE", "DOP")).toBe("Cuotas");
  });

  test("keeps a name that shares nothing with the card", () => {
    expect(cardLineLabel("Cuotas", "AMEX Platinum", "DOP")).toBe("Cuotas");
  });

  test("strips separator debris left behind by the prefix", () => {
    expect(cardLineLabel("Amex - USD", "Amex", "USD")).toBe("USD");
    expect(cardLineLabel("Amex   |   USD", "Amex", "USD")).toBe("USD");
  });

  /* Whole-word matching, not raw string prefix: "Amex Platinum" must not eat the
     "Plat" of a line called "Amex Platinum Plus" and leave "inum Plus". */
  test("does not split a word that merely starts with the card's name", () => {
    expect(cardLineLabel("Amex Platinumplus", "Amex Platinum", "USD")).toBe("Platinumplus");
  });
});

describe("buildCardGroupLines", () => {
  test("flags exactly the current line", () => {
    const lines = buildCardGroupLines(
      [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })],
      "Card",
      "b",
    );
    expect(lines.map((l) => l.isCurrent)).toEqual([false, true, false]);
  });

  test("preserves the order it was given", () => {
    const lines = buildCardGroupLines(
      [row({ id: "c" }), row({ id: "a" }), row({ id: "b" })],
      "Card",
      "a",
    );
    expect(lines.map((l) => l.id)).toEqual(["c", "a", "b"]);
  });

  test("labels the real AMEX group's three lines distinguishably", () => {
    const lines = buildCardGroupLines(
      [
        row({ id: "usd", name: "AMEX Platinum", currency: "USD" }),
        row({ id: "dop", name: "AMEX Platinum", currency: "DOP" }),
        row({ id: "cuotas", name: "AMEX Cuotas", currency: "DOP" }),
      ],
      "AMEX Platinum",
      "dop",
    );
    expect(lines.map((l) => l.label)).toEqual(["USD", "DOP", "Cuotas"]);
    expect(new Set(lines.map((l) => l.label)).size).toBe(3);
  });

  test("drops archived siblings", () => {
    const lines = buildCardGroupLines(
      [row({ id: "a" }), row({ id: "b", is_archived: true })],
      "Card",
      "a",
    );
    expect(lines.map((l) => l.id)).toEqual(["a"]);
  });

  /* An archived card's own page is still reachable, and a rail there that hid
     the line you are standing on would leave no segment marked current. */
  test("keeps the current line even when it is archived", () => {
    const lines = buildCardGroupLines(
      [row({ id: "a", is_archived: true }), row({ id: "b" })],
      "Card",
      "a",
    );
    expect(lines.map((l) => l.id)).toEqual(["a", "b"]);
    expect(lines[0].isCurrent).toBe(true);
  });
});
