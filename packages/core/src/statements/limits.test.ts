import { describe, expect, it } from "vitest";
import { MAX_STATEMENT_BYTES } from "./limits";

describe("statement upload limits", () => {
  it("accepts a statement PDF of a realistic size", () => {
    // Text-layer statements run a few hundred KB; ones carrying page images
    // reach a few MB.
    expect(MAX_STATEMENT_BYTES).toBeGreaterThanOrEqual(5 * 1024 * 1024);
  });
});
