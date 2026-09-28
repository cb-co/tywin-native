import { createClient } from "#/lib/supabase/server";
import { merchantPattern } from "#/lib/statements/merchant";
import { becomesTransaction } from "@cigua/core/statements/types";

export interface TriageLine {
  transactionId: string;
  description: string;
  currency: string;
  amount: number;
  madeOn: string;
  categoryId: string | null;
}

export interface TriageGroup {
  /** `${currency}|${pattern}` — what the client sends back to categorise. */
  key: string;
  pattern: string;
  description: string;
  currency: string;
  count: number;
  total: number;
  transactionIds: string[];
  firstDate: string;
  lastDate: string;
}

export interface ImportTriage {
  importId: string;
  fileName: string;
  accountName: string;
  /** The account the import landed on — the way out of the empty state.
   *  Nullable: an import with no statements has no account to return to. */
  accountId: string | null;
  /** Every non-payment line in the import — the denominator of "68 de 80". */
  totalLines: number;
  categorizedLines: number;
  groups: TriageGroup[];
}

/**
 * The merchant groups still waiting for a category.
 *
 * Pure, so the sort order and the currency split are testable without a database.
 * Currency is part of the key because one import can carry a DOP section and a
 * USD section of the same card, and a merchant appearing in both is two different
 * amounts of money — summing them would print a number that means nothing.
 */
export function groupForTriage(lines: TriageLine[]): TriageGroup[] {
  const byKey = new Map<string, TriageGroup>();
  for (const l of lines) {
    if (l.categoryId !== null) continue;
    const pattern = merchantPattern(l.description);
    const key = `${l.currency}|${pattern}`;
    const found = byKey.get(key);
    if (!found) {
      byKey.set(key, {
        key,
        pattern,
        description: l.description.trim(),
        currency: l.currency,
        count: 1,
        total: l.amount,
        transactionIds: [l.transactionId],
        firstDate: l.madeOn,
        lastDate: l.madeOn,
      });
      continue;
    }
    found.count += 1;
    found.total += l.amount;
    found.transactionIds.push(l.transactionId);
    if (l.madeOn < found.firstDate) found.firstDate = l.madeOn;
    if (l.madeOn > found.lastDate) found.lastDate = l.madeOn;
  }
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || b.total - a.total || a.description.localeCompare(b.description),
  );
}

/**
 * Everything the triage screen shows, for one import.
 *
 * Scoped by `import_id` rather than by "every transaction with no category":
 * a subscription charge can also have none (see the spec, §1c), and it has
 * nothing to do with this statement. RLS confines every table here to the caller.
 */
export async function getImportTriage(importId: string): Promise<ImportTriage | null> {
  const supabase = await createClient();

  const { data: imp } = await supabase
    .from("statement_imports")
    .select("id,file_name")
    .eq("id", importId)
    .maybeSingle();
  if (!imp) return null;

  const { data: statements } = await supabase
    .from("card_statements")
    .select("id,account_id,account:accounts!card_statements_account_id_fkey(name,currency)")
    .eq("import_id", importId);
  if (!statements || statements.length === 0)
    return {
      importId,
      fileName: imp.file_name,
      accountName: "",
      accountId: null,
      totalLines: 0,
      categorizedLines: 0,
      groups: [],
    };

  const currencyByStatement = new Map(
    statements.map((s) => [s.id, s.account?.currency ?? ""]),
  );

  const { data: rows } = await supabase
    .from("card_statement_lines")
    .select(
      "statement_id,description,amount,made_on,kind,transaction:transactions!card_statement_lines_transaction_id_fkey(id,category_id)",
    )
    .in(
      "statement_id",
      statements.map((s) => s.id),
    );

  // Payments and adjustments never become transactions (the import RPC skips
  // them), so they are neither triaged nor counted — the denominator is what a
  // person could categorise, not every printed row.
  const lines: TriageLine[] = (rows ?? [])
    .filter((r) => becomesTransaction(r.kind) && r.transaction)
    .map((r) => ({
      transactionId: r.transaction!.id,
      description: r.description,
      currency: currencyByStatement.get(r.statement_id) ?? "",
      amount: Number(r.amount ?? 0),
      madeOn: r.made_on,
      categoryId: r.transaction!.category_id,
    }));

  return {
    importId,
    fileName: imp.file_name,
    accountName: statements[0].account?.name ?? "",
    accountId: statements[0].account_id ?? null,
    totalLines: lines.length,
    categorizedLines: lines.filter((l) => l.categoryId !== null).length,
    groups: groupForTriage(lines),
  };
}
