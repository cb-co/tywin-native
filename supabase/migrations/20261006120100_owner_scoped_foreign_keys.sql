-- Every reference between two user-owned rows must stay inside one person.
--
-- The foreign keys were single-column (`transactions.account_id -> accounts.id`),
-- and a foreign key check does not go through RLS. So someone who learned
-- another person's account id could point their own rows at it. RLS still kept
-- every read and write of the other person's data out of reach, so nothing
-- leaked, but the database accepted a link that should never exist.
--
-- Each such key becomes composite, `(col, user_id) -> (id, user_id)`, so the
-- engine refuses it outright. `on delete set null` becomes
-- `set null (col)` (Postgres 15+) so the delete clears the link and keeps the
-- row's owner. If this migration fails on a constraint, the data already holds
-- a cross-user link: find it before retrying.
--
-- Generated from the catalog rather than listed by hand, so a key added since
-- the last time someone counted is not missed. Only keys where both tables are
-- in `public`, both carry `user_id`, and the key is one column referencing `id`.

do $$
declare
  fk record;
  v_action text;
  v_unique text;
begin
  for fk in
    select
      c.conname,
      src.relname as src_table,
      dst.relname as dst_table,
      a.attname   as src_col,
      c.confdeltype
    from pg_constraint c
    join pg_class src on src.oid = c.conrelid
    join pg_namespace ns on ns.oid = src.relnamespace and ns.nspname = 'public'
    join pg_class dst on dst.oid = c.confrelid
    join pg_namespace nd on nd.oid = dst.relnamespace and nd.nspname = 'public'
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_attribute ra on ra.attrelid = c.confrelid and ra.attnum = c.confkey[1]
    where c.contype = 'f'
      and array_length(c.conkey, 1) = 1
      and ra.attname = 'id'
      and exists (select 1 from pg_attribute x where x.attrelid = src.oid and x.attname = 'user_id' and not x.attisdropped)
      and exists (select 1 from pg_attribute x where x.attrelid = dst.oid and x.attname = 'user_id' and not x.attisdropped)
    order by src.relname, a.attname
  loop
    v_unique := fk.dst_table || '_id_user_id_key';
    if not exists (select 1 from pg_constraint where conname = v_unique and conrelid = format('public.%I', fk.dst_table)::regclass) then
      execute format('alter table public.%I add constraint %I unique (id, user_id)', fk.dst_table, v_unique);
    end if;

    v_action := case fk.confdeltype
      when 'c' then 'on delete cascade'
      when 'n' then format('on delete set null (%I)', fk.src_col)
      when 'r' then 'on delete restrict'
      else 'on delete no action'
    end;

    execute format('alter table public.%I drop constraint %I', fk.src_table, fk.conname);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I, user_id) references public.%I (id, user_id) %s',
      fk.src_table, fk.conname, fk.src_col, fk.dst_table, v_action
    );
  end loop;
end;
$$;
