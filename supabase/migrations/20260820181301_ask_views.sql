-- The schema the model reads. Four views that exist because the base tables
-- encode storage, not meaning.
--
-- `transactions` carries four money columns differing by fees, tax, and FX, and
-- puts transfers between a person's own accounts in the same table as real
-- spending. Which column is correct depends on the question, and this codebase
-- already contains two different right answers: `spend_distribution` counts
-- expense+payment minus excluded rows, while `monthly_cashflow` counts what
-- actually left an account (a card expense is borrowed, so it has not).
--
-- Handing a model that column list produces syntactically perfect SQL and a
-- confidently wrong number — the worst failure available, because nothing looks
-- broken. So both rules arrive here precomputed, as columns that say what they
-- mean and that a SUM() cannot get wrong.
--
-- security_invoker throughout: RLS on the base tables scopes every row to the
-- caller, exactly as `monthly_cashflow` does.

create or replace view public.q_transactions
with (security_invoker = true) as
select
  t.id,
  t.user_id,
  t.occurred_at,
  t.type,
  t.description,
  t.notes,
  t.account_id,
  a.name    as account,
  a.type    as account_type,
  a.brand   as account_brand,
  a.last4   as account_last4,
  b.name    as bank,
  t.to_account_id,
  da.name   as to_account,
  da.type   as to_account_type,
  t.category_id,
  c.name    as category,
  t.subscription_id,
  s.name    as subscription,
  t.currency,
  t.amount,
  t.total_amount,
  p.base_currency,
  t.base_amount,
  t.base_total_amount,
  -- Mirrors public.spend_distribution / public.category_usage exactly.
  case
    when t.type in ('expense', 'payment') and not t.exclude_from_budget
      then t.base_total_amount
    else 0
  end as budget_spend,
  -- Mirrors public.monthly_cashflow's `expense` arm exactly.
  case
    when t.type = 'expense' and a.type not in ('credit_card', 'loan')
      then t.base_total_amount
    when t.type = 'payment' and da.type in ('credit_card', 'loan')
      then t.base_total_amount
    else 0
  end as cash_out,
  case when t.type = 'income' then t.base_amount else 0 end as cash_in,
  t.exclude_from_budget,
  t.fx_fallback,
  -- Free merchant-category signal on anything that arrived by statement import.
  sl.mcc
from public.transactions t
join public.accounts a on a.id = t.account_id
left join public.accounts da on da.id = t.to_account_id
left join public.banks b on b.id = a.bank_id
left join public.categories c on c.id = t.category_id
left join public.subscriptions s on s.id = t.subscription_id
left join public.card_statement_lines sl on sl.id = t.statement_line_id
left join public.profiles p on p.id = t.user_id;

-- One row per account with live status folded in, so account questions answer
-- without a second hop. This is also what makes "my Amex Platinum" resolvable:
-- the model matches on name, brand, or last4 and gets an account_id to filter
-- q_transactions by.
create or replace view public.q_accounts
with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.brand,
  a.last4,
  b.name  as bank,
  cg.name as card_group,
  a.currency,
  a.is_archived,
  ab.balance,
  a.starting_balance,
  a.current_balance,
  cs.credit_limit,
  cs.owed,
  cs.utilization_pct,
  cs.latest_statement_balance,
  cs.latest_due_date,
  cs.latest_period_end,
  a.statement_closing_day,
  a.payment_due_day,
  a.interest_rate,
  ls.outstanding_balance,
  ls.installment_amount,
  ls.installments_paid,
  ls.term_months,
  ls.original_term_months,
  ls.principal,
  a.start_date
from public.accounts a
left join public.banks b on b.id = a.bank_id
left join public.card_groups cg on cg.id = a.card_group_id
left join public.account_balances ab on ab.account_id = a.id
left join public.card_status cs on cs.account_id = a.id
left join public.loan_status ls on ls.account_id = a.id;

-- Statement-level facts are read, not re-derived from lines.
create or replace view public.q_card_statements
with (security_invoker = true) as
select
  st.id,
  st.user_id,
  st.account_id,
  a.name as account,
  st.period_start,
  st.period_end,
  st.due_date,
  st.statement_balance,
  st.minimum_payment,
  st.previous_balance,
  st.total_debits,
  st.total_credits,
  st.cashback_total,
  st.interest_rate_annual,
  st.avg_daily_balance,
  st.cost_of_carry,
  st.credit_limit,
  st.available_credit,
  st.overdue_amount,
  st.source
from public.card_statements st
join public.accounts a on a.id = st.account_id;

-- public.category_usage generalised off its p_month-only signature: every
-- month at once, so the model can compare them.
create or replace view public.q_budgets
with (security_invoker = true) as
select
  cb.user_id,
  cb.month,
  cb.category_id,
  c.name as category,
  cb.amount as budget,
  coalesce(u.used, 0) as used,
  cb.amount - coalesce(u.used, 0) as remaining
from public.category_budgets cb
join public.categories c on c.id = cb.category_id
left join lateral (
  select sum(t.base_total_amount) as used
  from public.transactions t
  where t.category_id = cb.category_id
    and t.user_id = cb.user_id
    and t.type in ('expense', 'payment')
    and not t.exclude_from_budget
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', cb.month)::date
) u on true;
