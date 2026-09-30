-- Two dimensions where there was one.
--
-- `categories` has been doing two unrelated jobs off a single column. It is the
-- QUALIFIER — what a transaction actually is, Groceries or Fuel or Rent — and it
-- is also the BUDGET GROUPING, the handful of buckets a person actually plans
-- against. Those are not the same shape and never were: a qualifier wants to be
-- specific and there are dozens of them, a budget grouping wants to be coarse
-- and there are five. Forcing both through `category_id` means every category
-- name is a compromise between the two, and any reader — a person, a report, or
-- the model behind /ask — has to guess which job a given row is doing.
--
-- So the grouping moves out. `categories` keeps the qualifier job it was always
-- good at, and `budget_groups` takes the planning job it was bad at.
--
-- Every part of this is ADDITIVE. Two new tables, two nullable columns, two new
-- views, and two columns appended to the end of q_transactions. Nothing is
-- dropped, nothing is renamed, no existing column changes type or nullability,
-- and `category_budgets` is untouched — the old budget system keeps working
-- exactly as it does today for everyone who has not opted into the new one. A
-- row with no group behaves precisely as it did before this migration existed.

create table public.budget_groups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  emoji      text,
  color      text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

-- What a person plans against, per month. A sibling of category_budgets rather
-- than a nullable column bolted onto it: category_budgets.category_id is `not
-- null` today, and relaxing that to make room here would be the one genuinely
-- destructive edit available in this file.
create table public.budget_group_budgets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  budget_group_id uuid not null references public.budget_groups (id) on delete cascade,
  month           date not null check (month = date_trunc('month', month::timestamp)::date),
  amount          numeric(18,4) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (budget_group_id, month)
);

-- The default rollup: which bucket this kind of spending normally belongs to.
alter table public.categories
  add column budget_group_id uuid references public.budget_groups (id) on delete set null;

-- The per-transaction override, and the reason this is two columns rather than
-- one. A category maps to exactly one group, which is what keeps a budget from
-- double-counting — but "this particular Uber was a night out, not commuting"
-- is a real thing a person needs to say, and a strict category→group tree cannot
-- say it. The override says it without disturbing the qualifier: the row stays
-- Transport for reporting and counts under Fun for budgeting.
--
-- `on delete set null` on both, so removing a group can never remove a
-- transaction or a category.
alter table public.transactions
  add column budget_group_id uuid references public.budget_groups (id) on delete set null;

create index budget_groups_user_id_idx on public.budget_groups (user_id);
create index budget_group_budgets_user_month_idx on public.budget_group_budgets (user_id, month);
create index categories_budget_group_idx on public.categories (budget_group_id);
create index transactions_budget_group_idx on public.transactions (budget_group_id);

-- RLS: budget_groups
alter table public.budget_groups enable row level security;
create policy "budget_groups: owner read" on public.budget_groups
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "budget_groups: owner insert" on public.budget_groups
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "budget_groups: owner update" on public.budget_groups
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "budget_groups: owner delete" on public.budget_groups
  for delete to authenticated using ((select auth.uid()) = user_id);

-- RLS: budget_group_budgets
alter table public.budget_group_budgets enable row level security;
create policy "budget_group_budgets: owner read" on public.budget_group_budgets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "budget_group_budgets: owner insert" on public.budget_group_budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "budget_group_budgets: owner update" on public.budget_group_budgets
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "budget_group_budgets: owner delete" on public.budget_group_budgets
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger budget_groups_set_updated_at before update on public.budget_groups
  for each row execute function public.set_updated_at();
create trigger budget_group_budgets_set_updated_at before update on public.budget_group_budgets
  for each row execute function public.set_updated_at();

-- The effective group for one transaction: its own override, else the group its
-- category rolls up to, else nothing.
--
-- Single-valued by construction, which is the property the whole design turns
-- on. A transaction that could land in two groups would be counted twice by any
-- budget built on this, and a budget that overcounts is worse than no budget.
create or replace function public.effective_budget_group(
  p_transaction_group uuid,
  p_category_group uuid
)
returns uuid
language sql
immutable
set search_path = ''
as $$ select coalesce(p_transaction_group, p_category_group) $$;

-- q_transactions gains the two columns the model needs to tell the dimensions
-- apart. Appended at the END of the select list, which is the only shape
-- `create or replace view` accepts — every existing column keeps its name,
-- type and position, so nothing reading this view can notice the change.
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
  case
    when t.type in ('expense', 'payment') and not t.exclude_from_budget
      then t.base_total_amount
    else 0
  end as budget_spend,
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
  sl.mcc,
  public.effective_budget_group(t.budget_group_id, c.budget_group_id) as budget_group_id,
  bg.name as budget_group
from public.transactions t
join public.accounts a on a.id = t.account_id
left join public.accounts da on da.id = t.to_account_id
left join public.banks b on b.id = a.bank_id
left join public.categories c on c.id = t.category_id
left join public.subscriptions s on s.id = t.subscription_id
left join public.card_statement_lines sl on sl.id = t.statement_line_id
left join public.profiles p on p.id = t.user_id
left join public.budget_groups bg
  on bg.id = public.effective_budget_group(t.budget_group_id, c.budget_group_id);

-- The planning dimension, shaped exactly like q_budgets so that the two read the
-- same way and neither can be mistaken for the other's answer.
--
-- One row per month per BUDGETED group. A group with no budget for a month has
-- no row here, same as q_budgets — spending per group regardless of budget is a
-- GROUP BY on q_transactions.budget_group, not a question for this view.
create or replace view public.q_budget_groups
with (security_invoker = true) as
select
  gb.user_id,
  gb.month,
  gb.budget_group_id,
  g.name as budget_group,
  gb.amount as budget,
  coalesce(u.used, 0) as used,
  gb.amount - coalesce(u.used, 0) as remaining
from public.budget_group_budgets gb
join public.budget_groups g on g.id = gb.budget_group_id
left join lateral (
  -- The same spend rule as q_budgets and public.category_usage: expenses and
  -- card payments, minus anything flagged out. Only the grouping differs.
  select sum(t.base_total_amount) as used
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.user_id = gb.user_id
    and public.effective_budget_group(t.budget_group_id, c.budget_group_id) = gb.budget_group_id
    and t.type in ('expense', 'payment')
    and not t.exclude_from_budget
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', gb.month)::date
) u on true;
