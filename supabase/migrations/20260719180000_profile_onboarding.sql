-- Onboarding completion -------------------------------------------------
--
-- Tracked explicitly rather than inferred from "has no accounts". A user who
-- archives or deletes every account is not a new user, and inferring would
-- trap them back in the welcome flow. Existing users are backfilled as done
-- so nobody who is already set up gets sent through it.

alter table public.profiles
  add column onboarded_at timestamptz;

update public.profiles
set onboarded_at = coalesce(created_at, now())
where onboarded_at is null;

comment on column public.profiles.onboarded_at is
  'When the welcome flow was completed. Null means the user has not finished onboarding and is redirected to /welcome.';
