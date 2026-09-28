-- supabase/migrations/20260928120000_subscriptions_emoji.sql
--
-- A recurring template's emoji, chosen by the person the same way a category's
-- is. The native app marks each template with its emoji on its colour (the
-- category stamp) instead of a logo and colour guessed from the name, so
-- `color` becomes a plain user choice there as well.
--
-- Nullable, no default: an existing template shows its initial until someone
-- picks an emoji. `logo_url` is left as it is for the web app.
alter table public.subscriptions
  add column if not exists emoji text;
