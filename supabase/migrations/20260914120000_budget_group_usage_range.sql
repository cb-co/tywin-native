-- supabase/migrations/20260914120000_budget_group_usage_range.sql
--
-- Budget groups on the pay-cycle period.
--
-- 20260825140000_budget_groups.sql shipped q_budget_groups keyed by calendar
-- month, and 20260908120000_pay_cycle.sql then moved every budget surface onto
-- an explicit p_start/p_end range. A group band that still reset on the 1st,
-- sitting above a category band that resets on the 16th, would be the two
-- clocks the pay-cycle change exists to remove. So groups get the same shape
-- category_usage_range has, and follow the same framing: budget_group_budgets
-- keeps storing a MONTHLY amount, prorated onto the range as
--   amount(month) * overlapping_days(month) / days_in(month)
-- and budget_monthly is the stored amount for the month containing p_start —
-- the figure the amount input edits.
--
-- One row per group, budgeted or not. q_budget_groups omits unbudgeted groups
-- by design, and the app used to backfill their spend from q_transactions in
-- TypeScript; answering both halves here means the spend rule and the status
-- thresholds each exist once, in SQL, beside the category version they must
-- agree with.
--
-- q_budget_groups is left exactly as it is: /ask reads it, and a month-keyed
-- view is still the right shape for "how did March go".
create or replace function public.budget_group_usage_range(p_start date, p_end date)
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
           (least(b.e, (gs + interval '1 month' - interval '1 day')::date)
              - greatest(b.s, gs::date) + 1) as overlap_days
    from bounds b
    cross join generate_series(date_trunc('month', b.s),
                               date_trunc('month', b.e),
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
