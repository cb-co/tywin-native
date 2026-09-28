import { z } from "zod";
import { BILLING_CYCLE_VALUES, usesAnchorDate } from "./cycle";
import { RECURRING_KINDS } from "./template";
import { SEMIMONTHLY_MAX_ANCHOR } from "../period/cycle";

export const subscriptionInput = z
  .object({
    kind: z.enum(RECURRING_KINDS).default("expense"),
    name: z.string().trim().min(1, "Name is required").max(60),
    amount: z.coerce.number().min(0),
    currency: z.string().trim().length(3).toUpperCase(),
    billing_cycle: z.enum(BILLING_CYCLE_VALUES),
    anchor_day: z.coerce.number().int().min(1).max(31).optional(),
    anchor_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date")
      .optional()
      .or(z.literal("")),
    account_id: z.string().uuid().optional().or(z.literal("")),
    to_account_id: z.string().uuid().optional().or(z.literal("")),
    category_id: z.string().uuid().optional().or(z.literal("")),
    include_tax: z.boolean().default(false),
    include_commission: z.boolean().default(false),
    is_active: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    // Without a start date a biweekly payment has no occurrences at all, where
    // the day-number cycles merely show no next date.
    // Its second payday is 15 days after the first, so the first stops at 15.
    if (v.billing_cycle === "semimonthly" && v.anchor_day != null && v.anchor_day > SEMIMONTHLY_MAX_ANCHOR)
      ctx.addIssue({ code: "custom", path: ["anchor_day"], message: "Pick a day from 1 to 15" });
    if (usesAnchorDate(v.billing_cycle) && !v.anchor_date)
      ctx.addIssue({ code: "custom", path: ["anchor_date"], message: "Pick a start date" });
    // Income has to land somewhere: the deposit account is what gives the
    // recorded transaction its currency, so a template without one can be saved
    // but never recorded (addCharge fails with needsAccount). Better to ask now.
    if (v.kind === "income" && !v.account_id)
      ctx.addIssue({ code: "custom", path: ["account_id"], message: "Pick the account it's deposited into" });
    if (v.kind === "payment") {
      if (!v.account_id)
        ctx.addIssue({ code: "custom", path: ["account_id"], message: "Pick the account it's paid from" });
      if (!v.to_account_id)
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Pick the account it pays" });
      else if (v.to_account_id === v.account_id)
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Pick a different account" });
    }
  });

export type SubscriptionInput = z.infer<typeof subscriptionInput>;
