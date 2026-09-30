-- Card art inference returns a payment network alongside the accent colour, and
-- a standalone credit-card account had nowhere to keep it — the network could
-- only ever be re-guessed from the account name on every render.
--
-- Mirrors card_groups.brand, which already exists and already feeds
-- inferNetwork(name, brand). Free text rather than an enum: it holds whatever
-- the inference reported, and inferNetwork is the one place that decides what
-- counts as a recognised network.
alter table public.accounts
  add column brand text;
