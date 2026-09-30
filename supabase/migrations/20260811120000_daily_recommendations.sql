-- One live recommendation per user: a short piece of coaching generated from
-- their own numbers, refreshed at most twice a day.
--
-- `user_id` is the PRIMARY KEY rather than a surrogate id with a unique index,
-- because a second row for the same user has no meaning. Nothing reads the
-- previous recommendation once a new one lands, so there is no history here and
-- no `created_at` distinct from `generated_at`.

create table public.daily_recommendations (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  headline     text not null,
  body         text not null,
  tone         text not null check (tone in ('good', 'watch', 'neutral')),
  -- The locale the text was WRITTEN in. Read side treats a mismatch against the
  -- current locale as staleness, so switching language does not leave someone
  -- reading the other language for the rest of the 12h window.
  locale       text not null,
  generated_at timestamptz not null default now()
);

alter table public.daily_recommendations enable row level security;
create policy "daily_recommendations: owner read" on public.daily_recommendations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_recommendations: owner insert" on public.daily_recommendations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "daily_recommendations: owner update" on public.daily_recommendations
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily_recommendations: owner delete" on public.daily_recommendations
  for delete to authenticated using ((select auth.uid()) = user_id);
