-- Net worth was counting each loan twice, once positively.
--
-- `account_balances` was defined with `where a.type <> 'credit_card'`, which
-- (unlike its name suggests) included loan accounts. A loan's `net_amount` /
-- `net_base_amount` there rose by every payment (`to_account_id = a.id` adds
-- +t.amount, treating a debt paydown as a cash inflow), while `loan_status`
-- separately and correctly reduces `outstanding_balance` by that same
-- payment. The two nearly cancel out — so almost none of the loan's actual
-- debt (its principal) ever became a negative in net_worth. A large paid-down
-- car loan or mortgage could make net worth look healthy while cash on hand
-- was small — exactly the mismatch reported.
--
-- Fix: loans, like credit cards, are represented solely by their *_status
-- view (loan_status.outstanding_balance), not also folded into
-- account_balances.
create or replace view public.account_balances
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
  where a.type not in ('credit_card', 'loan')
  group by a.id, a.user_id, a.currency, a.starting_balance
)
select account_id, user_id, currency,
       starting_balance,
       starting_balance + net_amount as balance,   -- own currency
       net_base_amount               as base_movement
from movements;
