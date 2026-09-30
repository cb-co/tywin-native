-- A subscription's brand colour, inferred from its name the same way card art is
-- (see 20260804150000_accounts_brand.sql and lib/accounts/llm/card-art.ts).
--
-- People name subscriptions after the real product — "Netflix", "Spotify",
-- "Adobe Creative Cloud" — which is enough for a model to recognise the service
-- and report its brand colour. Stored rather than re-guessed on render, because
-- inference is a network call and the answer never changes for a given name.
--
-- Free text, nullable, no default: a subscription whose name the model could not
-- place stays null and the UI falls back to the theme's neutral accent token,
-- which is the one fallback that stays correct in both light and dark. A fixed
-- default hex here would have to pick a side.
alter table public.subscriptions
  add column color text;
