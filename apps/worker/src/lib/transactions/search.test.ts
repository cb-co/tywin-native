import { describe, expect, it } from "vitest";
import { orValue, searchAmount, searchTerms } from "./search";

describe("orValue", () => {
  it("wraps the value so a comma cannot become a new filter term", () => {
    expect(orValue("%Supermercado, S.A.%")).toBe('"%Supermercado, S.A.%"');
  });

  it("escapes quotes and backslashes rather than closing the wrapper early", () => {
    expect(orValue('a"b')).toBe('"a\\"b"');
    expect(orValue("a\\b")).toBe('"a\\\\b"');
  });

  it("survives a query built to look like PostgREST grouping", () => {
    // Unescaped, this would read as three terms and a nested and().
    expect(orValue("%x,and(y.eq.1)%")).toBe('"%x,and(y.eq.1)%"');
  });
});

describe("searchAmount", () => {
  it("reads a plain number", () => {
    expect(searchAmount("1500")).toBe(1500);
  });

  it("ignores thousands separators and currency marks", () => {
    expect(searchAmount("1,500.50")).toBe(1500.5);
    expect(searchAmount("RD$ 1,500")).toBe(null); // letters mean it is not a figure
    expect(searchAmount("$1,500")).toBe(1500);
  });

  it("refuses a number embedded in words", () => {
    // The 50 here is part of a merchant name, not the figure being hunted.
    expect(searchAmount("café 50")).toBe(null);
    expect(searchAmount("uber 12")).toBe(null);
  });

  it("returns null for a non-numeric or empty query", () => {
    expect(searchAmount("supermercado")).toBe(null);
    expect(searchAmount("   ")).toBe(null);
    expect(searchAmount("")).toBe(null);
  });
});

describe("searchTerms", () => {
  it("is empty for a blank query, so no filter is applied at all", () => {
    expect(searchTerms("")).toEqual([]);
    expect(searchTerms("   ")).toEqual([]);
  });

  it("searches description and notes for text", () => {
    expect(searchTerms("uber")).toEqual([
      'description.ilike."%uber%"',
      'notes.ilike."%uber%"',
    ]);
  });

  it("adds both amount columns for a numeric query", () => {
    expect(searchTerms("1500")).toEqual([
      'description.ilike."%1500%"',
      'notes.ilike."%1500%"',
      "amount.eq.1500",
      "total_amount.eq.1500",
    ]);
  });
});
