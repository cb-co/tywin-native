-- supabase/migrations/20260915090000_recurring_income.sql
--
-- Recurring income ("paycheck"): the third `kind` on `subscriptions`, sitting
-- beside `expense` and `payment` (20260914150000_recurring_payments.sql).
-- Spec: docs/specs/2026-09-15-recurring-income-design.md
--
-- That migration's check constraint blocked `kind = 'income'` on the theory
-- that `profiles.pay_cycle` already covered it. It does not: pay_cycle only
-- decides budget period boundaries and records nothing. Two users have since
-- asked for exactly what a recorded income template gives — a one-tap way to
-- log a recurring paycheck, the same way subscriptions already do for bills.
--
-- `semimonthly` is a new billing_cycle, distinct from the existing
-- `biweekly`: "the 15th and the end of the month" (what most of the DR calls
-- quincenal, and what profiles.pay_cycle already means by the same name),
-- not biweekly's every-14-days-from-a-start-date. A semimonthly template
-- needs no anchor at all, the same way pay_cycle's semimonthly needs none.

alter type public.billing_cycle add value if not exists 'semimonthly' after 'biweekly';

alter table public.subscriptions
  drop constraint subscriptions_kind_not_income;
