-- Plans: Free and Cigua Pro.
--
--   entitlements    who is on Pro, and until when. Absent row = Free. Nothing a
--                   person can write: only the service role (a store webhook,
--                   later) or someone in the SQL editor changes it.
--   plan_limits     the numbers. Rows with no `period` cap how many of a thing
--                   a person may have; rows with a `period` are usage quotas
--                   (per day or per month) on the features that call a paid
--                   AI model. `max_count` null means unlimited. Change a limit
--                   with an UPDATE: no deploy, no migration.
--   usage_counters  quota use, one row per person, feature and period.
--
-- Limits are enforced HERE, in triggers, because the publishable key lets any
-- signed-in person insert through the Data API directly; a check in the Worker
-- alone would be advisory. Rows a person already had before a limit applied
-- are kept: a limit only refuses a new one.
--
-- A refusal raises SQLSTATE 'CGLIM' with the feature in HINT and the limit in
-- DETAIL, which the Worker turns into an "upgrade to Cigua Pro" message.

create table public.entitlements (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  plan       text not null default 'free' check (plan in ('free', 'pro')),
  -- Where the plan came from, for when a store webhook starts writing it.
  source     text not null default 'manual'
             check (source in ('manual', 'promo', 'app_store', 'play_store')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;
create policy "entitlements: owner read" on public.entitlements
  for select to authenticated using ((select auth.uid()) = user_id);
-- No insert/update/delete policies: a person cannot grant themselves a plan.

create trigger entitlements_set_updated_at before update on public.entitlements
  for each row execute function public.set_updated_at();

create table public.plan_limits (
  plan      text not null check (plan in ('free', 'pro')),
  feature   text not null,
  max_count integer check (max_count is null or max_count >= 0),
  period    text check (period in ('day', 'month')),
  primary key (plan, feature)
);

alter table public.plan_limits enable row level security;
create policy "plan_limits: readable by authenticated" on public.plan_limits
  for select to authenticated using (true);

insert into public.plan_limits (plan, feature, max_count, period) values
  -- What a person may have. Credit cards count physical cards: a card's USD
  -- and installment lines are one card. Archived accounts do not count.
  ('free', 'accounts',       3,    null),
  ('free', 'credit_cards',   2,    null),
  ('free', 'loans',          1,    null),
  ('free', 'goals',          2,    null),
  ('free', 'subscriptions',  10,   null),
  ('pro',  'accounts',       null, null),
  ('pro',  'credit_cards',   null, null),
  ('pro',  'loans',          null, null),
  ('pro',  'goals',          null, null),
  ('pro',  'subscriptions',  null, null),
  -- AI quotas. Pro is generous but never unlimited: every one of these is a
  -- paid model call on the project's key.
  ('free', 'ask',             5,   'day'),
  ('free', 'statement_parse', 6,   'month'),
  ('free', 'recommendation',  2,   'day'),
  ('free', 'card_art',        10,  'day'),
  ('pro',  'ask',             100, 'day'),
  ('pro',  'statement_parse', 60,  'month'),
  ('pro',  'recommendation',  4,   'day'),
  ('pro',  'card_art',        50,  'day');

create table public.usage_counters (
  user_id      uuid not null references auth.users (id) on delete cascade,
  feature      text not null,
  period_start date not null,
  used         integer not null default 0,
  primary key (user_id, feature, period_start)
);

alter table public.usage_counters enable row level security;
create policy "usage_counters: owner read" on public.usage_counters
  for select to authenticated using ((select auth.uid()) = user_id);
-- Written only by consume_quota (security definer).

-- The caller's plan right now.
create or replace function public.current_plan()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select e.plan from public.entitlements e
      where e.user_id = (select auth.uid())
        and (e.expires_at is null or e.expires_at > now())),
    'free'
  );
$$;

revoke all on function public.current_plan() from public, anon;
grant execute on function public.current_plan() to authenticated;

-- The caller's limit for one feature; null = unlimited (or not configured).
create or replace function private.plan_limit(p_feature text)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select l.max_count from public.plan_limits l
  where l.plan = public.current_plan() and l.feature = p_feature;
$$;

revoke all on function private.plan_limit(text) from public, anon;
grant execute on function private.plan_limit(text) to authenticated;

-- Quota periods follow the Dominican calendar, where the people using this live.
create or replace function private.period_start(p_period text)
returns date
language sql
stable
set search_path = ''
as $$
  select case p_period
    when 'month' then date_trunc('month', now() at time zone 'America/Santo_Domingo')::date
    else (now() at time zone 'America/Santo_Domingo')::date
  end;
$$;

revoke all on function private.period_start(text) from public, anon;
grant execute on function private.period_start(text) to authenticated;

create or replace function private.raise_plan_limit(p_feature text, p_limit integer)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'plan_limit'
    using errcode = 'CGLIM', hint = p_feature, detail = p_limit::text;
end;
$$;

revoke all on function private.raise_plan_limit(text, integer) from public, anon;
grant execute on function private.raise_plan_limit(text, integer) to authenticated;

-- accounts: cards, loans and everything else are three separate limits.
create or replace function public.accounts_enforce_plan_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_feature text;
  v_limit   integer;
  v_count   integer;
begin
  -- On update only what makes an account count again: un-archiving it, or
  -- turning it into another kind.
  if tg_op = 'UPDATE' and not (
    (old.is_archived and not new.is_archived) or new.type is distinct from old.type
  ) then
    return new;
  end if;
  if new.is_archived then
    return new;
  end if;

  v_feature := case new.type
    when 'credit_card' then 'credit_cards'
    when 'loan' then 'loans'
    else 'accounts'
  end;
  v_limit := private.plan_limit(v_feature);
  if v_limit is null then
    return new;
  end if;

  -- Two inserts at once must not both see room for one.
  perform pg_advisory_xact_lock(hashtextextended('plan_limit:' || new.user_id::text, 0));

  if new.type = 'credit_card' then
    -- Another line of a card that is already counted is not a new card.
    if new.card_group_id is not null and exists (
      select 1 from public.accounts a
      where a.user_id = new.user_id and a.card_group_id = new.card_group_id
        and a.type = 'credit_card' and not a.is_archived and a.id <> new.id
    ) then
      return new;
    end if;
    select count(distinct coalesce(a.card_group_id, a.id)) into v_count
    from public.accounts a
    where a.user_id = new.user_id and a.type = 'credit_card'
      and not a.is_archived and a.id <> new.id;
  elsif new.type = 'loan' then
    select count(*) into v_count from public.accounts a
    where a.user_id = new.user_id and a.type = 'loan'
      and not a.is_archived and a.id <> new.id;
  else
    select count(*) into v_count from public.accounts a
    where a.user_id = new.user_id and a.type not in ('credit_card', 'loan')
      and not a.is_archived and a.id <> new.id;
  end if;

  if v_count >= v_limit then
    perform private.raise_plan_limit(v_feature, v_limit);
  end if;
  return new;
end;
$$;

create trigger accounts_enforce_plan_limit
  before insert or update of is_archived, type on public.accounts
  for each row execute function public.accounts_enforce_plan_limit();

-- savings_goals and subscriptions: a plain count of live rows.
create or replace function public.enforce_row_plan_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_feature text := tg_argv[0];
  v_limit   integer;
  v_count   integer;
begin
  -- Nested rather than and-ed: `archived_at` only exists on savings_goals, and
  -- plpgsql does not promise to skip the second half of an AND.
  if tg_table_name = 'savings_goals' then
    if new.archived_at is not null then
      return new;
    end if;
    -- On update, only un-archiving makes a goal count again.
    if tg_op = 'UPDATE' and old.archived_at is null then
      return new;
    end if;
  end if;

  v_limit := private.plan_limit(v_feature);
  if v_limit is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('plan_limit:' || new.user_id::text, 0));

  if tg_table_name = 'savings_goals' then
    select count(*) into v_count from public.savings_goals g
    where g.user_id = new.user_id and g.archived_at is null and g.id <> new.id;
  else
    select count(*) into v_count from public.subscriptions s
    where s.user_id = new.user_id and s.id <> new.id;
  end if;

  if v_count >= v_limit then
    perform private.raise_plan_limit(v_feature, v_limit);
  end if;
  return new;
end;
$$;

create trigger savings_goals_enforce_plan_limit
  before insert or update of archived_at on public.savings_goals
  for each row execute function public.enforce_row_plan_limit('goals');

create trigger subscriptions_enforce_plan_limit
  before insert on public.subscriptions
  for each row execute function public.enforce_row_plan_limit('subscriptions');

-- Takes one use of a quota for the caller. True if allowed.
--
-- Security definer so it can write usage_counters, which nobody else can.
-- Callable directly over the API, which is harmless: it only ever spends the
-- caller's own quota. Unknown features and non-quota features refuse.
create or replace function public.consume_quota(p_feature text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_limit  integer;
  v_period text;
  v_start  date;
  v_used   integer;
begin
  if v_uid is null then
    return false;
  end if;

  select l.max_count, l.period into v_limit, v_period
  from public.plan_limits l
  where l.plan = public.current_plan() and l.feature = p_feature;
  if not found or v_period is null then
    return false;
  end if;
  if v_limit is not null and v_limit <= 0 then
    return false;
  end if;

  v_start := private.period_start(v_period);

  insert into public.usage_counters as u (user_id, feature, period_start, used)
  values (v_uid, p_feature, v_start, 1)
  on conflict (user_id, feature, period_start)
    do update set used = u.used + 1
    where v_limit is null or u.used < v_limit
  returning u.used into v_used;

  -- Old periods are only history; keep about two months of it.
  delete from public.usage_counters
  where user_id = v_uid and period_start < v_start - 62;

  return v_used is not null;
end;
$$;

revoke all on function public.consume_quota(text) from public, anon;
grant execute on function public.consume_quota(text) to authenticated;

-- Everything the app needs to show the caller's plan: the plan, and for each
-- feature its limit and how much of it is used now.
create or replace function public.plan_status()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid, public.current_plan() as plan),
  counts as (
    select 'accounts' as feature, count(*)::int as used from public.accounts a, me
      where a.user_id = me.uid and not a.is_archived and a.type not in ('credit_card', 'loan')
    union all
    select 'credit_cards', count(distinct coalesce(a.card_group_id, a.id))::int from public.accounts a, me
      where a.user_id = me.uid and not a.is_archived and a.type = 'credit_card'
    union all
    select 'loans', count(*)::int from public.accounts a, me
      where a.user_id = me.uid and not a.is_archived and a.type = 'loan'
    union all
    select 'goals', count(*)::int from public.savings_goals g, me
      where g.user_id = me.uid and g.archived_at is null
    union all
    select 'subscriptions', count(*)::int from public.subscriptions s, me
      where s.user_id = me.uid
    union all
    select l.feature, coalesce(u.used, 0) from public.plan_limits l
      cross join me
      left join public.usage_counters u
        on u.user_id = me.uid and u.feature = l.feature
       and u.period_start = private.period_start(l.period)
      where l.plan = me.plan and l.period is not null
  )
  select jsonb_build_object(
    'plan', me.plan,
    'expiresAt', (select e.expires_at from public.entitlements e where e.user_id = me.uid),
    'features', coalesce((
      select jsonb_object_agg(l.feature, jsonb_build_object(
        'limit', l.max_count,
        'period', l.period,
        'used', coalesce(c.used, 0)
      ))
      from public.plan_limits l
      left join counts c on c.feature = l.feature
      where l.plan = me.plan
    ), '{}'::jsonb)
  )
  from me;
$$;

revoke all on function public.plan_status() from public, anon;
grant execute on function public.plan_status() to authenticated;
