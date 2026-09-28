import { pageLines, statementText } from "./layout";

describe("pageLines", () => {
  it("orders rows top to bottom and runs left to right", () => {
    const lines = pageLines([
      { str: "RD$ 1,234.56", x: 400, y: 700, w: 60 },
      { str: "CAFE EL PATIO", x: 80, y: 700, w: 70 },
      { str: "TOTAL", x: 80, y: 650, w: 30 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].trim().startsWith("CAFE EL PATIO")).toBe(true);
    expect(lines[0]).toContain("CAFE EL PATIO  ");
    expect(lines[0].trimEnd().endsWith("RD$ 1,234.56")).toBe(true);
    expect(lines[1].trim()).toBe("TOTAL");
  });

  it("keeps runs within 0.5pt on one row and splits anything further apart", () => {
    expect(pageLines([{ str: "A", x: 0, y: 100, w: 5 }, { str: "B", x: 40, y: 100.4, w: 5 }])).toHaveLength(1);
    expect(pageLines([{ str: "A", x: 0, y: 100, w: 5 }, { str: "B", x: 40, y: 101, w: 5 }])).toHaveLength(2);
  });

  it("marks a column break with at least two spaces", () => {
    const [line] = pageLines([{ str: "15/08", x: 0, y: 10, w: 20 }, { str: "UBER", x: 27, y: 10, w: 16 }]);
    expect(line).toBe("15/08  UBER");
  });

  it("drops blank runs", () => {
    expect(pageLines([{ str: "  ", x: 0, y: 10, w: 5 }])).toEqual([]);
  });
});

describe("statementText", () => {
  it("joins pages with a newline", () => {
    const run = (s: string) => ({ str: s, x: 0, y: 10, w: 5 });
    expect(statementText([[run("one")], [run("two")]])).toBe("one\ntwo");
  });
});
