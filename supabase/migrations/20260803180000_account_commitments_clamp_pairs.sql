-- account_commitments must implement the same rule as computeFunding: an
-- (account, goal) pair that has been over-withdrawn consumes NO capacity, it
-- does not consume negative capacity. The original view flat-summed every
-- contribution row, so a net-negative goal silently reduced the capacity
-- available to other goals funded by the same account.
create or replace view public.account_commitments
with (security_invoker = true) as
select a.id      as account_id,
       a.user_id as user_id,
       coalesce(sum(greatest(p.net, 0)), 0) as committed_raw
from public.accounts a
left join (
  select account_id, goal_id, sum(amount) as net
  from public.goal_contributions
  group by account_id, goal_id
) p on p.account_id = a.id
where a.type not in ('credit_card', 'loan')
group by a.id, a.user_id;
