import { setTestBindings } from "#/env";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isOwner, modelForUser, ownerModel } from "./owner";

const FALLBACK = "gemini-3.5-flash-lite";

const bindings: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(bindings)) delete bindings[k];
  setTestBindings(bindings);
});
afterEach(() => {
  setTestBindings(null);
});

describe("isOwner", () => {
  it("matches the configured address", () => {
    bindings.OWNER_EMAIL = "me@example.com";
    expect(isOwner("me@example.com")).toBe(true);
  });

  it("ignores case and surrounding whitespace on both sides", () => {
    bindings.OWNER_EMAIL = "  Me@Example.com ";
    expect(isOwner("me@example.COM")).toBe(true);
  });

  it("is false for anyone else", () => {
    bindings.OWNER_EMAIL = "me@example.com";
    expect(isOwner("someone@example.com")).toBe(false);
  });

  /* The opted-out default. Every environment that has not set the var must
     behave exactly as it did before this existed. */
  it("is false for everyone when OWNER_EMAIL is unset", () => {
    expect(isOwner("me@example.com")).toBe(false);
  });

  it("is false when OWNER_EMAIL is set to an empty string", () => {
    bindings.OWNER_EMAIL = "   ";
    expect(isOwner("me@example.com")).toBe(false);
  });

  it("is false for a user with no email", () => {
    bindings.OWNER_EMAIL = "me@example.com";
    expect(isOwner(null)).toBe(false);
    expect(isOwner(undefined)).toBe(false);
  });
});

describe("modelForUser", () => {
  it("gives the owner the owner model", () => {
    bindings.OWNER_EMAIL = "me@example.com";
    expect(modelForUser("me@example.com", FALLBACK)).toBe("gemini-3.7-flash");
  });

  it("gives everyone else the caller's own model", () => {
    bindings.OWNER_EMAIL = "me@example.com";
    expect(modelForUser("someone@example.com", FALLBACK)).toBe(FALLBACK);
  });

  it("gives the caller's own model when nothing is configured", () => {
    expect(modelForUser("me@example.com", FALLBACK)).toBe(FALLBACK);
  });

  it("honours an OWNER_MODEL override", () => {
    bindings.OWNER_EMAIL = "me@example.com";
    bindings.OWNER_MODEL = "gemini-3.6-flash";
    expect(modelForUser("me@example.com", FALLBACK)).toBe("gemini-3.6-flash");
    expect(ownerModel()).toBe("gemini-3.6-flash");
  });
});
