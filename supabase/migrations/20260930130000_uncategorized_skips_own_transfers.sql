-- supabase/migrations/20260930130000_uncategorized_skips_own_transfers.sql
--
-- "Uncategorized" on Budgets stops counting money moved between your own
-- accounts.
--
-- uncategorized_spend_range counted every null-category expense or payment,
-- so a card payment or a move from one savings account to another showed up
-- as spending waiting for a category. Neither is spending: the purchases
-- behind a card payment are counted on their own, and a transfer only moves
-- money. The help guide already says so ("Card payments and transfers between
-- your own accounts never count as spending").
--
-- A payment now counts only when it leaves the user's accounts (no
-- to_account_id) or retires a loan, the same accrual rule
-- spend_distribution_range applies. Expenses are unchanged. Categorized rows
-- are not touched here: category_usage_range keeps counting a payment someone
-- chose to put in a category.
create or replace function public.uncategorized_spend_range(p_start date, p_end date)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(t.base_total_amount), 0)
  from public.transactions t
  left join public.accounts da on da.id = t.to_account_id
  where t.user_id = (select auth.uid())
    and t.category_id is null
    and (t.type = 'expense'
         or (t.type = 'payment' and (t.to_account_id is null or da.type = 'loan')))
    and not t.exclude_from_budget
    and t.occurred_at >= p_start
    and t.occurred_at <  p_end + 1
    and p_end >= p_start
    and p_end - p_start <= 366;
$$;
