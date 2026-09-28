import { z } from "zod";

export const TRANSACTION_TYPES = ["expense", "income", "payment"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const transactionInput = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    account_id: z.string().uuid("Pick an account"),
    to_account_id: z.string().uuid().optional().or(z.literal("")),
    category_id: z.string().uuid().optional().or(z.literal("")),
    amount: z.coerce.number().positive("Enter an amount greater than zero"),
    // Payment destination leg, in the destination account's currency. Optional
    // here because only the form knows both accounts' currencies; the DB
    // rejects a cross-currency payment that omits it.
    to_amount: z.coerce.number().positive().optional(),
    // No currency and no exchange_rate here on purpose — the client sends
    // neither.
    //
    // A transaction is always denominated in its own account's currency: the
    // bank settles in what the account holds, whatever the merchant billed. So
    // the currency is a fact about the account, not an input, and the server
    // reads it from `accounts` (see currencyContext). Accepting it from the
    // client only created the chance for the two to disagree — and
    // `account_balances` applies `amount` to the account raw, so a row saying
    // "50 EUR" on a USD card takes 50 USD out of it.
    //
    // exchange_rate converts this row into the base currency for budgets and
    // net worth only. Nothing the user experienced was converted at that rate,
    // so the server derives it from the FX service rather than asking. See
    // resolveBaseRate in ./money.
    include_tax: z.boolean().default(false),
    include_commission: z.boolean().default(false),
    exclude_from_budget: z.boolean().default(false),
    /* The per-transaction budget-group override, and the reason the schema has
       two group-ish fields where the database has one.

       Empty means INHERIT, never "no group": `effective_budget_group` coalesces
       the transaction's group over the category's, so a null here leaves the row
       counting under whatever its category rolls up to. Saying "belongs to no
       group at all" is not something a single transaction can say, and nothing
       in the form offers it — clearing the override on a categorised row puts it
       back under its category's group, which is the only sensible reading of
       clearing an override. */
    budget_group_id: z.string().uuid().optional().or(z.literal("")),
    occurred_at: z.string().min(1, "Pick a date"),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.type === "expense" && !v.category_id)
      ctx.addIssue({ code: "custom", path: ["category_id"], message: "Pick a category" });
    if (v.type === "income" && v.category_id)
      ctx.addIssue({ code: "custom", path: ["category_id"], message: "Income has no category" });
    // Income is not spending, so it counts against no plan and has nothing to
    // override. The same rule the category above already follows.
    if (v.type === "income" && v.budget_group_id)
      ctx.addIssue({ code: "custom", path: ["budget_group_id"], message: "Income has no budget group" });
    if (v.type === "payment") {
      if (!v.to_account_id)
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Pick a destination account" });
      if (v.to_account_id && v.to_account_id === v.account_id)
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Choose a different account" });
    }
    if (v.type !== "payment" && v.to_account_id)
      ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Only payments have a destination" });
    if (v.type !== "payment" && v.to_amount !== undefined)
      ctx.addIssue({ code: "custom", path: ["to_amount"], message: "Only payments have a destination amount" });
  });

export type TransactionInput = z.infer<typeof transactionInput>;
