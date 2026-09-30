-- Default new profiles to DOP -----------------------------------------------
--
-- The column has defaulted to 'USD' since the foundations migration, which
-- makes a Dominican user's first net-worth figure read in the wrong currency
-- until they find Settings. This is a DR-first product; the default should be
-- the currency the overwhelming majority of its users are paid in, with USD
-- one step away in the currency picker for the minority who want it.
--
-- Existing rows are deliberately left alone. A profile's base currency is a
-- choice the user made (or accepted), and every stored transaction carries an
-- exchange_rate derived against the base currency in force when it was
-- inserted — rewriting the base under those rows would leave every historical
-- figure converted against a currency it was never denominated in.
--
-- Keep in step with DEFAULT_BASE_CURRENCY in lib/profile.ts, which is the
-- read-side fallback for the same value.

alter table public.profiles
  alter column base_currency set default 'DOP';
