import { describe, expect, it } from "vitest";
import { STEPS, resumeStep } from "./resume";

describe("resumeStep", () => {
  it("starts at the beginning without a name", () => {
    expect(resumeStep({ hasName: false, hasMainAccount: true })).toBe(0);
  });

  it("goes to the main account when there is none", () => {
    expect(resumeStep({ hasName: true, hasMainAccount: false })).toBe(STEPS.indexOf("account"));
  });

  it("lands on the cards step once the required steps are done", () => {
    expect(resumeStep({ hasName: true, hasMainAccount: true })).toBe(STEPS.indexOf("cards"));
  });
});
