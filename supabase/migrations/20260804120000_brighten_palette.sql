-- Brighten the stored identity palette for the app redesign.
--
-- Category and account colours are stored as literal hex on the row (see
-- lib/palette.ts) so they survive a theme switch. The redesign raises those
-- colours from a 5% background wash to a full-strength tile fill, and the
-- original sixteen were chosen for the opposite job — they were tuned as chip
-- *foregrounds* and read muted when used as fills.
--
-- Each replacement is hue-matched to the value it replaces, so a user's
-- existing category keeps its identity and only gains saturation.
--
-- Every new value was validated for both of its jobs:
--   * tile fill behind a white glyph  -> >= 3:1 against #ffffff
--   * chip foreground                 -> >= 3:1 against the light card
--                                        (#ffffff) and the dark card (#16161f)
-- The tightest are amber and olive at 3.05:1 against white; the rest have more
-- headroom. Note this clears 3:1, which covers large text, glyphs and icons —
-- it is NOT sufficient for small body text on top of a tile.
--
-- Only exact matches to the old palette are rewritten. Any colour a user picked
-- outside those sixteen is left untouched.

create temporary table palette_map (old text primary key, new text) on commit drop;

insert into palette_map (old, new) values
  ('#3e5fad', '#4361F0'),  -- blue
  ('#b6770b', '#CE830A'),  -- amber
  ('#008f7d', '#00A08A'),  -- teal
  ('#be563d', '#E85B3F'),  -- vermilion
  ('#8949a3', '#9B4FBC'),  -- purple
  ('#7e903e', '#899C39'),  -- olive
  ('#1b8abd', '#1A96CE'),  -- cyan
  ('#c4486d', '#DB4A76'),  -- pink
  ('#b56e3a', '#CE7A38'),  -- orange
  ('#89812c', '#98912B'),  -- lime
  ('#45902e', '#4AA331'),  -- green
  ('#2f914e', '#309E54'),  -- emerald
  ('#8471d1', '#8471E8'),  -- indigo
  ('#c752b0', '#C752B0'),  -- magenta (unchanged; already in band)
  ('#cb5c62', '#E0666C'),  -- coral
  ('#867e72', '#8A8698');  -- neutral (re-tinted cool to match the new base)

-- lower() on the stored value because nothing constrains its case; the map
-- keys are lowercase and the replacements are written uppercase, which also
-- makes a re-run of this migration a no-op rather than a second rewrite.
update public.categories c
   set color = m.new,
       updated_at = now()
  from palette_map m
 where lower(c.color) = m.old
   and c.color <> m.new;

update public.accounts a
   set color = m.new,
       updated_at = now()
  from palette_map m
 where lower(a.color) = m.old
   and a.color <> m.new;
