import { describe, expect, it } from "vitest";
import { signAskSql } from "./sign";

describe("signAskSql", () => {
  it("matches what Postgres computes for the same inputs", async () => {
    // From the local database:
    //   select encode(extensions.hmac('11111111-1111-1111-1111-111111111111' || E'\n' || 'select 1 as x',
    //                                 repeat('ab', 32), 'sha256'), 'hex');
    const sig = await signAskSql("ab".repeat(32), "11111111-1111-1111-1111-111111111111", "select 1 as x");
    expect(sig).toBe(EXPECTED);
  });

  it("binds the caller: another person gets another signature", async () => {
    const a = await signAskSql("k".repeat(32), "user-a", "select 1");
    const b = await signAskSql("k".repeat(32), "user-b", "select 1");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

const EXPECTED = "2cd4f0500a1b32a3a11d4a44c54ae030dd10dd4871afa02e5c3e9a9dadf0175e";
