-- Non-card account balances (own currency + base) -----------------------
create view public.account_balances
with (security_invoker = true) as
with movements as (
  select a.id as account_id,
         a.user_id,
         a.currency,
         a.starting_balance,
         -- own-currency net from transactions (exclude budget_only)
         coalesce(sum(case
           when t.budget_only then 0
           when t.type = 'income'  and t.account_id = a.id then t.amount
           when t.type = 'expense' and t.account_id = a.id then -t.total_amount
           when t.type = 'payment' and t.account_id = a.id then -t.total_amount
           when t.type = 'payment' and t.to_account_id = a.id then t.amount
           else 0 end), 0) as net_amount,
         coalesce(sum(case
           when t.budget_only then 0
           when t.type = 'income'  and t.account_id = a.id then t.base_amount
           when t.type = 'expense' and t.account_id = a.id then -t.base_total_amount
           when t.type = 'payment' and t.account_id = a.id then -t.base_total_amount
           when t.type = 'payment' and t.to_account_id = a.id then t.base_amount
           else 0 end), 0) as net_base_amount
  from public.accounts a
  left join public.transactions t
    on (t.account_id = a.id or t.to_account_id = a.id)
  where a.type <> 'credit_card'
  group by a.id, a.user_id, a.currency, a.starting_balance
)
select account_id, user_id, currency,
       starting_balance,
       starting_balance + net_amount as balance,   -- own currency
       net_base_amount               as base_movement
from movements;

-- Credit-card status ----------------------------------------------------
create view public.card_status
with (security_invoker = true) as
select a.id as account_id,
       a.user_id,
       a.currency,
       a.current_balance as owed,
       a.credit_limit,
       case when a.credit_limit is null or a.credit_limit = 0 then null
            else round(a.current_balance / a.credit_limit * 100, 2) end as utilization_pct,
       s.statement_balance as latest_statement_balance,
       s.due_date          as latest_due_date,
       a.statement_closing_day,
       a.payment_due_day
from public.accounts a
left join lateral (
  select statement_balance, due_date
  from public.card_statements cs
  where cs.account_id = a.id
  order by cs.period_end desc
  limit 1
) s on true
where a.type = 'credit_card';

-- Loan status -----------------------------------------------------------
create view public.loan_status
with (security_invoker = true) as
select a.id as account_id,
       a.user_id,
       a.currency,
       a.principal,
       a.installment_amount,
       a.term_months,
       a.payment_due_day,
       -- outstanding = principal - sum(payments into the loan, exclude budget_only)
       a.principal - coalesce((
         select sum(t.amount) from public.transactions t
         where t.to_account_id = a.id and t.type = 'payment' and not t.budget_only
       ), 0) as outstanding_balance,
       coalesce((
         select count(*) from public.transactions t
         where t.to_account_id = a.id and t.type = 'payment' and not t.budget_only
       ), 0) as installments_paid
from public.accounts a
where a.type = 'loan';

-- Net worth (base currency) ---------------------------------------------
-- base_movement is already converted via each transaction's rate; starting_balance
-- is treated at par to base (rate 1). A proper FX conversion of foreign-currency
-- starting balances needs a rates table and is deferred to Insights (Phase 7).
create view public.net_worth
with (security_invoker = true) as
select p.id as user_id,
       p.base_currency,
       coalesce((
         select sum(ab.starting_balance + ab.base_movement)
         from public.account_balances ab where ab.user_id = p.id
       ), 0)
       - coalesce((
         select sum(cs.owed) from public.card_status cs where cs.user_id = p.id
       ), 0)
       - coalesce((
         select sum(ls.outstanding_balance) from public.loan_status ls where ls.user_id = p.id
       ), 0) as net_worth
from public.profiles p;

-- Monthly cash flow (base currency) -------------------------------------
create view public.monthly_cashflow
with (security_invoker = true) as
select t.user_id,
       date_trunc('month', t.occurred_at)::date as month,
       sum(case when t.type = 'income' then t.base_amount else 0 end)  as income,
       sum(case when t.type = 'expense' and not t.budget_only
                then t.base_total_amount else 0 end)                    as expense,
       sum(case when t.type = 'income' then t.base_amount
                when t.type = 'expense' and not t.budget_only then -t.base_total_amount
                else 0 end)                                             as net
from public.transactions t
group by t.user_id, date_trunc('month', t.occurred_at)::date;

-- Category usage for a month --------------------------------------------
-- used = sum(base_total of categorized expenses + categorized payments in the
-- month, incl. tax/fee, incl. budget_only expenses). (spec 3.5)
create or replace function public.category_usage(p_month date)
returns table (
  category_id uuid,
  budget      numeric,
  used        numeric,
  remaining   numeric,
  status      public.budget_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  with m as (select date_trunc('month', p_month)::date as month)
  select c.id as category_id,
         coalesce(b.amount, 0) as budget,
         coalesce(u.used, 0)   as used,
         coalesce(b.amount, 0) - coalesce(u.used, 0) as remaining,
         case
           when coalesce(u.used,0) > coalesce(b.amount,0) then 'over'::public.budget_status
           when coalesce(b.amount,0) > 0
             and coalesce(u.used,0) >= 0.9 * b.amount     then 'approaching'::public.budget_status
           else 'within'::public.budget_status
         end as status
  from public.categories c
  cross join m
  left join public.category_budgets b
    on b.category_id = c.id and b.month = m.month
  left join (
    select t.category_id, sum(t.base_total_amount) as used
    from public.transactions t, m
    where t.category_id is not null
      and t.type in ('expense','payment')
      and date_trunc('month', t.occurred_at)::date = m.month
    group by t.category_id
  ) u on u.category_id = c.id
  where c.user_id = (select auth.uid());
$$;

-- Spend distribution for a month ----------------------------------------
create or replace function public.spend_distribution(p_month date)
returns table (category_id uuid, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.category_id, sum(t.base_total_amount) as total
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.type = 'expense'
    and t.category_id is not null
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', p_month)::date
  group by t.category_id
  order by total desc;
$$;
