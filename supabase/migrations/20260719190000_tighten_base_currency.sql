-- Tighten the base_currency constraint ------------------------------------
--
-- The old check only enforced a length of 3, so any three characters passed.
-- That value is interpolated into an outbound request URL in lib/fx.ts
-- (`.../latest/${base}`), and it is used to look up exchange rates. The app
-- layer already validates /^[A-Z]{3}$/ in updateBaseCurrency, so this closes
-- the same hole at the source rather than relying on every future call site
-- to remember.

-- Normalize before constraining so the migration cannot fail on a row that
-- only differs by case. Anything still invalid after this will raise loudly
-- rather than being silently rewritten, since guessing a user's currency is
-- worse than stopping.
update public.profiles
set base_currency = upper(base_currency)
where base_currency <> upper(base_currency);

alter table public.profiles
  drop constraint if exists profiles_base_currency_check;

alter table public.profiles
  add constraint profiles_base_currency_check
  check (base_currency ~ '^[A-Z]{3}$');
