create table public.card_statements (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  account_id        uuid not null references public.accounts (id) on delete cascade,
  period_start      date not null,
  period_end        date not null,
  statement_balance numeric(18,4) not null default 0,
  total_balance     numeric(18,4) not null default 0,
  total_debits      numeric(18,4) not null default 0,
  total_credits     numeric(18,4) not null default 0,
  due_date          date,
  source            public.statement_source not null default 'manual',
  file_url          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (period_end >= period_start)
);

create index card_statements_account_period_idx
  on public.card_statements (account_id, period_end desc);

alter table public.card_statements enable row level security;
create policy "card_statements: owner read" on public.card_statements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_statements: owner insert" on public.card_statements
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "card_statements: owner update" on public.card_statements
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "card_statements: owner delete" on public.card_statements
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger card_statements_set_updated_at before update on public.card_statements
  for each row execute function public.set_updated_at();
