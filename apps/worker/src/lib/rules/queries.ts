import { createClient } from "#/lib/supabase/server";

export interface RuleRow {
  id: string;
  ruleType: "merchant" | "mcc";
  pattern: string;
  categoryId: string;
  /** Statement lines this rule matches — what makes a rule judgeable. */
  matches: number;
}

export async function getMerchantRules(): Promise<RuleRow[]> {
  const supabase = await createClient();
  const [{ data: rules }, { data: usage }] = await Promise.all([
    supabase.from("category_rules").select("id,rule_type,pattern,category_id").order("pattern"),
    supabase.rpc("category_rule_usage"),
  ]);
  const matchesById = new Map((usage ?? []).map((u) => [u.rule_id, Number(u.matches ?? 0)]));
  return (rules ?? []).map((r) => ({
    id: r.id,
    ruleType: r.rule_type as "merchant" | "mcc",
    pattern: r.pattern,
    categoryId: r.category_id,
    matches: matchesById.get(r.id) ?? 0,
  }));
}
