-- The Insights donut and spending-pace chart move to an accrual basis: count
-- the charge, not the settlement.
--
-- Both functions previously used category_usage's inclusion rule
-- (20260731150000_spend_distribution_payments.sql) — type in ('expense',
-- 'payment') and not exclude_from_budget. That rule is right for the budget
-- surfaces and wrong for these two, for two separate reasons:
--
--   1. It counted every `payment`, including transfers between two of the
--      user's own non-liability accounts. Moving money from checking to
--      savings is not spending, but it landed in the donut (as an
--      uncategorized slice) and inflated the pace line. On one real August
--      this was $4,823.50 of a reported $8,292.51.
--
--   2. It excluded card expenses, because `exclude_from_budget` is set
--      automatically on every one of them (see the statement-import default
--      and components/transactions/transaction-form.tsx). That flag encodes a
--      deliberate cash-basis convention for the budget — a card charge hasn't
--      left an account yet, so the budget counts the statement payment
--      instead. Correct there; but it meant "where did my money go this
--      month" was answered entirely by card settlements, with the actual
--      purchases invisible.
--
-- The new rule counts an expense when it happens, from whatever account, and
-- counts a payment only when it retires a loan. Card payments are dropped
-- because the underlying charges are now counted directly and counting both
-- would double-count. Loan payments stay: unlike a card, a loan's principal
-- was never recorded as an expense, so the payment is the only place that
-- spend is visible.
--
-- `exclude_from_budget` is deliberately NOT consulted here. It stays exactly
-- what it is on the budget surfaces (category_usage, uncategorized_spend, and
-- the Expenses-vs-Budget bars, all unchanged by this migration) — the flag now
-- means "keep this out of the budget", not "this never happened".

create or replace function public.spend_distribution(p_month date)
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
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', p_month)::date
  group by t.category_id
  order by total desc;
$$;

-- Cumulative spend by day-of-month, this month against last — the whole
-- spending-pace chart, in one round trip.
--
-- This was assembled in TypeScript (lib/insights/queries.ts) from a PostgREST
-- select over the raw transactions. Moving it into SQL is not just tidying;
-- the client-side version had three problems this fixes:
--
--   * It could not filter on the *destination* account's type, which the
--     loan-payment leg above requires. PostgREST filters the selected table,
--     not a joined one.
--   * It fetched rows with no `.range()` paging, so it silently truncated at
--     PostgREST's max_rows (1000, see supabase/config.toml) with no error —
--     just a pace line that stopped being true.
--   * It bucketed days with `new Date(occurred_at).getDate()`, in the server's
--     local timezone, while spend_distribution bucketed with date_trunc in the
--     database's. The two charts sit side by side on the same page and could
--     disagree about which month a late-night charge belonged to. They now
--     bucket identically because it is the same expression.
--
-- Returns 31 rows always. `this_month`/`last_month` are null past the number
-- of days in their respective month, which is what tells the chart to stop
-- drawing that line rather than flattening it to zero.
create or replace function public.spending_pace(p_month date)
returns table (day integer, this_month numeric, last_month numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (
    select date_trunc('month', p_month)::date as cur,
           (date_trunc('month', p_month) - interval '1 month')::date as prev,
           extract(day from (date_trunc('month', p_month)
             + interval '1 month' - interval '1 day'))::int as cur_days,
           extract(day from (date_trunc('month', p_month)
             - interval '1 day'))::int as prev_days
  ),
  spend as (
    select date_trunc('month', t.occurred_at)::date as mon,
           extract(day from t.occurred_at)::int as dom,
           sum(t.base_total_amount) as amt
    from public.transactions t
    left join public.accounts da on da.id = t.to_account_id
    cross join b
    where t.user_id = (select auth.uid())
      and (t.type = 'expense' or (t.type = 'payment' and da.type = 'loan'))
      and date_trunc('month', t.occurred_at)::date in (b.cur, b.prev)
    group by 1, 2
  ),
  per_day as (
    select d.day,
           b.cur_days,
           b.prev_days,
           coalesce((select s.amt from spend s where s.mon = b.cur  and s.dom = d.day), 0) as cur_amt,
           coalesce((select s.amt from spend s where s.mon = b.prev and s.dom = d.day), 0) as prev_amt
    from generate_series(1, 31) as d(day)
    cross join b
  )
  select p.day,
         case when p.day <= p.cur_days
           then round(sum(p.cur_amt)  over (order by p.day), 2) end as this_month,
         case when p.day <= p.prev_days
           then round(sum(p.prev_amt) over (order by p.day), 2) end as last_month
  from per_day p
  order by p.day;
$$;
