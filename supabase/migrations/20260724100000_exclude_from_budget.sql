-- Mirror image of budget_only: this transaction still counts toward account
-- balance, card debt, and net worth as normal (the money really moved), but
-- is excluded from category budgets and spend-tracking views. For card
-- expenses made on behalf of someone else / a reimbursable business expense
-- — mostly relevant on imported statement lines.
alter table public.transactions
  add column exclude_from_budget boolean not null default false;

-- category_usage: add the exclusion to the "used" aggregate. This replaces
-- the version in 20260722120000_statement_import.sql (card payments already
-- excluded there to avoid double-counting against loan/card categories).
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
      and not t.exclude_from_budget
      and not (t.type = 'payment' and exists (
        select 1 from public.accounts ca
        where ca.id = t.to_account_id and ca.type = 'credit_card'))
      and date_trunc('month', t.occurred_at)::date = m.month
    group by t.category_id
  ) u on u.category_id = c.id
  where c.user_id = (select auth.uid());
$$;

-- spend_distribution: same exclusion, for the Insights donut.
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
    and not t.exclude_from_budget
    and t.category_id is not null
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', p_month)::date
  group by t.category_id
  order by total desc;
$$;
