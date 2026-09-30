-- Card groups ------------------------------------------------------------
create table public.card_groups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  brand      text,
  last4      text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  art_color  text,
  art_url    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Accounts ---------------------------------------------------------------
create table public.accounts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  name                 text not null,
  type                 public.account_type not null,
  currency             text not null check (char_length(currency) = 3),
  starting_balance     numeric(18,4) not null default 0,
  icon                 text,
  color                text,
  logo_url             text,
  is_archived          boolean not null default false,
  sort_order           integer not null default 0,

  -- Fee settings (all types)
  transfer_tax_rate    numeric(18,8) not null default 0.0020,
  network_fee_amount   numeric(18,4) not null default 0,
  network_fee_optional boolean not null default true,

  -- Credit-card fields
  credit_limit          numeric(18,4),
  statement_closing_day smallint check (statement_closing_day between 1 and 31),
  payment_due_day       smallint check (payment_due_day between 1 and 31),
  card_group_id         uuid references public.card_groups (id) on delete set null,
  current_balance       numeric(18,4) not null default 0,

  -- Loan fields
  principal            numeric(18,4),
  interest_rate        numeric(18,8),
  term_months          integer,
  start_date           date,
  installment_amount   numeric(18,4),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts (user_id);
create index accounts_card_group_id_idx on public.accounts (card_group_id);

-- RLS: card_groups
alter table public.card_groups enable row level security;

create policy "card_groups: owner read" on public.card_groups
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_groups: owner insert" on public.card_groups
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "card_groups: owner update" on public.card_groups
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "card_groups: owner delete" on public.card_groups
  for delete to authenticated using ((select auth.uid()) = user_id);

-- RLS: accounts
alter table public.accounts enable row level security;

create policy "accounts: owner read" on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "accounts: owner insert" on public.accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "accounts: owner update" on public.accounts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "accounts: owner delete" on public.accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- updated_at triggers
create trigger card_groups_set_updated_at before update on public.card_groups
  for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

-- Currency is immutable once the account exists.
create or replace function public.accounts_forbid_currency_change()
returns trigger language plpgsql as $$
begin
  if new.currency is distinct from old.currency then
    raise exception 'accounts.currency is immutable';
  end if;
  return new;
end;
$$;

create trigger accounts_currency_immutable before update on public.accounts
  for each row execute function public.accounts_forbid_currency_change();
