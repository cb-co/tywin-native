import { describe, expect, it } from "vitest";
import { buildCardGroupLines } from "./group-lines";

const row = (id: string, card_line: string, is_archived = false) => ({ id, card_line, is_archived });

describe("buildCardGroupLines", () => {
  it("orders the lines DOP, USD, Cuotas whatever order they arrive in", () => {
    const lines = buildCardGroupLines([row("c", "CUOTAS"), row("u", "USD"), row("d", "DOP")], "u");
    expect(lines).toEqual([
      { id: "d", line: "DOP", isCurrent: false },
      { id: "u", line: "USD", isCurrent: true },
      { id: "c", line: "CUOTAS", isCurrent: false },
    ]);
  });

  it("keeps only the lines the card has", () => {
    expect(buildCardGroupLines([row("d", "DOP"), row("c", "CUOTAS")], "d").map((l) => l.line)).toEqual(["DOP", "CUOTAS"]);
  });

  it("drops archived lines, except the one being viewed", () => {
    const rows = [row("d", "DOP"), row("u", "USD", true), row("c", "CUOTAS", true)];
    expect(buildCardGroupLines(rows, "c").map((l) => l.id)).toEqual(["d", "c"]);
  });
});
