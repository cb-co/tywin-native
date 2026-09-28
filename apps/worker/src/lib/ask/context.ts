import { createClient } from "#/lib/supabase/server";

/**
 * What the model would otherwise spend a query finding out.
 *
 * The step budget's most avoidable consumer is a lookup: a question about "my
 * Amex" or "groceries" starts with the model discovering whether either exists
 * and what it is called. That is a whole inference turn plus a database
 * round-trip to learn something this process can read in ten milliseconds,
 * alongside the profile read the route already makes.
 *
 * So the lists ride in the system prompt. `q_accounts` and `categories` are both
 * RLS-scoped, so this is the same data the model could have asked for — it just
 * arrives before the question instead of after it.
 *
 * Every field is best-effort. A failed read returns an empty list and the prompt
 * simply omits that paragraph; the model falls back to the subquery lookup it
 * used to do, which still works. Nothing here is allowed to cost an answer.
 */
export type AskContext = {
  accounts: AccountFact[];
  categories: string[];
  /** The planning dimension. Empty on a database where it is not set up. */
  budgetGroups: string[];
  earliest: string | null;
  latest: string | null;
  /** True when a list was cut, so the prompt can stop claiming it is exhaustive. */
  partial: boolean;
};

export type AccountFact = {
  name: string;
  type: string | null;
  brand: string | null;
  last4: string | null;
  currency: string | null;
  archived: boolean;
};

/**
 * Caps, so that one person's unusual data cannot crowd the schema document out
 * of the model's attention. Comfortably above what a real person has — the
 * failure they prevent is a pathological account, not a normal one.
 */
const MAX_ACCOUNTS = 40;
const MAX_CATEGORIES = 60;
/* Groups are the dimension a person can hold in their head; a list this long
   already means the two dimensions have collapsed back into one. */
const MAX_GROUPS = 20;

export const EMPTY_ASK_CONTEXT: AskContext = {
  accounts: [],
  categories: [],
  budgetGroups: [],
  earliest: null,
  latest: null,
  partial: false,
};

/**
 * Four reads in parallel, because they are independent and the question is
 * waiting on all of them.
 *
 * The date range is two ordered limit-1 reads rather than a min/max aggregate:
 * PostgREST has no aggregate for it without another RPC, and both are index
 * scans on `transactions_user_occurred_idx`.
 */
export async function collectAskContext(): Promise<AskContext> {
  try {
    const supabase = await createClient();

    /* No .eq("user_id", ...) anywhere here — RLS scopes every one of them, as
       lib/overview/queries.ts does. */
    /* budget_groups may not exist yet — the view lands with a migration, and
       this code ships ahead of it. PostgREST answers a missing relation with an
       error rather than a throw, so that arm resolves to no rows and the prompt
       simply omits the paragraph. It must not take the other three down with
       it, which is why it is its own entry rather than a second query inside
       one of them. */
    const [accounts, categories, groups, first, last] = await Promise.all([
      supabase
        .from("q_accounts")
        .select("name,type,brand,last4,currency,is_archived")
        .order("is_archived")
        .order("name")
        .limit(MAX_ACCOUNTS + 1),
      supabase.from("categories").select("name").order("sort_order").limit(MAX_CATEGORIES + 1),
      supabase.from("budget_groups").select("name").order("sort_order").limit(MAX_GROUPS),
      supabase
        .from("transactions")
        .select("occurred_at")
        .order("occurred_at", { ascending: true })
        .limit(1),
      supabase
        .from("transactions")
        .select("occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(1),
    ]);

    const accountRows = accounts.data ?? [];
    const categoryRows = categories.data ?? [];

    return {
      /* A view column is nullable in the generated types even where the base
         table is not. An account with no name is not describable, so it is
         dropped rather than rendered as a blank line the model would try to
         match against. */
      accounts: accountRows
        .slice(0, MAX_ACCOUNTS)
        .filter((a): a is typeof a & { name: string } => Boolean(a.name))
        .map((a) => ({
          name: a.name,
          type: a.type,
          brand: a.brand,
          last4: a.last4,
          currency: a.currency,
          archived: Boolean(a.is_archived),
        })),
      categories: categoryRows.map((c) => c.name).filter((n): n is string => Boolean(n)).slice(0, MAX_CATEGORIES),
      budgetGroups: (groups.data ?? [])
        .map((g) => g.name)
        .filter((n): n is string => Boolean(n)),
      earliest: day(first.data?.[0]?.occurred_at),
      latest: day(last.data?.[0]?.occurred_at),
      partial:
        accountRows.length > MAX_ACCOUNTS || categoryRows.length > MAX_CATEGORIES,
    };
  } catch {
    /* The question is still answerable without this. */
    return EMPTY_ASK_CONTEXT;
  }
}

/** `occurred_at` is a timestamptz; the prompt only ever wants the calendar day. */
function day(value: string | null | undefined): string | null {
  return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : null;
}
