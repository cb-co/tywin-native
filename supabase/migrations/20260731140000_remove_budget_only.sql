-- budget_only ("counts toward budget only, not balance") has no real use —
-- nothing in this codebase or its data ever sets it true outside a test
-- fixture. Removing it end to end: every view/function below stops
-- special-casing it (equivalent to treating every row as budget_only=false,
-- which was already the default and, in practice, the only value that ever
-- existed), then the column is dropped. Functions must stop referencing the
-- column before it's dropped, so this migration does that first.

create or replace view public.account_balances
with (security_invoker = true) as
with movements as (
  select a.id as account_id,
         a.user_id,
         a.currency,
         a.starting_balance,
         -- own-currency net from transactions
         coalesce(sum(case
           when t.type = 'income'  and t.account_id = a.id then t.amount
           when t.type = 'expense' and t.account_id = a.id then -t.total_amount
           when t.type = 'payment' and t.account_id = a.id then -t.total_amount
           when t.type = 'payment' and t.to_account_id = a.id
             then coalesce(t.to_amount, t.amount)
           else 0 end), 0) as net_amount,
         -- base-currency net. The destination leg is worth the same in base as
         -- the source leg, so base_amount serves both; only tax/fee (which stay
         -- with the source) make the two sides differ.
         coalesce(sum(case
           when t.type = 'income'  and t.account_id = a.id then t.base_amount
           when t.type = 'expense' and t.account_id = a.id then -t.base_total_amount
           when t.type = 'payment' and t.account_id = a.id then -t.base_total_amount
           when t.type = 'payment' and t.to_account_id = a.id then t.base_amount
           else 0 end), 0) as net_base_amount
  from public.accounts a
  left join public.transactions t
    on (t.account_id = a.id or t.to_account_id = a.id)
  -- loans and cards are represented solely by their *_status views
  where a.type not in ('credit_card', 'loan')
  group by a.id, a.user_id, a.currency, a.starting_balance
)
select account_id, user_id, currency,
       starting_balance,
       starting_balance + net_amount as balance,   -- own currency
       net_base_amount               as base_movement
from movements;

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
  where t.type = 'payment'
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
  where t.to_account_id = a.id and t.type = 'payment'
) p on true
where a.type = 'loan';

comment on view public.loan_status is
  'Per-loan status. outstanding_balance amortizes each logged payment (interest first, then principal) rather than subtracting the full installment, so it tracks the Balance column of the account page amortization schedule.';

create or replace function public.recompute_card_balance(p_account uuid)
returns void language plpgsql
set search_path = ''
as $$
declare
  anchor record;
begin
  select cs.total_balance, cs.period_end into anchor
  from public.card_statements cs
  where cs.account_id = p_account
  order by cs.period_end desc
  limit 1;
  if not found then return; end if;

  update public.accounts a
  set current_balance = anchor.total_balance - coalesce((
        select sum(coalesce(t.to_amount, t.amount))
        from public.transactions t
        where t.to_account_id = p_account
          and t.type = 'payment'
          and t.occurred_at::date > anchor.period_end
      ), 0)
  where a.id = p_account and a.type = 'credit_card';
end;
$$;

alter table public.transactions drop column budget_only;
