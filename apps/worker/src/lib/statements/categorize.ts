export interface CategoryRuleRow {
  rule_type: "mcc" | "merchant";
  pattern: string;
  category_id: string;
  priority: number;
}

/** MCC → seeded category NAME (see supabase seed_defaults). User rules override. */
export const MCC_DEFAULT_CATEGORY: Record<string, string> = {
  "5411": "Groceries", // supermarkets
  "5499": "Groceries", // convenience / colmados
  "5812": "Dining",    // restaurants
  "5813": "Dining",    // bars
  "5814": "Dining",    // fast food
  "5541": "Transport", // fuel
  "4111": "Transport", // local transport
  "9399": "Transport", // government services (tolls)
  "5311": "Shopping",  // department stores
  "5999": "Shopping",  // misc retail
  "5921": "Entertainment", // liquor stores
  "5912": "Health",    // pharmacies
  "8011": "Health",    // doctors
  "8099": "Health",    // health services
};

/**
 * The category an imported line belongs to, or null when the app cannot tell.
 *
 * Null is a real answer, not a failure: it is what puts the line in front of the
 * user on the triage screen. The predecessor of this function fell back to the
 * category named "Other", which conflated "the app could not tell" with "the user
 * means miscellaneous" — and assumed a category not every user owns, since
 * categories are per-user editable rows.
 */
export function resolveCategoryId(
  line: { mcc: string | null; description: string; suggestedCategory?: string | null },
  rules: CategoryRuleRow[],
  categoryIdByName: Map<string, string>,
): string | null {
  const desc = line.description.toUpperCase();
  const merchant = rules
    .filter((r) => r.rule_type === "merchant" && desc.includes(r.pattern.toUpperCase()))
    .sort((a, b) => b.priority - a.priority)[0];
  if (merchant) return merchant.category_id;

  if (line.mcc) {
    const mccRule = rules
      .filter((r) => r.rule_type === "mcc" && r.pattern === line.mcc)
      .sort((a, b) => b.priority - a.priority)[0];
    if (mccRule) return mccRule.category_id;
  }

  if (line.suggestedCategory) {
    // Case-insensitive: the LLM is told the exact category list but isn't
    // guaranteed to reproduce casing verbatim.
    const wanted = line.suggestedCategory.toLowerCase();
    const byLlm = [...categoryIdByName].find(([name]) => name.toLowerCase() === wanted)?.[1];
    if (byLlm) return byLlm;
  }

  if (line.mcc) {
    const name = MCC_DEFAULT_CATEGORY[line.mcc];
    const byDefault = name ? categoryIdByName.get(name) : undefined;
    if (byDefault) return byDefault;
  }
  return null;
}
