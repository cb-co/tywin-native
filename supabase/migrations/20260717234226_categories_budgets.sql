create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  emoji      text,
  icon       text,
  color      text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.category_budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  month       date not null check (month = date_trunc('month', month::timestamp)::date),
  amount      numeric(18,4) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (category_id, month)
);

create index categories_user_id_idx on public.categories (user_id);
create index category_budgets_user_month_idx on public.category_budgets (user_id, month);

-- RLS: categories
alter table public.categories enable row level security;
create policy "categories: owner read" on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories: owner insert" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories: owner update" on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories: owner delete" on public.categories
  for delete to authenticated using ((select auth.uid()) = user_id);

-- RLS: category_budgets
alter table public.category_budgets enable row level security;
create policy "category_budgets: owner read" on public.category_budgets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "category_budgets: owner insert" on public.category_budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "category_budgets: owner update" on public.category_budgets
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "category_budgets: owner delete" on public.category_budgets
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger category_budgets_set_updated_at before update on public.category_budgets
  for each row execute function public.set_updated_at();
