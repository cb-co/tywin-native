-- The last few recommendations a person was shown, newest first, as
-- [{"headline": ..., "body": ...}]. Sent back to the model so the next one
-- says something else. Capped at five by the application, which is the only
-- writer; the check only guarantees the shape stays an array.
alter table public.daily_recommendations
  add column recent jsonb not null default '[]'::jsonb
  check (jsonb_typeof(recent) = 'array');
