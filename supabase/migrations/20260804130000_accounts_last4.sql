-- Standalone credit cards can only show their digits by inferring them from the
-- account name today. This gives them somewhere to be stored explicitly.
--
-- Mirrors the constraint card_groups.last4 already carries
-- (20260717234225_accounts.sql) exactly, so the two columns validate
-- identically. Nullable with no default and no backfill: a card without stored
-- digits keeps falling back to name inference, which is the existing behaviour.
alter table public.accounts
  add column last4 text check (last4 is null or last4 ~ '^[0-9]{4}$');
