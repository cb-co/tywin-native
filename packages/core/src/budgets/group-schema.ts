import { z } from "zod";

/**
 * A budget group's own fields — name, emoji, colour — which are exactly a
 * category's, and deliberately so. The two dialogs sit one button apart on the
 * Budgets page, and a group that asked for something different there would
 * read as a different kind of thing rather than the other half of the same
 * idea.
 *
 * Takes its message the way `categorySchema` does, because the string is
 * translated and zod is not.
 */
export function budgetGroupSchema(nameRequiredMessage: string) {
  return z.object({
    name: z.string().trim().min(1, nameRequiredMessage).max(40),
    emoji: z.string().trim().max(8).optional().or(z.literal("")),
    color: z.string().trim().max(9).optional().or(z.literal("")),
  });
}

/** The monthly amount planned against a group. `category_budgets`' sibling,
 *  down to the month shape — the first of a month, or nothing. */
export const setGroupBudgetSchema = z.object({
  budget_group_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}-01$/),
  amount: z.coerce.number().min(0),
});

/**
 * Which group a category rolls up to.
 *
 * `budget_group_id` is `.nullable()` and not `.optional()`: null is a value
 * here, meaning "this category belongs to no group", and it has to survive
 * validation as one. An optional field would let a missing key parse cleanly
 * and then write nothing, so clearing a category's group would silently
 * no-op — the row would keep the group the user just removed.
 */
export const categoryGroupSchema = z.object({
  category_id: z.string().uuid(),
  budget_group_id: z.string().uuid().nullable(),
});

/**
 * A select's value as a group id, or null.
 *
 * Every place a group can be chosen offers a way to choose none — an empty
 * value on the category dialog, the "inherit from the category" sentinel on
 * the transaction form — and both arrive as strings. Sending either one at the
 * database produces an invalid-uuid error the user cannot act on, so they are
 * normalised to null here, once, rather than at each call site.
 */
export const NO_GROUP = "none";

export function toGroupId(value: string | null | undefined): string | null {
  if (!value || value === NO_GROUP) return null;
  return value;
}
