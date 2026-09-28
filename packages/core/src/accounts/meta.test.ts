import { expect, test } from "vitest";
import {
  ACCOUNT_GROUPS,
  ACCOUNT_TYPE_VALUES,
  ACCOUNT_TYPE_META,
  accountTypeMeta,
  accountOptionLabel,
} from "./meta";

test("account options always carry the currency", () => {
  // Same-named accounts in two currencies are common, and the label is the
  // only thing distinguishing them in a picker.
  const dop = accountOptionLabel({ name: "Visa Infinite", currency: "DOP" });
  const usd = accountOptionLabel({ name: "Visa Infinite", currency: "USD" });
  expect(dop).toBe("Visa Infinite · DOP");
  expect(dop).not.toBe(usd);
});

test("every account type maps to a group that actually renders", () => {
  const keys = ACCOUNT_GROUPS.map((g) => g.key);
  for (const type of ACCOUNT_TYPE_VALUES) {
    expect(keys).toContain(ACCOUNT_TYPE_META[type].group);
  }
});

test("every group has at least one type, so no empty section can appear", () => {
  const used = new Set(ACCOUNT_TYPE_VALUES.map((t) => ACCOUNT_TYPE_META[t].group));
  for (const g of ACCOUNT_GROUPS) expect(used).toContain(g.key);
});

test("assets are grouped apart from spendable money", () => {
  // The whole point of the split: an estimated property value must not sit
  // in the same section as balances you can actually spend.
  expect(accountTypeMeta("asset").group).toBe("assets");
  for (const type of ["checking", "savings", "cash", "investment"] as const) {
    expect(accountTypeMeta(type).group).toBe("cash");
  }
});

test("debts stay in their own groups", () => {
  expect(accountTypeMeta("credit_card").group).toBe("cards");
  expect(accountTypeMeta("loan").group).toBe("loans");
});

test("property sits last, below the sections acted on monthly", () => {
  // Assets are reference data for net worth, not something you work from.
  const order = ACCOUNT_GROUPS.map((g) => g.key);
  expect(order.indexOf("cash")).toBeLessThan(order.indexOf("cards"));
  expect(order.indexOf("cards")).toBeLessThan(order.indexOf("loans"));
  expect(order.at(-1)).toBe("assets");
});
