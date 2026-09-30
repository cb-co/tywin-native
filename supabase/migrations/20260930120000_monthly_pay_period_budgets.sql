-- supabase/migrations/20260930120000_monthly_pay_period_budgets.sql
--
-- A monthly pay period takes its month's budget whole.
--
-- Both range functions prorate the stored MONTHLY amount by day over every
-- calendar month the range touches. That is right for a quincena or a week,
-- but a person paid once a month on the 14th has a period from Sep 14 to
-- Oct 13, and prorating that splits one paycheck's budget into 17/30 of
-- September's and 13/31 of October's. Until October's budgets exist it shows
-- barely half of what they budgeted.
--
-- p_whole says the range is one budget month (isBudgetMonth in
-- packages/core/src/period/cycle.ts, which decides it, since periods are only
-- ever computed in TypeScript). Then only the month holding p_start counts,
-- at factor 1: budget = budget_monthly. Spend still covers exactly
-- p_start..p_end. It defaults to false, so every existing caller, including
-- the category_usage(p_month) wrapper and a worker deployed before this
-- migration, gets exactly the figures it got before.
--
-- Adding a defaulted parameter with create or replace would leave the old
-- two-argument overload beside the new one and make every two-argument call
-- ambiguous, so each function is dropped first. category_usage's body calls
-- category_usage_range by name, which is resolved at run time, not tracked as
-- a dependency. Supabase's default privileges re-grant EXECUTE on recreate,
-- just as they did when these were first created.

drop function public.category_usage_range(date, date);
drop function public.budget_group_usage_range(date, date);

create or replace function public.category_usage_range(
  p_start date,
  p_end   date,
  p_whole boolean default false
)
returns table (
  category_id    uuid,
  budget_monthly numeric,
  budget         numeric,
  used           numeric,
  remaining      numeric,
  status         public.budget_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    -- A malformed or unbounded range must not become a table scan.
    select p_start as s, p_end as e
    where p_end >= p_start and p_end - p_start <= 366
  ),
  months as (
    select gs::date as month,
           extract(day from (gs + interval '1 month' - interval '1 day'))::int as month_days,
           case when p_whole
             then extract(day from (gs + interval '1 month' - interval '1 day'))::int
             else (least(b.e, (gs + interval '1 month' - interval '1 day')::date)
                     - greatest(b.s, gs::date) + 1)
           end as overlap_days
    from bounds b
    cross join generate_series(date_trunc('month', b.s),
                               case when p_whole then date_trunc('month', b.s)
                                    else date_trunc('month', b.e) end,
                               interval '1 month') gs
  ),
  budgets as (
    select cb.category_id,
           sum(cb.amount * mo.overlap_days::numeric / mo.month_days) as prorated,
           max(cb.amount) filter (
             where mo.month = (select date_trunc('month', s)::date from bounds)
           ) as monthly
    from months mo
    join public.category_budgets cb
      on cb.month = mo.month and cb.user_id = (select auth.uid())
    group by cb.category_id
  ),
  spend as (
    select t.category_id, sum(t.base_total_amount) as used
    from public.transactions t, bounds b
    where t.user_id = (select auth.uid())
      and t.category_id is not null
      and t.type in ('expense', 'payment')
      and not t.exclude_from_budget
      and t.occurred_at >= b.s
      and t.occurred_at <  b.e + 1
    group by t.category_id
  )
  select c.id as category_id,
         coalesce(bu.monthly, 0)  as budget_monthly,
         coalesce(bu.prorated, 0) as budget,
         coalesce(sp.used, 0)     as used,
         coalesce(bu.prorated, 0) - coalesce(sp.used, 0) as remaining,
         case
           when coalesce(sp.used, 0) > coalesce(bu.prorated, 0)
             then 'over'::public.budget_status
           when coalesce(bu.prorated, 0) > 0
             and coalesce(sp.used, 0) >= 0.9 * bu.prorated
             then 'approaching'::public.budget_status
           else 'within'::public.budget_status
         end as status
  from public.categories c
  left join budgets bu on bu.category_id = c.id
  left join spend   sp on sp.category_id = c.id
  where c.user_id = (select auth.uid());
$$;

create or replace function public.budget_group_usage_range(
  p_start date,
  p_end   date,
  p_whole boolean default false
)
returns table (
  budget_group_id uuid,
  budget_monthly  numeric,
  budget          numeric,
  used            numeric,
  remaining       numeric,
  status          public.budget_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    -- A malformed or unbounded range must not become a table scan.
    select p_start as s, p_end as e
    where p_end >= p_start and p_end - p_start <= 366
  ),
  months as (
    select gs::date as month,
           extract(day from (gs + interval '1 month' - interval '1 day'))::int as month_days,
           case when p_whole
             then extract(day from (gs + interval '1 month' - interval '1 day'))::int
             else (least(b.e, (gs + interval '1 month' - interval '1 day')::date)
                     - greatest(b.s, gs::date) + 1)
           end as overlap_days
    from bounds b
    cross join generate_series(date_trunc('month', b.s),
                               case when p_whole then date_trunc('month', b.s)
                                    else date_trunc('month', b.e) end,
                               interval '1 month') gs
  ),
  budgets as (
    select gb.budget_group_id,
           sum(gb.amount * mo.overlap_days::numeric / mo.month_days) as prorated,
           max(gb.amount) filter (
             where mo.month = (select date_trunc('month', s)::date from bounds)
           ) as monthly
    from months mo
    join public.budget_group_budgets gb
      on gb.month = mo.month and gb.user_id = (select auth.uid())
    group by gb.budget_group_id
  ),
  spend as (
    -- category_usage_range's inclusion rule and range predicate, verbatim;
    -- only the grouping key differs. effective_budget_group is what lets a
    -- per-transaction override land in exactly one group.
    select public.effective_budget_group(t.budget_group_id, c.budget_group_id) as budget_group_id,
           sum(t.base_total_amount) as used
    from public.transactions t
    cross join bounds b
    left join public.categories c on c.id = t.category_id
    where t.user_id = (select auth.uid())
      and t.type in ('expense', 'payment')
      and not t.exclude_from_budget
      and t.occurred_at >= b.s
      and t.occurred_at <  b.e + 1
    group by 1
  )
  select g.id as budget_group_id,
         coalesce(bu.monthly, 0)  as budget_monthly,
         coalesce(bu.prorated, 0) as budget,
         coalesce(sp.used, 0)     as used,
         coalesce(bu.prorated, 0) - coalesce(sp.used, 0) as remaining,
         case
           when coalesce(sp.used, 0) > coalesce(bu.prorated, 0)
             then 'over'::public.budget_status
           when coalesce(bu.prorated, 0) > 0
             and coalesce(sp.used, 0) >= 0.9 * bu.prorated
             then 'approaching'::public.budget_status
           else 'within'::public.budget_status
         end as status
  from public.budget_groups g
  left join budgets bu on bu.budget_group_id = g.id
  left join spend   sp on sp.budget_group_id = g.id
  where g.user_id = (select auth.uid());
$$;
