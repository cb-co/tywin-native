-- Loan progress display ---------------------------------------------------
-- `term_months` is the remaining term as of when the loan was added to
-- Cashly (see the account form's loan hint) and stays the anchor for the
-- forward-looking amortization schedule and outstanding_balance math —
-- unchanged by this migration.
--
-- `original_term_months` is optional: for a loan that already had payments
-- made before it was added here, it lets the progress bar reflect those,
-- purely for display. It never affects outstanding_balance or the schedule.
alter table public.accounts
  add column original_term_months integer
  check (original_term_months is null or original_term_months >= 0);

create or replace view public.loan_status
with (security_invoker = true) as
select a.id as account_id,
       a.user_id,
       a.currency,
       a.principal,
       a.installment_amount,
       a.term_months,
       a.payment_due_day,
       a.principal - coalesce(p.paid_amount, 0) as outstanding_balance,
       coalesce(p.paid_count, 0)                as installments_paid,
       a.original_term_months,
       -- Assumed-paid-before-tracking (original minus remaining-at-entry) plus
       -- payments actually logged since. Falls back to term_months/installments_paid
       -- when original_term_months isn't set, matching the pre-migration behavior.
       coalesce(a.original_term_months, a.term_months) as progress_term_months,
       greatest(coalesce(a.original_term_months, a.term_months) - coalesce(a.term_months, 0), 0)
         + coalesce(p.paid_count, 0) as progress_installments_paid
from public.accounts a
left join lateral (
  select count(*) as paid_count, sum(t.amount) as paid_amount
  from public.transactions t
  where t.to_account_id = a.id and t.type = 'payment' and not t.budget_only
) p on true
where a.type = 'loan';
