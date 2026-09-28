import { createClient } from "#/lib/supabase/server";
import { baseCurrencyOf } from "@cigua/core/profile";
import type { Period } from "@cigua/core/period/cycle";

export type BudgetStatus = "within" | "approaching" | "over";

export type BudgetRow = {
  category_id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  /** Which group this kind of spending rolls up to by default, or null for a
   *  category that answers to no plan. Read by the category dialog's group
   *  select, which is why it rides along on the row the dialog already gets. */
  budget_group_id: string | null;
  /** Prorated onto the active period — what the row's bar and remaining
   *  figure compare `used` against. Equal to `budget_monthly` whenever the
   *  period is a whole calendar month, which is what keeps a `monthly`
   *  profile's numbers byte-for-byte what they were before periods existed. */
  budget: number;
  /** The rate actually stored in `category_budgets`, unprorated. The input
   *  field edits this figure, never the prorated one above — editing a
   *  quincena's half-budget would silently halve the monthly rate on save. */
  budget_monthly: number;
  used: number;
  remaining: number;
  status: BudgetStatus;
};

export type BudgetOverview = {
  rows: BudgetRow[];
  totalBudget: number;
  totalUsed: number;
  baseCurrency: string;
  /** Spend with no category in the period — expense/payment rows excluded from
   *  budget stay out, mirroring category_usage's inclusion rule exactly (see
   *  uncategorized_spend in 20260819131444_null_category_triage.sql), so the
   *  two figures can never disagree about what counts as spending. */
  uncategorized: number;
  /** The newest import that still has an uncategorised line, so the figure
   *  above can link somewhere useful. Null when every leftover is a
   *  subscription charge (design §1c / §2) — triage has nothing to offer
   *  those, so the figure renders as plain text instead. */
  pendingTriageImportId: string | null;
  /** The period rows are scoped to. A whole calendar month for a `monthly`
   *  profile (or for anyone viewing the "Mes" side of the toggle); a quincena
   *  or a week otherwise. Echoed back so the grid never has to re-derive what
   *  it already asked for. */
  period: Period;
};

export async function getBudgetOverview(period: Period): Promise<BudgetOverview> {
  const supabase = await createClient();
  const [{ data: usage }, { data: categories }, { data: profile }, { data: uncategorized }, pendingTriageImportId] =
    await Promise.all([
      supabase.rpc("category_usage_range", { p_start: period.start, p_end: period.end }),
      supabase.from("categories").select("id,name,emoji,color,budget_group_id").order("sort_order"),
      supabase.from("profiles").select("base_currency").maybeSingle(),
      supabase.rpc("uncategorized_spend_range", { p_start: period.start, p_end: period.end }),
      getPendingTriageImportId(supabase),
    ]);

  const usageByCat = new Map((usage ?? []).map((u) => [u.category_id, u]));

  const rows: BudgetRow[] = (categories ?? []).map((c) => {
    const u = usageByCat.get(c.id);
    return {
      category_id: c.id,
      name: c.name,
      emoji: c.emoji,
      color: c.color,
      budget_group_id: c.budget_group_id,
      budget: Number(u?.budget ?? 0),
      budget_monthly: Number(u?.budget_monthly ?? 0),
      used: Number(u?.used ?? 0),
      remaining: Number(u?.remaining ?? 0),
      status: (u?.status ?? "within") as BudgetStatus,
    };
  });

  return {
    rows,
    totalBudget: rows.reduce((s, r) => s + r.budget, 0),
    totalUsed: rows.reduce((s, r) => s + r.used, 0),
    baseCurrency: baseCurrencyOf(profile),
    uncategorized: Number(uncategorized ?? 0),
    pendingTriageImportId,
    period,
  };
}

export type BudgetGroupRow = {
  budget_group_id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  /** Prorated onto the active period, exactly as BudgetRow.budget is. */
  budget: number;
  /** The monthly amount stored in `budget_group_budgets` — what the amount
   *  input edits, for the same reason BudgetRow.budget_monthly exists. */
  budget_monthly: number;
  used: number;
  remaining: number;
  status: BudgetStatus;
};

export type BudgetGroupOverview = {
  rows: BudgetGroupRow[];
  totalBudget: number;
  totalUsed: number;
  baseCurrency: string;
  period: Period;
};

export type BudgetGroupUsageRow = {
  budget_group_id: string;
  budget_monthly: number | null;
  budget: number | null;
  used: number | null;
  remaining: number | null;
  status: BudgetStatus | null;
};

/**
 * Pure core of getBudgetGroupOverview: the group list, in its own sort order,
 * left-joined to `budget_group_usage_range`.
 *
 * Every figure — status included — is taken from the RPC as given, so the
 * group band cannot grow a second copy of the proration or the thresholds. The
 * RPC already returns a row for every group, budgeted or not; the join is only
 * here for name, emoji, colour and order, and a group the RPC somehow did not
 * return still renders as an empty row rather than vanishing.
 */
export function joinBudgetGroupRows(
  groups: { id: string; name: string; emoji: string | null; color: string | null }[],
  usage: BudgetGroupUsageRow[],
): BudgetGroupRow[] {
  const usageById = new Map(usage.map((u) => [u.budget_group_id, u]));
  return groups.map((g) => {
    const u = usageById.get(g.id);
    return {
      budget_group_id: g.id,
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      budget: Number(u?.budget ?? 0),
      budget_monthly: Number(u?.budget_monthly ?? 0),
      used: Number(u?.used ?? 0),
      remaining: Number(u?.remaining ?? 0),
      status: (u?.status ?? "within") as BudgetStatus,
    };
  });
}

/**
 * The planning dimension for one period — the sibling of getBudgetOverview
 * above, and shaped like it on purpose so a reader who knows one knows the
 * other.
 *
 * Returns empty rows and zero totals for a user with no groups, which is the
 * whole zero-group path: the band that renders this returns null on an empty
 * `rows`, so someone who never made a group never sees that the concept
 * exists.
 */
export async function getBudgetGroupOverview(period: Period): Promise<BudgetGroupOverview> {
  const supabase = await createClient();
  const [{ data: groups }, { data: usage }, { data: profile }] = await Promise.all([
    supabase.from("budget_groups").select("id,name,emoji,color").order("sort_order"),
    supabase.rpc("budget_group_usage_range", { p_start: period.start, p_end: period.end }),
    supabase.from("profiles").select("base_currency").maybeSingle(),
  ]);

  const rows = joinBudgetGroupRows(groups ?? [], usage ?? []);

  return {
    rows,
    totalBudget: rows.reduce((s, r) => s + r.budget, 0),
    totalUsed: rows.reduce((s, r) => s + r.used, 0),
    baseCurrency: baseCurrencyOf(profile),
    period,
  };
}

export type PendingTriageImportRow = {
  statement_line: {
    statement: {
      import: { id: string; created_at: string } | null;
    } | null;
  } | null;
};

/**
 * Pure core of getPendingTriageImportId: the id of the import with the
 * latest `created_at` among rows that carry one. A row whose embedded chain
 * is incomplete — its statement line, statement, or import didn't resolve —
 * is skipped rather than treated as a throw or as a tie-breaker; that shape
 * shows up for a statement whose import was deleted out from under it
 * (`card_statements.import_id` is `on delete set null`), which should just
 * drop out of contention, not blow up the reduction.
 */
export function newestPendingImport(rows: PendingTriageImportRow[]): string | null {
  let newest: { id: string; created_at: string } | null = null;
  for (const r of rows) {
    const imp = r.statement_line?.statement?.import;
    if (!imp) continue;
    if (!newest || imp.created_at > newest.created_at) newest = imp;
  }
  return newest?.id ?? null;
}

/**
 * The newest import that still has at least one uncategorised line — so the
 * budget page's uncategorised figure can be a link to somewhere useful, and
 * not to a triage screen with nothing left on it (the same failure the
 * post-import redirect already avoids by skipping itself when there is
 * nothing to triage).
 *
 * Unlike `getPendingTriageCounts` (lib/accounts/queries.ts), which is scoped
 * to one account's statements and walks forward from every statement line,
 * this one is unscoped across the whole ledger — so it walks backward from
 * `transactions`, starting at the rows that actually still need triage (null
 * category, statement-sourced), and follows each one up to its import. A
 * null-category row with no `statement_line_id` is a subscription charge
 * (design §1c) and is deliberately excluded — triage cannot help it, and it
 * must never make this function return an import that has nothing left in
 * it.
 *
 * That first filter bounds the fetch by how much triage work is actually
 * outstanding rather than by how much was ever imported, but it is not by
 * itself a bound: PostgREST caps any single request at `max_rows` (1000,
 * `supabase/config.toml`) and truncates past it silently, in whatever order
 * the planner returns — the same failure mode `fetchAllTransferRows` and
 * `fetchAllLoanPayments` in `lib/insights/queries.ts` page around in full.
 * Full pagination isn't the fix here, though: this figure only ever needs to
 * point at the *most recent* outstanding triage work, and an import old
 * enough to fall outside the 500 most recent uncategorised statement lines
 * is not what someone clicking a budget-page figure is looking for — it
 * isn't stranded either, since every statement's own row already links to
 * its import's triage screen (Task 7). So the ordering and the 500 cap below
 * make the truncation deliberate and deterministic instead of silent and
 * arbitrary: newest-first by `occurred_at`, comfortably under `max_rows`,
 * and then `newestPendingImport` just picks the single newest import out of
 * that bounded set.
 */
async function getPendingTriageImportId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data: rows } = await supabase
    .from("transactions")
    .select(
      "statement_line:card_statement_lines!transactions_statement_line_id_fkey(statement:card_statements(import:statement_imports(id,created_at)))",
    )
    .is("category_id", null)
    .not("statement_line_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(500);

  return newestPendingImport(rows ?? []);
}
