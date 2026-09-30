-- supabase/migrations/20260908120000_pay_cycle.sql
--
-- UX-05 and UX-06. Spec: docs/specs/2026-09-08-pay-cycle-safe-to-spend-design.md
--
-- Most of the DR is paid quincenal — the 15th and the end of the month. Every
-- aggregate in this schema buckets on date_trunc('month', occurred_at), so a
-- budget resets on the 1st and tells a user they are on track on the 14th
-- while they are actually broke.
--
-- The shape of the fix: each month-keyed routine gains a _range sibling
-- holding the real body, and the p_month signature becomes a thin wrapper over
-- it. Every current caller keeps working, and each inclusion rule still exists
-- in exactly one place — which matters here specifically, because
-- 20260822143000 exists because a TypeScript copy of one of these rules
-- drifted from the SQL one and shipped wrong figures.
--
-- Periods are NOT derived here. The app computes p_start/p_end in
-- lib/period/cycle.ts and passes them down, so a boundary is defined once.

create type public.pay_cycle as enum ('monthly', 'semimonthly', 'weekly');

alter table public.profiles
  add column pay_cycle       public.pay_cycle,
  add column pay_anchor_day  smallint;

-- Existing rows keep exactly today's behaviour rather than silently changing
-- period the moment this lands. The new default applies to new profiles only,
-- which is where "quincenal by default for a DOP base currency" belongs:
-- base_currency already defaults to DOP (CHK-02), so a new Dominican profile
-- now opens on a quincenal period without touching a setting.
update public.profiles set pay_cycle = 'monthly' where pay_cycle is null;

alter table public.profiles
  alter column pay_cycle set default 'semimonthly',
  alter column pay_cycle set not null;

-- The anchor's meaning depends on the cycle, so the check is written per cycle
-- rather than as one loose `between 1 and 31` that would accept a weekday of
-- 30. Consequence for the app: switching monthly -> semimonthly must null the
-- anchor in the same statement, or this rejects the write.
--
-- A null anchor is allowed for monthly and weekly, and it is not "unset" —
-- it means the default: the 1st for monthly, Monday for weekly, exactly as
-- lib/period/cycle.ts (Task 1) already resolves a null anchor. semimonthly
-- has no such default because it has nothing to anchor: its two periods
-- always fall on the 15th and the end of the month, which is why its clause
-- requires null rather than merely allowing it. Writing "is null or between"
-- explicitly, instead of leaving a bare `between` for Postgres's three-valued
-- logic to quietly pass a null through, is what keeps a later reader from
-- "tightening" this into rejecting the very state the app relies on.
alter table public.profiles
  add constraint profiles_pay_anchor_day_valid check (
    (pay_cycle = 'semimonthly' and pay_anchor_day is null)
    or (pay_cycle = 'monthly' and (pay_anchor_day is null or pay_anchor_day between 1 and 31))
    or (pay_cycle = 'weekly'  and (pay_anchor_day is null or pay_anchor_day between 1 and 7))
  );

-- card_status does not expose the statement's minimum payment, and the
-- safe-to-spend figure needs it. The column lives on card_statements (added in
-- 20260722120000) and the lateral join here already picks the newest
-- statement, so this is one more column on that select. Appending is safe
-- under create or replace view — same move, same reasoning, as
-- 20260727140000_card_status_period_end.sql.
create or replace view public.card_status
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
       a.payment_due_day,
       s.period_end        as latest_period_end,
       s.minimum_payment   as latest_minimum_payment
from public.accounts a
left join lateral (
  select statement_balance, due_date, period_end, minimum_payment
  from public.card_statements cs
  where cs.account_id = a.id
  order by cs.period_end desc
  limit 1
) s on true
where a.type = 'credit_card';

comment on view public.card_status is
  'Credit cards with their newest statement (by period_end). latest_period_end '
  'is that statement''s closing date: payments occurring after it settle the '
  'statement, payments before it are already reflected in its balance. '
  'latest_minimum_payment is null when the bank printed no minimum — callers '
  'must fall back to the full amount due rather than inventing one.';

-- The budget surfaces' inclusion rule, unchanged from
-- 20260731130000_card_payment_default_and_cashflow.sql: expenses and payments,
-- excluding anything flagged exclude_from_budget.
--
-- occurred_at is timestamptz and every existing routine buckets it with
-- date_trunc(..., occurred_at), which resolves in the database's timezone. The
-- range predicate below is written `>= p_start and < p_end + 1` so its
-- implicit date-to-timestamptz cast lands on that same midnight boundary. Not
-- incidental: 20260822143000 exists partly because two charts on one page
-- bucketed in different timezones and disagreed about a late-night charge.
--
-- Proration: category_budgets keeps storing a MONTHLY amount and nothing about
-- that table changes. `budget` is that amount prorated onto the requested
-- range as the sum, over each month the range touches, of
--   amount(month) * overlapping_days(month) / days_in(month)
-- which covers a calendar month (factor 1), either half of a quincena, and a
-- week straddling two months with different budgets. `budget_monthly` is the
-- stored amount for the month containing p_start — the figure the UI shows
-- beside the prorated one ("RD$5,000/mes · RD$2,500 esta quincena"). Returning
-- both from one function is what stops the two numbers disagreeing.
create or replace function public.category_usage_range(p_start date, p_end date)
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
           (least(b.e, (gs + interval '1 month' - interval '1 day')::date)
              - greatest(b.s, gs::date) + 1) as overlap_days
    from bounds b
    cross join generate_series(date_trunc('month', b.s),
                               date_trunc('month', b.e),
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

-- The month signature becomes a wrapper. Its column list is unchanged from
-- 20260731130000, so every existing caller — lib/budgets/queries.ts,
-- lib/overview/queries.ts, the Insights budget bars — is untouched.
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
  select r.category_id, r.budget, r.used, r.remaining, r.status
  from public.category_usage_range(
    date_trunc('month', p_month)::date,
    (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date
  ) r;
$$;

-- Same inclusion rule as category_usage_range, on the rows it cannot reach:
-- category_usage joins FROM categories, so a null-category row can never
-- appear in it. Copied exactly, as in 20260819131444.
create or replace function public.uncategorized_spend_range(p_start date, p_end date)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(t.base_total_amount), 0)
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.category_id is null
    and t.type in ('expense', 'payment')
    and not t.exclude_from_budget
    and t.occurred_at >= p_start
    and t.occurred_at <  p_end + 1
    and p_end >= p_start
    and p_end - p_start <= 366;
$$;

create or replace function public.uncategorized_spend(p_month date)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select public.uncategorized_spend_range(
    date_trunc('month', p_month)::date,
    (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date);
$$;

-- The accrual rule, unchanged from 20260822143000: an expense from whatever
-- account, plus a payment only when it retires a loan. Card payments are
-- dropped because the underlying charges are counted directly.
create or replace function public.spend_distribution_range(p_start date, p_end date)
returns table (category_id uuid, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.category_id, sum(t.base_total_amount) as total
  from public.transactions t
  left join public.accounts da on da.id = t.to_account_id
  where t.user_id = (select auth.uid())
    and (t.type = 'expense' or (t.type = 'payment' and da.type = 'loan'))
    and t.occurred_at >= p_start
    and t.occurred_at <  p_end + 1
    and p_end >= p_start
    and p_end - p_start <= 366
  group by t.category_id
  order by total desc;
$$;

create or replace function public.spend_distribution(p_month date)
returns table (category_id uuid, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.spend_distribution_range(
    date_trunc('month', p_month)::date,
    (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date);
$$;

-- Pace, keyed on day-offset from the period start rather than day-of-month, and
-- compared against the period immediately preceding this one. A quincena is
-- then paced against the previous quincena rather than against a month it does
-- not fit inside. Unlike the calendar-month version this replaces, the previous
-- period here is constructed to the same length as the current one (`prev_s`
-- is exactly `cur_days` before `p_start`), not to whatever the actual prior
-- pay-cycle period happened to be — a quincena can vary from 13 to 16 days
-- depending on the month, and comparing two different lengths is what the
-- day-offset framing exists to avoid. So both series always cover the same
-- day-offsets 0..cur_days-1, and both columns are zero-filled (coalesce),
-- never null: there is no shorter period here for a null to mark the end of.
create or replace function public.spending_pace_range(p_start date, p_end date)
returns table (day_offset integer, this_period numeric, last_period numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select p_start as s,
           p_end   as e,
           (p_end - p_start + 1)                     as cur_days,
           p_start - (p_end - p_start + 1)           as prev_s,
           p_start - 1                               as prev_e
    where p_end >= p_start and p_end - p_start <= 366
  ),
  spend as (
    select case when t.occurred_at >= b.s then 0 else 1 end as which,
           (t.occurred_at::date - case when t.occurred_at >= b.s then b.s else b.prev_s end)::int
             as dof,
           sum(t.base_total_amount) as amt
    from public.transactions t
    cross join bounds b
    left join public.accounts da on da.id = t.to_account_id
    where t.user_id = (select auth.uid())
      and (t.type = 'expense' or (t.type = 'payment' and da.type = 'loan'))
      and t.occurred_at >= b.prev_s
      and t.occurred_at <  b.e + 1
    group by 1, 2
  ),
  days as (
    select generate_series(0, (select cur_days from bounds) - 1) as d
  )
  select d.d as day_offset,
         (select coalesce(sum(s.amt), 0) from spend s where s.which = 0 and s.dof <= d.d)
           as this_period,
         (select coalesce(sum(s.amt), 0) from spend s where s.which = 1 and s.dof <= d.d)
           as last_period
  from days d
  order by d.d;
$$;

-- spending_pace(p_month) (20260822143000) is deliberately left as it is and
-- deliberately gets no wrapper here, unlike category_usage, uncategorized_spend
-- and spend_distribution above. Not an omission: the two functions answer
-- different questions and collapsing them would be a real behaviour change,
-- not a tidy-up.
--
-- spending_pace_range compares the requested period against an equal-length
-- window immediately before it (prev_s above is p_start - cur_days), on
-- purpose, so that a 13-16 day quincena is paced against a same-length
-- quincena rather than a month it doesn't fit inside. spending_pace instead
-- compares the calendar month against the true previous calendar month. Those
-- two "previous periods" are the same window only when adjacent months happen
-- to share a length. They differ, for instance, every September: an
-- equal-length lookback from Sep 1 is Aug 2-31, but the previous calendar
-- month is Aug 1-31 — a whole extra day. Wrapping spending_pace over this
-- range function would silently shift the monthly chart's comparison line by
-- that day, for the exact same reason a 366-day guard exists above: dates
-- move in ways a formula can get quietly wrong.
--
-- So the inclusion rule (expense from anywhere, payment only into a loan)
-- exists twice in this migration — once here, once in spending_pace — and
-- that duplication is intentional, not drift to be merged the way
-- category_usage_range's callers were. A caller whose period is exactly a
-- calendar month should keep calling spending_pace; everything else calls
-- spending_pace_range. lib/period/cycle.ts exports isWholeMonth(period) as
-- exactly that predicate, so callers don't have to reimplement it.

-- Cashflow over a range. monthly_cashflow (a view, keyed by month) is left
-- exactly as it is — Insights and Ask both still read it.
create or replace function public.cashflow_range(p_start date, p_end date)
returns table (income numeric, expense numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(case when t.type = 'income' then t.base_amount else 0 end), 0) as income,
         coalesce(sum(case
                   when t.type = 'expense' and a.type not in ('credit_card', 'loan')
                     then t.base_total_amount
                   when t.type = 'payment' and da.type in ('credit_card', 'loan')
                     then t.base_total_amount
                   else 0 end), 0) as expense
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  left join public.accounts da on da.id = t.to_account_id
  where t.user_id = (select auth.uid())
    and t.occurred_at >= p_start
    and t.occurred_at <  p_end + 1
    and p_end >= p_start
    and p_end - p_start <= 366;
$$;
