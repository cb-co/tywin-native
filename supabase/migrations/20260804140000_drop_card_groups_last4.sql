-- A card group has no digits of its own. It is an arrangement of currency lines
-- of ONE physical card, so every line already reports the same four digits, and
-- the group's copy was a second place to store them with no UI to edit it — it
-- could only ever be stale or empty. The face now reads the digits off the first
-- line that has them (see components/accounts/card-group-tile.tsx).
--
-- Safe to drop: nothing has ever written this column. createCardGroup inserted
-- only name and user_id from the day the table was created, so every row holds
-- null.
alter table public.card_groups
  drop column if exists last4;
