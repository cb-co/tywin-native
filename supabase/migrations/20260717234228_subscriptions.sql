create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  brand         text,
  logo_url      text,
  amount        numeric(18,4) not null default 0,
  currency      text not null check (char_length(currency) = 3),
  billing_cycle public.billing_cycle not null default 'monthly',
  anchor_day    smallint check (anchor_day between 1 and 31),
  account_id    uuid references public.accounts (id) on delete set null,
  category_id   uuid references public.categories (id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;
create policy "subscriptions: owner read" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "subscriptions: owner insert" on public.subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "subscriptions: owner update" on public.subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "subscriptions: owner delete" on public.subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Now that subscriptions exists, wire up the deferred FK from transactions.
alter table public.transactions
  add constraint transactions_subscription_id_fkey
  foreign key (subscription_id) references public.subscriptions (id) on delete set null;
