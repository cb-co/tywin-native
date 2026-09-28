import { parseInline, parseMarkdown } from "./markdown-blocks";

describe("parseInline", () => {
  it("reads bold, italics and code spans", () => {
    expect(parseInline("You spent **$464** on *food* via `card`")).toEqual([
      { kind: "text", text: "You spent " },
      { kind: "strong", children: [{ kind: "text", text: "$464" }] },
      { kind: "text", text: " on " },
      { kind: "em", children: [{ kind: "text", text: "food" }] },
      { kind: "text", text: " via " },
      { kind: "code", text: "card" },
    ]);
  });

  it("leaves an issuer descriptor's asterisk as text", () => {
    expect(parseInline("TST* Kedai Makan Capitol")).toEqual([{ kind: "text", text: "TST* Kedai Makan Capitol" }]);
  });

  it("keeps a link's text and drops images", () => {
    expect(parseInline("see [the bank](https://x.y) ![logo](a.png)done")).toEqual([
      { kind: "text", text: "see " },
      { kind: "text", text: "the bank" },
      { kind: "text", text: " done" },
    ]);
  });

  it("does not italicise snake_case", () => {
    expect(parseInline("base_amount and to_amount")).toEqual([{ kind: "text", text: "base_amount and to_amount" }]);
  });
});

describe("parseMarkdown", () => {
  it("splits paragraphs, lists and headings", () => {
    const blocks = parseMarkdown("## Summary\nTotal was **$10**.\n\n- Aug 8: $4\n- Aug 9: $6\n\n1. one\n2. two");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "list", "list"]);
    const bullets = blocks[2] as Extract<(typeof blocks)[number], { kind: "list" }>;
    expect(bullets.ordered).toBe(false);
    expect(bullets.items).toHaveLength(2);
    const numbered = blocks[3] as Extract<(typeof blocks)[number], { kind: "list" }>;
    expect(numbered.ordered).toBe(true);
    expect(numbered.start).toBe(1);
  });

  it("reads a GFM table with its alignment", () => {
    const [table] = parseMarkdown("| Date | Amount |\n|:--|--:|\n| Aug 8 | $4.00 |\n| Aug 9 | $6.00 |");
    expect(table).toMatchObject({ kind: "table", align: ["left", "right"] });
    if (table.kind !== "table") throw new Error();
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1][1]).toEqual([{ kind: "text", text: "$6.00" }]);
  });

  it("keeps an unterminated code fence while it streams in", () => {
    expect(parseMarkdown("```\nselect 1")).toEqual([{ kind: "code", text: "select 1" }]);
  });

  it("joins soft-wrapped lines into one paragraph", () => {
    expect(parseMarkdown("one\ntwo")).toEqual([{ kind: "paragraph", inline: [{ kind: "text", text: "one two" }] }]);
  });

  it("nests indented items one level", () => {
    const [list] = parseMarkdown("- a\n  - b\n- c");
    if (list.kind !== "list") throw new Error();
    expect(list.items.map((x) => x.depth)).toEqual([0, 1, 0]);
  });

  it("reads a horizontal rule and a quote", () => {
    expect(parseMarkdown("---\n> note").map((b) => b.kind)).toEqual(["rule", "quote"]);
  });
});
