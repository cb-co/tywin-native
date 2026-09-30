-- Savings goals: an envelope of money committed from a real account.
--
-- A contribution does not move money in the real world. It marks part of an
-- account's balance as spoken for, so the app can answer "how much can I
-- actually spend?" without requiring a second bank account. Net worth is
-- deliberately unaffected — `account_balances` is not touched here — because
-- committing money to a goal does not make the user poorer.
--
-- Named `savings_goals` rather than `goals` because `accounts` already carries
-- `welcome_bonus_goal_amount` for credit-card sign-up bonuses.

create table public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  emoji         text,
  color         text,
  target_amount numeric(18,4) not null check (target_amount > 0),
  target_date   date,
  sort_order    integer not null default 0,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- `amount` is in the ORIGIN ACCOUNT'S currency, because the commitment has to
-- be deducted from that account in its own units. `base_amount` is the same
-- money in the user's base currency, which is what goal progress sums.
-- A negative `amount` is a withdrawal: it reduces both the goal's progress and
-- the account's commitment by the same arithmetic a positive one increases them.
create table public.goal_contributions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  goal_id       uuid not null references public.savings_goals (id) on delete cascade,
  account_id    uuid not null references public.accounts (id) on delete cascade,
  amount        numeric(18,4) not null check (amount <> 0),
  currency      text not null check (char_length(currency) = 3),
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  base_amount   numeric(18,4) not null default 0,
  occurred_at   timestamptz not null default now(),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index savings_goals_user_id_idx on public.savings_goals (user_id);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id);
create index goal_contributions_account_idx on public.goal_contributions (account_id);

-- RLS: savings_goals
alter table public.savings_goals enable row level security;
create policy "savings_goals: owner read" on public.savings_goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "savings_goals: owner insert" on public.savings_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "savings_goals: owner update" on public.savings_goals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "savings_goals: owner delete" on public.savings_goals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- RLS: goal_contributions
alter table public.goal_contributions enable row level security;
create policy "goal_contributions: owner read" on public.goal_contributions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "goal_contributions: owner insert" on public.goal_contributions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goal_contributions: owner update" on public.goal_contributions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goal_contributions: owner delete" on public.goal_contributions
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger savings_goals_set_updated_at before update on public.savings_goals
  for each row execute function public.set_updated_at();
create trigger goal_contributions_set_updated_at before update on public.goal_contributions
  for each row execute function public.set_updated_at();

-- base_amount is derived, never supplied. Mirrors transactions_compute_amounts.
create or replace function public.goal_contributions_compute_amounts()
returns trigger language plpgsql as $$
begin
  new.base_amount := round(new.amount * new.exchange_rate, 4);
  return new;
end;
$$;

create trigger goal_contributions_compute_amounts
  before insert or update on public.goal_contributions
  for each row execute function public.goal_contributions_compute_amounts();

-- A contribution can never drift from the account it deducts from: its currency
-- is the account's, and the account must be one that can hold savings. Credit
-- cards and loans are debts — "saving onto a credit card" is not a coherent act,
-- and neither appears in `account_balances`, so a commitment against one could
-- never be clamped.
create or replace function public.goal_contributions_pin_account()
returns trigger language plpgsql as $$
declare
  acct public.accounts%rowtype;
begin
  select * into acct from public.accounts where id = new.account_id;
  if not found then
    raise exception 'goal_contributions.account_id % not found', new.account_id;
  end if;
  if acct.type in ('credit_card', 'loan') then
    raise exception 'goal contributions cannot come from a % account', acct.type;
  end if;
  new.currency := acct.currency;
  return new;
end;
$$;

create trigger goal_contributions_pin_account
  before insert or update on public.goal_contributions
  for each row execute function public.goal_contributions_pin_account();

-- Raw commitment per account, before the clamp.
--
-- The clamp itself (`min(max(raw,0), max(balance,0))`) lives in TypeScript
-- rather than here, so the same arithmetic that computes it also allocates it
-- across goals and can be unit-tested — the same reasoning that dropped the SQL
-- net-worth view in 20260728120000.
--
-- The `not in ('credit_card','loan')` filter matches `account_balances`, which
-- excludes both (loans since 20260719124500_fix_account_balances_exclude_loans),
-- so the two join one-to-one with no missing rows.
create view public.account_commitments
with (security_invoker = true) as
select a.id      as account_id,
       a.user_id as user_id,
       coalesce(sum(gc.amount), 0) as committed_raw
from public.accounts a
left join public.goal_contributions gc on gc.account_id = a.id
where a.type not in ('credit_card', 'loan')
group by a.id, a.user_id;
