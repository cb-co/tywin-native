import type { createClient } from "#/lib/supabase/server";
import { cardLineCurrency, cardLineName, type CardLine } from "@cigua/core/accounts/card-lines";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Result = { groupId: string; ids: Map<CardLine, string> } | { error: { code?: string | null; message?: string } };

/**
 * Gives a card the lines it is missing — the USD or cuotas section of a
 * statement that the card has no line for yet.
 *
 * An ungrouped card is promoted first: a group is minted under the card's name
 * and wearing its face, and the card becomes that group's line, renamed to say
 * which line it is so it reads the same as one the account dialog created.
 * The new lines land in a single insert, so a card is never half-extended; a
 * failure undoes a group this call minted (never one that already existed).
 */
export async function addCardLines(
  supabase: Supabase,
  userId: string,
  sibling: {
    id: string;
    name: string;
    card_group_id: string | null;
    card_line: string | null;
    color: string | null;
    brand: string | null;
    last4: string | null;
  },
  lines: CardLine[],
  installmentsLabel: string,
): Promise<Result> {
  const face = {
    ...(sibling.color ? { color: sibling.color } : {}),
    ...(sibling.brand ? { brand: sibling.brand } : {}),
  };

  let groupId: string;
  let groupName: string;
  let createdGroup = false;
  if (sibling.card_group_id) {
    groupId = sibling.card_group_id;
    const { data: group } = await supabase.from("card_groups").select("name").eq("id", groupId).single();
    groupName = group?.name ?? sibling.name;
  } else {
    groupName = sibling.name;
    const { data: group, error: groupError } = await supabase
      .from("card_groups")
      .insert({
        name: groupName,
        user_id: userId,
        ...(sibling.color ? { art_color: sibling.color } : {}),
        ...(sibling.brand ? { brand: sibling.brand } : {}),
      })
      .select("id")
      .single();
    if (groupError) return { error: groupError };
    groupId = group.id;
    createdGroup = true;

    const { error: linkError } = await supabase
      .from("accounts")
      .update({
        card_group_id: groupId,
        ...(sibling.card_line ? { name: cardLineName(groupName, sibling.card_line as CardLine, installmentsLabel) } : {}),
      })
      .eq("id", sibling.id);
    if (linkError) {
      await supabase.from("card_groups").delete().eq("id", groupId);
      return { error: linkError };
    }
  }

  const { data: rows, error } = await supabase
    .from("accounts")
    .insert(
      lines.map((line) => ({
        name: cardLineName(groupName, line, installmentsLabel),
        type: "credit_card" as const,
        currency: cardLineCurrency(line),
        card_line: line,
        card_group_id: groupId,
        user_id: userId,
        ...(sibling.last4 ? { last4: sibling.last4 } : {}),
        ...face,
      })),
    )
    .select("id,card_line");
  if (error) {
    if (createdGroup) {
      // The sibling points at the group by now; unlink it before the group goes,
      // or it would keep the line name of a card that no longer has lines.
      await supabase.from("accounts").update({ card_group_id: null, name: sibling.name }).eq("id", sibling.id);
      await supabase.from("card_groups").delete().eq("id", groupId);
    }
    return { error };
  }
  return { groupId, ids: new Map((rows ?? []).map((r) => [r.card_line as CardLine, r.id])) };
}
