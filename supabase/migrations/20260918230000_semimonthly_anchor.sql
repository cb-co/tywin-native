-- supabase/migrations/20260918230000_semimonthly_anchor.sql
--
-- A semimonthly cycle is no longer fixed at the 1st and the 16th: people are
-- paid on the 5th and the 20th, the 15th and the 30th, and so on. The anchor is
-- now the FIRST payday of the month, 1..15; the second is 15 days later,
-- clamped to the month's last day (lib/period/cycle.ts, semimonthlyStarts).
--
-- Null stays valid and still means the 1st/16th split, so every existing
-- semimonthly profile keeps exactly the period it has today.
alter table public.profiles
  drop constraint profiles_pay_anchor_day_valid;

alter table public.profiles
  add constraint profiles_pay_anchor_day_valid check (
    (pay_cycle = 'semimonthly' and (pay_anchor_day is null or pay_anchor_day between 1 and 15))
    or (pay_cycle = 'monthly' and (pay_anchor_day is null or pay_anchor_day between 1 and 31))
    or (pay_cycle = 'weekly'  and (pay_anchor_day is null or pay_anchor_day between 1 and 7))
  );
