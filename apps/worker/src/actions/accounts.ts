import { createClient } from "#/lib/supabase/server";
import { accountInput, type AccountInput, cardStubInput, type CardStubInput } from "@cigua/core/accounts/schema";
import { hasCardAccent } from "@cigua/core/accounts/card-art";
import { inferCardArt } from "#/lib/accounts/llm/card-art";
import { dbError } from "#/lib/errors";

type Result = { error?: string; id?: string };

const nullIf = <T>(cond: boolean, value: T) => (cond ? null : value);
const orNull = (v: string | undefined) => (v && v.length ? v : null);

/** Map validated input to account columns, nulling fields that don't apply to the type. */
function toColumns(v: AccountInput) {
  const card = v.type === "credit_card";
  const loan = v.type === "loan";
  return {
    name: v.name,
    type: v.type,
    starting_balance: loan ? 0 : v.starting_balance,
    color: orNull(v.color),
    bank_id: orNull(v.bank_id),
    transfer_tax_rate: v.transfer_tax_rate,
    network_fee_amount: v.network_fee_amount,
    network_fee_optional: v.network_fee_optional,

    credit_limit: nullIf(!card, v.credit_limit ?? null),
    statement_closing_day: nullIf(!card, v.statement_closing_day ?? null),
    current_balance: card ? v.current_balance : 0,
    card_group_id: nullIf(!card, orNull(v.card_group_id)),
    last4: nullIf(!card, orNull(v.last4)),
    welcome_bonus_goal_amount: nullIf(!card, v.welcome_bonus_goal_amount ?? null),
    welcome_bonus_goal_currency: nullIf(!card, orNull(v.welcome_bonus_goal_currency)),
    welcome_bonus_due_date: nullIf(!card, orNull(v.welcome_bonus_due_date)),

    principal: nullIf(!loan, v.principal ?? null),
    interest_rate: nullIf(!loan, v.interest_rate ?? null),
    term_months: nullIf(!loan, v.term_months ?? null),
    original_term_months: nullIf(!loan, v.original_term_months ?? null),
    start_date: nullIf(!loan, orNull(v.start_date)),
    installment_amount: nullIf(!loan, v.installment_amount ?? null),

    // shared by cards and loans
    payment_due_day: nullIf(!card && !loan, v.payment_due_day ?? null),
  };
}

/**
 * Card art for an account being written, or nothing.
 *
 * Only credit cards get art — a chequing account has no physical face to match.
 * Beyond that the gate is the ACCENT, and nothing else: a card that has one
 * skips the model and saves like any other account, a card that has none asks.
 *
 * The colour is a form field, which is what makes one condition enough. It
 * round-trips through every edit, so "already has an accent" covers the routine
 * edit, and CLEARING it is a deliberate gesture that re-opens the gate — the
 * re-roll for a card wearing a colour nobody likes, with no rename needed.
 *
 * The cost this accepts: a card the model cannot place has no accent, so it asks
 * again on each edit. That is the price of keeping the rule to one field a
 * person can see and control, rather than a hidden "we already tried" marker
 * that nothing in the UI could explain.
 *
 * Inference failure is silent and returns nothing at all: this runs inside a
 * save the person asked for, and a card whose colour could not be guessed is
 * not a reason to fail writing their account.
 */
async function resolveArtFor(
  v: AccountInput,
): Promise<{ color?: string; brand?: string } | undefined> {
  if (v.type !== "credit_card") return undefined;
  if (hasCardAccent(v.color)) return undefined;

  const art = await inferCardArt(v.name);
  if (!art) return undefined;

  return { color: art.accent, ...(art.network ? { brand: art.network } : {}) };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createAccount(input: AccountInput): Promise<Result> {
  const parsed = accountInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };

  const row = {
    ...toColumns(parsed.data),
    ...(await resolveArtFor(parsed.data)),
    currency: parsed.data.currency,
    user_id: user.id,
  };
  const res = await supabase.from("accounts").insert(row).select("id").single();

  if (res.error) return { error: await dbError(res.error, "createAccount") };
  return { id: res.data.id };
}

export async function updateAccount(id: string, input: AccountInput): Promise<Result> {
  const parsed = accountInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };

  // currency is immutable — never included in the update payload.
  const columns = { ...toColumns(parsed.data), ...(await resolveArtFor(parsed.data)) };

  /* An anchored card's balance is not the form's to write.
   *
   * `recompute_card_balance` owns it — newest statement's total_balance minus the
   * payments dated after that statement closed — and it re-runs on every statement
   * import and every payment to the card. A number typed here would therefore
   * survive only until the next of either, then vanish with no explanation. The
   * dialog stops offering the field once a card is anchored, and this is what makes
   * that true rather than merely apparent: it also closes the gap where a statement
   * lands while the dialog is open, which would otherwise write a value that was
   * already stale by the time it was submitted.
   *
   * Anchor-less cards keep the field and keep this path: with no statement to
   * anchor to, the typed balance IS the source of truth. */
  if (parsed.data.type === "credit_card") {
    const { count } = await supabase
      .from("card_statements")
      .select("id", { count: "exact", head: true })
      .eq("account_id", id);
    if ((count ?? 0) > 0) delete (columns as Partial<typeof columns>).current_balance;
  }

  const { error } = await supabase.from("accounts").update(columns).eq("id", id);
  if (error) return { error: await dbError(error, "updateAccount") };

  // Welcome-bonus goal fields are shared across every currency line of a card
  // (card_group_id) — fan out so setting/changing/clearing the goal from any
  // line propagates to its siblings, rather than relying on read-time
  // resolution across rows that could otherwise silently diverge.
  if (columns.card_group_id) {
    const { error: fanOutError } = await supabase
      .from("accounts")
      .update({
        welcome_bonus_goal_amount: columns.welcome_bonus_goal_amount,
        welcome_bonus_goal_currency: columns.welcome_bonus_goal_currency,
        welcome_bonus_due_date: columns.welcome_bonus_due_date,
      })
      .eq("card_group_id", columns.card_group_id)
      .neq("id", id);
    if (fanOutError) return { error: await dbError(fanOutError, "updateAccount") };
  }

  return { id };
}

/**
 * Fills in art for cards that predate the feature.
 *
 * Everything else resolves art on save, which covers new cards and any card the
 * person edits. Cards created before card art existed would otherwise sit on
 * the default colour forever, because nothing ever writes them again. This
 * closes that gap without a one-off script: the accounts page calls it once
 * when it notices unresolved cards, and after it succeeds there is nothing left
 * to find, so it stops firing on its own.
 *
 * Standalone cards only — a card that belongs to a group is drawn by the
 * group's face, and the group is handled in the same pass below.
 *
 * Failures are swallowed per row. One card whose name the model cannot place
 * must not stop the rest from resolving, and none of this is worth an error in
 * front of someone who only opened a page.
 */
export async function backfillCardArt(): Promise<{ filled: number }> {
  const { supabase, user } = await requireUser();
  if (!user) return { filled: 0 };

  const [{ data: accounts }, { data: groups }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, color, card_group_id")
      .eq("type", "credit_card")
      .is("card_group_id", null)
      .is("color", null),
    supabase.from("card_groups").select("id, name, art_color").is("art_color", null),
  ]);

  let filled = 0;

  for (const account of accounts ?? []) {
    const art = await inferCardArt(account.name);
    if (!art) continue;
    const { error } = await supabase
      .from("accounts")
      .update({ color: art.accent, ...(art.network ? { brand: art.network } : {}) })
      .eq("id", account.id);
    if (!error) filled++;
  }

  for (const group of groups ?? []) {
    const art = await inferCardArt(group.name);
    if (!art) continue;
    const { error } = await supabase
      .from("card_groups")
      .update({
        art_color: art.accent,
        ...(art.network ? { brand: art.network } : {}),
      })
      .eq("id", group.id);
    if (!error) filled++;
  }

  if (filled > 0) {
  }
  return { filled };
}

export async function archiveAccount(id: string, archived: boolean): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };
  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: archived })
    .eq("id", id);
  if (error) return { error: await dbError(error, "archiveAccount") };
  return { id };
}

export async function deleteAccount(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteAccount") };
  return {};
}

export async function createBank(name: string): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Bank name is required." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };
  // Reuse an existing bank with the same name (case-insensitive) if present.
  const { data: existing } = await supabase
    .from("banks")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) {
    return { id: existing.id };
  }
  const { data, error } = await supabase
    .from("banks")
    .insert({ name: trimmed, user_id: user.id })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createBank") };
  return { id: data.id };
}

/**
 * Creates a card group and every currency line of it, in one call.
 *
 * This is the whole card-group flow now. It exists as one action rather than a
 * `createCardGroup` the dialog then follows with N `createAccount` calls because
 * the three things that made the old two-step wrong all live here:
 *
 * - Art is inferred ONCE, from the card's own name. Per-line inference would ask
 *   the model about "Visa Signature · Cuotas" three times and could come back
 *   with three different accents for one physical card. The group's accent is
 *   then written onto every line, so a line opened on its own still wears the
 *   card's colour.
 * - The lines land in a single insert, so a card is never half-created.
 * - A group whose lines fail to insert is deleted again rather than left behind
 *   as an empty group with no UI to remove it.
 */
export async function createCardWithLines(name: string, lines: AccountInput[]): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };
  if (lines.length === 0) return { error: "A card needs at least one line." };

  const parsed: AccountInput[] = [];
  for (const line of lines) {
    const result = accountInput.safeParse(line);
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Invalid input" };
    parsed.push(result.data);
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };

  // A group IS the physical card, so its face is the one that needs art.
  const art = await inferCardArt(trimmed);
  const face = {
    ...(art ? { color: art.accent } : {}),
    ...(art?.network ? { brand: art.network } : {}),
  };

  const { data: group, error: groupError } = await supabase
    .from("card_groups")
    .insert({
      name: trimmed,
      user_id: user.id,
      ...(art ? { art_color: art.accent } : {}),
      ...(art?.network ? { brand: art.network } : {}),
    })
    .select("id")
    .single();
  if (groupError) return { error: await dbError(groupError, "createCardWithLines") };

  const rows = parsed.map((line) => ({
    ...toColumns(line),
    ...face,
    currency: line.currency,
    card_group_id: group.id,
    user_id: user.id,
  }));
  const { error: linesError } = await supabase.from("accounts").insert(rows);
  if (linesError) {
    await supabase.from("card_groups").delete().eq("id", group.id);
    return { error: await dbError(linesError, "createCardWithLines") };
  }

  return { id: group.id };
}

/**
 * A credit card the user has not described yet — the entry point statement import
 * uses when someone has no card at all.
 *
 * Deliberately ungrouped: most cards in this market are a single DOP line, and a
 * one-line group would be a container around nothing. `addCardLine` promotes the
 * card if a statement turns out to have sections this one account cannot receive.
 */
export async function createCardStub(input: CardStubInput): Promise<Result> {
  const parsed = cardStubInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };

  const art = await inferCardArt(parsed.data.name);
  const res = await supabase
    .from("accounts")
    .insert({
      name: parsed.data.name,
      type: "credit_card",
      currency: parsed.data.currency,
      user_id: user.id,
      ...(parsed.data.last4 ? { last4: parsed.data.last4 } : {}),
      ...(art ? { color: art.accent } : {}),
      ...(art?.network ? { brand: art.network } : {}),
    })
    .select("id")
    .single();

  if (res.error) return { error: await dbError(res.error, "createCardStub") };
  return { id: res.data.id };
}

/**
 * A further line on a card that already exists — the USD or cuotas section of a
 * statement that the card's single account cannot receive, because
 * `suggestAccountId` matches sections to accounts by currency.
 *
 * Promotion is a plain card_group_id update: statement_section_mappings rows are
 * only ever written for cards that already have a group (see the guard in
 * confirmStatementImport), so an ungrouped card has none to re-key.
 */
export async function addCardLine(siblingId: string, input: CardStubInput): Promise<Result> {
  const parsed = cardStubInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };

  const { data: sibling } = await supabase
    .from("accounts")
    .select("id,name,type,card_group_id,color,brand")
    .eq("id", siblingId)
    .single();
  if (!sibling || sibling.type !== "credit_card") return { error: "Not a credit card." };

  // A group IS the physical card, so it inherits the face the sibling already wears.
  const face = {
    ...(sibling.color ? { color: sibling.color } : {}),
    ...(sibling.brand ? { brand: sibling.brand } : {}),
  };

  // Tracks whether THIS call minted the group, so a failure below can undo it.
  // A reused group predates this call and must never be deleted for a failure
  // that has nothing to do with its own creation.
  let groupId = sibling.card_group_id;
  let createdGroup = false;
  if (!groupId) {
    const { data: group, error: groupError } = await supabase
      .from("card_groups")
      .insert({
        name: sibling.name,
        user_id: user.id,
        ...(sibling.color ? { art_color: sibling.color } : {}),
        ...(sibling.brand ? { brand: sibling.brand } : {}),
      })
      .select("id")
      .single();
    if (groupError) return { error: await dbError(groupError, "addCardLine") };
    groupId = group.id;
    createdGroup = true;

    const { error: linkError } = await supabase
      .from("accounts")
      .update({ card_group_id: groupId })
      .eq("id", sibling.id);
    if (linkError) {
      // Same reasoning as createCardWithLines: a group this call just created,
      // with nothing successfully linked to it, must not survive to render as
      // an empty card in the gallery.
      await supabase.from("card_groups").delete().eq("id", groupId);
      return { error: await dbError(linkError, "addCardLine") };
    }
  }

  const res = await supabase
    .from("accounts")
    .insert({
      name: parsed.data.name,
      type: "credit_card",
      currency: parsed.data.currency,
      card_group_id: groupId,
      user_id: user.id,
      ...(parsed.data.last4 ? { last4: parsed.data.last4 } : {}),
      ...face,
    })
    .select("id")
    .single();

  if (res.error) {
    // The sibling is already linked to `groupId` at this point, so deleting the
    // group would orphan it too — only clean up when the group is new AND
    // nothing else references it yet, i.e. exactly the case this call created.
    if (createdGroup) await supabase.from("card_groups").delete().eq("id", groupId);
    return { error: await dbError(res.error, "addCardLine") };
  }
  return { id: res.data.id };
}

