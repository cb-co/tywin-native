-- spend_distribution now mirrors category_usage's inclusion rule (see
-- 20260731130000_card_payment_default_and_cashflow.sql, which made card
-- payments count toward budget by category): the Insights donut and
-- spending-pace chart were still expense-only, so a categorized card
-- payment showed up in the budget bars but was invisible here.
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
    and t.type in ('expense','payment')
    and not t.exclude_from_budget
    and t.category_id is not null
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', p_month)::date
  group by t.category_id
  order by total desc;
$$;
