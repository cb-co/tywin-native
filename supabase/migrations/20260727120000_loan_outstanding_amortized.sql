-- A loan payment was taking the whole installment off the outstanding balance.
--
-- `loan_status.outstanding_balance` was `principal - sum(payments)`. An
-- installment is interest + principal, and only the principal part reduces the
-- debt, so every payment overstated the paydown by that month's interest. The
-- amortization schedule on the account page (lib/accounts/amortization.ts) has
-- always split each installment correctly, which is why its Balance column and
-- the hero "Outstanding balance" figure disagreed — by more and more as the
-- loan ran. Net worth, which subtracts `outstanding_balance`, inherited the
-- same error and flattered itself.
--
-- Fix: walk each loan's payments in chronological order and amortize them,
-- with the same arithmetic buildSchedule() applies per row:
--
--   interest  = round(balance * interest_rate / 12, 2)
--   principal = clamp(payment - interest, 0, balance)
--   balance   = balance - principal
--
-- Edges, all mirroring buildSchedule():
--   * interest_rate null or 0 -> the whole payment is principal, i.e. exactly
--     the old behaviour, so zero-interest loans are unaffected.
--   * A payment smaller than the period's interest pays no principal, and the
--     balance holds instead of growing (no negative amortization).
--   * Payment number `term_months` is the last scheduled one and clears
--     whatever remains, so an installment the user typed rounded to the peso
--     can't leave a residual the schedule doesn't show. Payments beyond the
--     term keep the balance at zero.
--   * Interest accrues per payment, not per elapsed month: one installment is
--     one period, the same assumption the schedule makes. A skipped or doubled
--     month therefore shifts the split, not the count.
--
-- The payment leg used is `coalesce(to_amount, amount)` — the loan's own
-- currency — unchanged from 20260720093500. Column list and order are
-- unchanged too (`create or replace view` cannot drop or rename columns);
-- only `outstanding_balance` gains the amortization.
create or replace view public.loan_status
with (security_invoker = true) as
with recursive pay as (
  select t.to_account_id as account_id,
         coalesce(t.to_amount, t.amount) as amount,
         row_number() over (
           partition by t.to_account_id
           order by t.occurred_at, t.created_at, t.id
         ) as seq
  from public.transactions t
  join public.accounts la
    on la.id = t.to_account_id and la.type = 'loan'
  where t.type = 'payment' and not t.budget_only
),
-- One row per loan per payment applied: seq 0 is the loan at origination,
-- seq n the balance left after its nth payment.
run as (
  select a.id                                      as account_id,
         0::bigint                                 as seq,
         coalesce(a.principal, 0)::numeric         as balance,
         coalesce(a.interest_rate, 0)::numeric / 12 as monthly_rate,
         a.term_months                             as term_months
  from public.accounts a
  where a.type = 'loan'
  union all
  select run.account_id,
         pay.seq,
         case
           when run.term_months is not null and pay.seq >= run.term_months then 0
           else run.balance - least(
                  greatest(pay.amount - round(run.balance * run.monthly_rate, 2), 0),
                  run.balance)
         end,
         run.monthly_rate,
         run.term_months
  from run
  join pay on pay.account_id = run.account_id and pay.seq = run.seq + 1
),
amortized as (
  select distinct on (account_id) account_id, balance
  from run
  order by account_id, seq desc
)
select a.id as account_id,
       a.user_id,
       a.currency,
       a.principal,
       a.installment_amount,
       a.term_months,
       a.payment_due_day,
       round(coalesce(am.balance, a.principal, 0), 2) as outstanding_balance,
       coalesce(p.paid_count, 0)                      as installments_paid,
       a.original_term_months,
       coalesce(a.original_term_months, a.term_months) as progress_term_months,
       greatest(coalesce(a.original_term_months, a.term_months) - coalesce(a.term_months, 0), 0)
         + coalesce(p.paid_count, 0) as progress_installments_paid
from public.accounts a
left join amortized am on am.account_id = a.id
left join lateral (
  select count(*) as paid_count
  from public.transactions t
  where t.to_account_id = a.id and t.type = 'payment' and not t.budget_only
) p on true
where a.type = 'loan';

comment on view public.loan_status is
  'Per-loan status. outstanding_balance amortizes each logged payment (interest first, then principal) rather than subtracting the full installment, so it tracks the Balance column of the account page amortization schedule.';
