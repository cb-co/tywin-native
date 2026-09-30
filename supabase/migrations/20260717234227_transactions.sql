create table public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  type            public.transaction_type not null,
  account_id      uuid not null references public.accounts (id) on delete cascade,
  to_account_id   uuid references public.accounts (id) on delete set null,
  category_id     uuid references public.categories (id) on delete set null,

  amount          numeric(18,4) not null check (amount >= 0),
  currency        text not null check (char_length(currency) = 3),
  exchange_rate   numeric(18,8) not null default 1 check (exchange_rate > 0),
  base_amount     numeric(18,4) not null default 0,

  include_tax        boolean not null default false,
  include_commission boolean not null default false,
  tax_amount         numeric(18,4) not null default 0,
  fee_amount         numeric(18,4) not null default 0,
  total_amount       numeric(18,4) not null default 0,
  base_total_amount  numeric(18,4) not null default 0,

  budget_only     boolean not null default false,
  description     text,
  occurred_at     timestamptz not null default now(),
  notes           text,
  -- subscription_id FK added in the subscriptions migration
  subscription_id uuid,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Type/account invariants (spec 3.1)
  constraint payment_needs_destination
    check (type <> 'payment' or to_account_id is not null),
  constraint non_payment_has_no_destination
    check (type = 'payment' or to_account_id is null),
  constraint expense_requires_category
    check (type <> 'expense' or category_id is not null),
  constraint income_has_no_category
    check (type <> 'income' or category_id is null),
  constraint no_self_transfer
    check (to_account_id is null or to_account_id <> account_id)
);

create index transactions_user_occurred_idx on public.transactions (user_id, occurred_at);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id);
create index transactions_category_occurred_idx
  on public.transactions (category_id, occurred_at);

-- RLS
alter table public.transactions enable row level security;
create policy "transactions: owner read" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions: owner insert" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions: owner update" on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions: owner delete" on public.transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- Compute tax/fee/total/base from the source account's fee settings and the
-- user-provided exchange rate. tax + fee leave the source account (spec 3.4).
create or replace function public.transactions_compute_amounts()
returns trigger language plpgsql as $$
declare
  src public.accounts%rowtype;
begin
  select * into src from public.accounts where id = new.account_id;

  new.tax_amount := case
    when new.include_tax then round(new.amount * coalesce(src.transfer_tax_rate, 0), 4)
    else 0 end;
  new.fee_amount := case
    when new.include_commission then coalesce(src.network_fee_amount, 0)
    else 0 end;

  new.total_amount      := new.amount + new.tax_amount + new.fee_amount;
  new.base_amount       := round(new.amount * new.exchange_rate, 4);
  new.base_total_amount := round(new.total_amount * new.exchange_rate, 4);
  return new;
end;
$$;

create trigger transactions_compute_amounts
  before insert or update on public.transactions
  for each row execute function public.transactions_compute_amounts();

-- currency and exchange_rate are immutable once saved (spec 9).
create or replace function public.transactions_forbid_money_change()
returns trigger language plpgsql as $$
begin
  if new.currency is distinct from old.currency
     or new.exchange_rate is distinct from old.exchange_rate then
    raise exception 'transactions.currency and exchange_rate are immutable';
  end if;
  return new;
end;
$$;

create trigger transactions_immutable_money before update on public.transactions
  for each row execute function public.transactions_forbid_money_change();

-- Payments to a credit card reduce its reconciled current_balance; reversing on
-- delete/update keeps the maintained figure correct. Card charges are never
-- transactions, so this is the only path that moves current_balance.
create or replace function public.transactions_sync_card_balance()
returns trigger language plpgsql as $$
declare
  is_card boolean;
begin
  if tg_op in ('DELETE','UPDATE') and old.type = 'payment' and old.to_account_id is not null then
    select type = 'credit_card' into is_card from public.accounts where id = old.to_account_id;
    if is_card then
      update public.accounts set current_balance = current_balance + old.amount
      where id = old.to_account_id;  -- undo the prior effect
    end if;
  end if;

  if tg_op in ('INSERT','UPDATE') and new.type = 'payment' and new.to_account_id is not null then
    select type = 'credit_card' into is_card from public.accounts where id = new.to_account_id;
    if is_card then
      update public.accounts set current_balance = current_balance - new.amount
      where id = new.to_account_id;  -- apply the new effect
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger transactions_sync_card_balance
  after insert or update or delete on public.transactions
  for each row execute function public.transactions_sync_card_balance();
