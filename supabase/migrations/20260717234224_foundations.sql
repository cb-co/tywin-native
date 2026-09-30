-- Extensions -------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;

-- Enums ------------------------------------------------------------------
create type public.account_type as enum
  ('checking','savings','cash','investment','asset','credit_card','loan');
create type public.transaction_type as enum ('expense','income','payment');
create type public.billing_cycle as enum ('weekly','monthly','yearly','custom');
create type public.budget_status as enum ('within','approaching','over');
create type public.statement_source as enum ('manual','import');

-- Shared updated_at trigger ---------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles ---------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  base_currency text not null default 'USD' check (char_length(base_currency) = 3),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: owner can insert"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row for each new auth user.
-- SECURITY DEFINER is required to write public.profiles from an auth trigger;
-- search_path is pinned empty and every name is schema-qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
