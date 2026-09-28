/**
 * The fixed monthly bills onboarding offers as one-tap presets. Each names the
 * seeded category it belongs to (see seed_default_categories), matched by name
 * because category ids are per user. A user who renamed or deleted it gets an
 * uncategorised bill rather than a guessed one.
 */
export const BILL_PRESETS = [
  { key: "rent", category: "Housing" },
  { key: "power", category: "Utilities" },
  { key: "water", category: "Utilities" },
  { key: "internet", category: "Utilities" },
  { key: "phone", category: "Utilities" },
  { key: "insurance", category: "Health" },
  { key: "other", category: null },
] as const;

export type BillPresetKey = (typeof BILL_PRESETS)[number]["key"];

export type OnboardingBill = {
  preset: BillPresetKey;
  name: string;
  amount: string;
  /** Day of the month, as typed; blank means no known date. */
  day: string;
  /** Paid-from account; blank when the user has none to pick. */
  accountId: string;
  currency: string;
};

export function categoryIdForPreset(
  preset: BillPresetKey,
  categories: { id: string; name: string }[],
): string {
  const wanted = BILL_PRESETS.find((p) => p.key === preset)?.category;
  if (!wanted) return "";
  return categories.find((c) => c.name.trim().toLowerCase() === wanted.toLowerCase())?.id ?? "";
}

/** A monthly expense template for `createSubscription`, which validates it. */
export function billFromPreset(bill: OnboardingBill, categories: { id: string; name: string }[]) {
  return {
    kind: "expense" as const,
    name: bill.name.trim(),
    amount: Number(bill.amount),
    currency: bill.currency,
    billing_cycle: "monthly" as const,
    anchor_day: bill.day.trim() === "" ? undefined : Number(bill.day),
    account_id: bill.accountId,
    category_id: categoryIdForPreset(bill.preset, categories),
    is_active: true,
  };
}
