-- Overview's "Upcoming" showed a card payment that had already been paid.
--
-- Loans and subscriptions derive their next date from a recurring day anchor
-- (lib/subscriptions/cycle.ts), so they roll forward on their own the moment
-- the day passes. A card row instead reads `latest_due_date` — an absolute
-- date copied off the newest statement — and `latest_statement_balance`, the
-- amount owed as of that statement's closing date. Neither moves when you pay
-- the card, so the row sat at a due date weeks in the past showing the full
-- statement figure until the *next* statement was imported.
--
-- The fix (lib/overview/queries.ts) nets payments made against the statement
-- off its balance, hiding the row once it is settled. To do that it needs to
-- know which payments belong to the statement, and a payment settles a
-- statement when it lands after that statement closed — charges after the
-- closing date roll into the next cycle, and so do the payments. Expose the
-- closing date the lateral join already picks.
--
-- Column is appended, so `create or replace view` accepts it (Postgres allows
-- adding at the end, never reordering or renaming).

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
       s.period_end        as latest_period_end
from public.accounts a
left join lateral (
  select statement_balance, due_date, period_end
  from public.card_statements cs
  where cs.account_id = a.id
  order by cs.period_end desc
  limit 1
) s on true
where a.type = 'credit_card';

comment on view public.card_status is
  'Credit cards with their newest statement (by period_end). latest_period_end '
  'is that statement''s closing date: payments occurring after it settle the '
  'statement, payments before it are already reflected in its balance.';
