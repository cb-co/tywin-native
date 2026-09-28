import { describe, expect, it } from "vitest";
import { RECENT_LIMIT, pushRecent, parseRecent } from "./history";

const rec = (n: number) => ({ headline: `H${n}`, body: `B${n}` });

describe("parseRecent", () => {
  it("keeps well-formed entries", () => {
    expect(parseRecent([rec(1), rec(2)])).toEqual([rec(1), rec(2)]);
  });

  // The column is jsonb, so what comes back is whatever was ever written to it.
  it.each([[null], [undefined], ["x"], [{}], [42]])("treats %j as empty", (v) => {
    expect(parseRecent(v)).toEqual([]);
  });

  it("drops malformed entries and keeps the rest", () => {
    expect(parseRecent([rec(1), { headline: "only" }, null, { headline: 1, body: 2 }])).toEqual([rec(1)]);
  });
});

describe("pushRecent", () => {
  it("puts the outgoing recommendation first", () => {
    expect(pushRecent([rec(1), rec(2)], rec(3))).toEqual([rec(3), rec(1), rec(2)]);
  });

  it("caps the list, dropping the oldest", () => {
    const stored = Array.from({ length: RECENT_LIMIT }, (_, i) => rec(i));
    const next = pushRecent(stored, rec(99));
    expect(next).toHaveLength(RECENT_LIMIT);
    expect(next[0]).toEqual(rec(99));
    expect(next).not.toContainEqual(rec(RECENT_LIMIT - 1));
  });

  it("leaves the list alone when there is nothing outgoing", () => {
    expect(pushRecent([rec(1)], null)).toEqual([rec(1)]);
  });

  it("tolerates a corrupt stored value", () => {
    expect(pushRecent("garbage", rec(1))).toEqual([rec(1)]);
  });
});
