import { describe, expect, it, vi } from "vitest";

vi.mock("#/i18n", () => ({
  getTranslations: vi.fn(async (ns: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns}.${key}${values ? JSON.stringify(values) : ""}`,
  ),
}));

import { dbError } from "./errors";

describe("dbError", () => {
  it("turns a plan limit into the upgrade message for that feature", async () => {
    const msg = await dbError({ code: "CGLIM", message: "plan_limit", details: "2", hint: "credit_cards" }, "createAccount");
    expect(msg).toBe('Plan.limit_credit_cards{"limit":2}');
  });

  it("falls back to the generic error for an unknown limit feature", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const msg = await dbError({ code: "CGLIM", message: "plan_limit", details: "2", hint: "rockets" }, "x");
    expect(msg).toBe("Common.errorGeneric");
    spy.mockRestore();
  });

  it("never logs row values from `details`", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await dbError(
      { code: "23505", message: "duplicate key", details: "Key (user_id, name)=(u, Banreservas Visa) already exists.", hint: null },
      "createBank",
    );
    expect(JSON.stringify(spy.mock.calls)).not.toContain("Banreservas");
    spy.mockRestore();
  });
});
