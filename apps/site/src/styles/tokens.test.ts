import { describe, expect, it } from "vitest";
import tokens from "@cigua/core/tokens.json";
import { tokensCss } from "./tokens";

describe("tokensCss", () => {
  const css = tokensCss();

  it("declares every fixed and light token on :root", () => {
    for (const [k, v] of Object.entries({ ...tokens.fixed, ...tokens.light })) {
      expect(css).toContain(`--${k}: ${v};`);
    }
  });

  it("swaps the paper tokens under a dark colour scheme, never the note", () => {
    const dark = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    expect(dark).toContain(`--paper: ${tokens.dark.paper};`);
    expect(dark).not.toContain("--note:");
  });
});
