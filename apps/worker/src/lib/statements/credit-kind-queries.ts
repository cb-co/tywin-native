import type { createClient } from "#/lib/supabase/server";
import {
  merchantWords,
  precheckCredit,
  resolveCreditKinds,
  type CreditKind,
  type StoredCreditLine,
} from "./credit-kind";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Kind per credit line id, loading only the purchases that could explain them. */
export async function getCreditKinds(
  supabase: Client,
  lines: readonly StoredCreditLine[],
): Promise<Map<string, CreditKind>> {
  const open = lines.filter((l) => precheckCredit(l) === null);
  const firstWords = [...new Set(open.flatMap((l) => merchantWords(l.description)?.[0] ?? []))];
  if (firstWords.length === 0) return resolveCreditKinds(lines, []);

  // merchantWords yields [A-Z0-9] only, so the words are safe inside a PostgREST or-filter.
  const { data } = await supabase
    .from("card_statement_lines")
    .select("account_id,description")
    .in("account_id", [...new Set(open.map((l) => l.account_id))])
    .eq("kind", "purchase")
    .or(firstWords.map((w) => `description.ilike.*${w}*`).join(","));
  return resolveCreditKinds(lines, data ?? []);
}
