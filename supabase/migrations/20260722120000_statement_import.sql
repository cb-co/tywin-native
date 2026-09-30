-- Statement import: statements become the source of truth for card balances.
-- Spec: docs/superpowers/specs/2026-07-22-statement-import-design.md

-- 1) Line kind ------------------------------------------------------------
create type public.statement_line_kind as enum ('purchase','fee','credit','payment');

-- 2) statement_imports: one row per uploaded file -------------------------
create table public.statement_imports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  parser_id     text not null,
  card_group_id uuid references public.card_groups (id) on delete set null,
  file_name     text not null,
  file_path     text,
  status        text not null default 'imported'
                check (status in ('imported','failed_detection','failed_validation')),
  error         text,
  created_at    timestamptz not null default now()
);
create index statement_imports_user_idx on public.statement_imports (user_id, created_at desc);

alter table public.statement_imports enable row level security;
create policy "statement_imports: owner read" on public.statement_imports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "statement_imports: owner insert" on public.statement_imports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "statement_imports: owner delete" on public.statement_imports
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 3) card_statements: statement is now a full anchor ----------------------
alter table public.card_statements
  add column import_id              uuid references public.statement_imports (id) on delete set null,
  add column section_key            text,
  add column previous_balance       numeric(18,4),
  add column minimum_payment        numeric(18,4),
  add column overdue_amount         numeric(18,4),
  add column overdue_installments   integer,
  add column credit_limit           numeric(18,4),
  add column available_credit       numeric(18,4),
  add column interest_rate_annual   numeric(18,8),
  add column avg_daily_balance      numeric(18,4),
  add column avg_daily_balance_prior numeric(18,4),
  add column cost_of_carry          numeric(18,4),
  add column cost_of_carry_prior    numeric(18,4);

-- Hand-entered history may contain duplicate periods; the unique index is the
-- new identity (replace-on-reimport keeps exactly one statement per closing
-- date). Keep the newest row per (account_id, period_end).
delete from public.card_statements cs
using public.card_statements newer
where newer.account_id = cs.account_id
  and newer.period_end = cs.period_end
  and (newer.created_at, newer.id) > (cs.created_at, cs.id);

-- One statement per account per closing date; re-import replaces it.
create unique index card_statements_account_period_uidx
  on public.card_statements (account_id, period_end);

-- 4) card_statement_lines: raw parsed lines (audit trail) -----------------
create table public.card_statement_lines (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  statement_id   uuid not null references public.card_statements (id) on delete cascade,
  account_id     uuid not null references public.accounts (id) on delete cascade,
  line_no        integer not null,
  made_on        date not null,
  posted_on      date not null,
  reference      text,
  description    text not null,
  mcc            text,
  auth_code      text,
  amount         numeric(18,4) not null,   -- negative = credit
  kind           public.statement_line_kind not null,
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (statement_id, line_no)
);
create index card_statement_lines_statement_idx on public.card_statement_lines (statement_id);
create index card_statement_lines_account_idx on public.card_statement_lines (account_id);

alter table public.card_statement_lines enable row level security;
create policy "card_statement_lines: owner read" on public.card_statement_lines
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_statement_lines: owner insert" on public.card_statement_lines
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "card_statement_lines: owner update" on public.card_statement_lines
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "card_statement_lines: owner delete" on public.card_statement_lines
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 5) transactions: statement linkage + relaxed amount sign ----------------
alter table public.transactions
  add column statement_line_id uuid references public.card_statement_lines (id) on delete cascade;
create index transactions_statement_line_idx on public.transactions (statement_line_id);

-- Refunds/rebates import as negative expenses; only statement-sourced rows may be negative.
alter table public.transactions drop constraint transactions_amount_check;
alter table public.transactions
  add constraint transactions_amount_check
  check (amount >= 0 or statement_line_id is not null);

-- 6) statement_section_mappings: learned section → account routing --------
create table public.statement_section_mappings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  parser_id     text not null,
  card_group_id uuid not null references public.card_groups (id) on delete cascade,
  section_key   text not null,
  account_id    uuid not null references public.accounts (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, parser_id, card_group_id, section_key)
);
alter table public.statement_section_mappings enable row level security;
create policy "section_mappings: owner read" on public.statement_section_mappings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "section_mappings: owner insert" on public.statement_section_mappings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "section_mappings: owner update" on public.statement_section_mappings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "section_mappings: owner delete" on public.statement_section_mappings
  for delete to authenticated using ((select auth.uid()) = user_id);
create trigger section_mappings_set_updated_at before update on public.statement_section_mappings
  for each row execute function public.set_updated_at();

-- 7) category_rules: user-owned MCC/merchant → category ------------------
create table public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  rule_type   text not null check (rule_type in ('mcc','merchant')),
  pattern     text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  priority    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, rule_type, pattern)
);
alter table public.category_rules enable row level security;
create policy "category_rules: owner read" on public.category_rules
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "category_rules: owner insert" on public.category_rules
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "category_rules: owner update" on public.category_rules
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "category_rules: owner delete" on public.category_rules
  for delete to authenticated using ((select auth.uid()) = user_id);
create trigger category_rules_set_updated_at before update on public.category_rules
  for each row execute function public.set_updated_at();

-- 8) Anchor + drift balance ----------------------------------------------
-- current_balance = latest statement total_balance
--                 − Σ payments to the card dated after that statement's period_end.
-- No statement → no-op (legacy incremental behavior still applies).
create or replace function public.recompute_card_balance(p_account uuid)
returns void language plpgsql
set search_path = ''
as $$
declare
  anchor record;
begin
  select cs.total_balance, cs.period_end into anchor
  from public.card_statements cs
  where cs.account_id = p_account
  order by cs.period_end desc
  limit 1;
  if not found then return; end if;

  update public.accounts a
  set current_balance = anchor.total_balance - coalesce((
        select sum(coalesce(t.to_amount, t.amount))
        from public.transactions t
        where t.to_account_id = p_account
          and t.type = 'payment'
          and not t.budget_only
          and t.occurred_at::date > anchor.period_end
      ), 0)
  where a.id = p_account and a.type = 'credit_card';
end;
$$;

-- Payments: anchored cards recompute (idempotent); anchor-less cards keep
-- the incremental adjustment they had before this migration.
create or replace function public.transactions_sync_card_balance()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  v_card uuid;
begin
  if tg_op in ('DELETE','UPDATE') and old.type = 'payment' and old.to_account_id is not null then
    select id into v_card from public.accounts
      where id = old.to_account_id and type = 'credit_card';
    if v_card is not null then
      if exists (select 1 from public.card_statements where account_id = v_card) then
        perform public.recompute_card_balance(v_card);
      else
        update public.accounts
        set current_balance = current_balance + coalesce(old.to_amount, old.amount)
        where id = v_card;
      end if;
    end if;
  end if;

  if tg_op in ('INSERT','UPDATE') and new.type = 'payment' and new.to_account_id is not null then
    select id into v_card from public.accounts
      where id = new.to_account_id and type = 'credit_card';
    if v_card is not null then
      if exists (select 1 from public.card_statements where account_id = v_card) then
        perform public.recompute_card_balance(v_card);
      else
        update public.accounts
        set current_balance = current_balance - coalesce(new.to_amount, new.amount)
        where id = v_card;
      end if;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

-- Statements are anchors: any change recomputes the account.
create or replace function public.card_statements_recompute()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  perform public.recompute_card_balance(coalesce(new.account_id, old.account_id));
  return coalesce(new, old);
end;
$$;
create trigger card_statements_recompute_balance
  after insert or update or delete on public.card_statements
  for each row execute function public.card_statements_recompute();

-- 9) Budgets: card payments stop counting (statement lines carry the real
-- categories now; counting both would double-deduct). Loans stay budgetable.
create or replace function public.category_usage(p_month date)
returns table (
  category_id uuid,
  budget      numeric,
  used        numeric,
  remaining   numeric,
  status      public.budget_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  with m as (select date_trunc('month', p_month)::date as month)
  select c.id as category_id,
         coalesce(b.amount, 0) as budget,
         coalesce(u.used, 0)   as used,
         coalesce(b.amount, 0) - coalesce(u.used, 0) as remaining,
         case
           when coalesce(u.used,0) > coalesce(b.amount,0) then 'over'::public.budget_status
           when coalesce(b.amount,0) > 0
             and coalesce(u.used,0) >= 0.9 * b.amount     then 'approaching'::public.budget_status
           else 'within'::public.budget_status
         end as status
  from public.categories c
  cross join m
  left join public.category_budgets b
    on b.category_id = c.id and b.month = m.month
  left join (
    select t.category_id, sum(t.base_total_amount) as used
    from public.transactions t, m
    where t.category_id is not null
      and t.type in ('expense','payment')
      and not (t.type = 'payment' and exists (
        select 1 from public.accounts ca
        where ca.id = t.to_account_id and ca.type = 'credit_card'))
      and date_trunc('month', t.occurred_at)::date = m.month
    group by t.category_id
  ) u on u.category_id = c.id
  where c.user_id = (select auth.uid());
$$;

-- 10) Cost of carry: latest statement per credit line ---------------------
create view public.card_cost_of_carry
with (security_invoker = true) as
select a.id   as account_id,
       a.user_id,
       a.name,
       a.currency,
       g.name as group_name,
       s.period_end,
       s.interest_rate_annual,
       s.avg_daily_balance,
       s.cost_of_carry,
       s.cost_of_carry_prior
from public.accounts a
left join public.card_groups g on g.id = a.card_group_id
join lateral (
  select * from public.card_statements cs
  where cs.account_id = a.id
  order by cs.period_end desc
  limit 1
) s on true
where a.type = 'credit_card';

-- 11) Private storage for the original PDFs -------------------------------
insert into storage.buckets (id, name, public)
values ('statements', 'statements', false)
on conflict (id) do nothing;

create policy "statements bucket: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'statements'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "statements bucket: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'statements'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "statements bucket: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'statements'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 12) Atomic import -------------------------------------------------------
-- One call per confirmed upload. Replaces same-period statements, writes
-- lines, generates expense transactions (payments excluded), recomputes.
-- All rows are owner-scoped; RLS also applies (security invoker).
create or replace function public.import_card_statement(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_import   uuid;
  v_stmt     uuid;
  v_line     uuid;
  v_txn      uuid;
  sec        jsonb;
  ln         jsonb;
  v_account  uuid;
  v_currency text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if nullif(p->>'card_group_id','') is not null then
    if not exists (
      select 1 from public.card_groups
      where id = (p->>'card_group_id')::uuid and user_id = v_user
    ) then
      raise exception 'card_group % does not belong to you', p->>'card_group_id';
    end if;
  end if;

  insert into public.statement_imports (user_id, parser_id, card_group_id, file_name, file_path)
  values (v_user, p->>'parser_id', nullif(p->>'card_group_id','')::uuid,
          p->>'file_name', nullif(p->>'file_path',''))
  returning id into v_import;

  for sec in select * from jsonb_array_elements(p->'sections') loop
    v_account := (sec->>'account_id')::uuid;
    select currency into v_currency from public.accounts
      where id = v_account and user_id = v_user and type = 'credit_card';
    if v_currency is null then
      raise exception 'account % is not one of your credit cards', v_account;
    end if;

    delete from public.card_statements
      where account_id = v_account and period_end = (sec->>'period_end')::date;

    insert into public.card_statements (
      user_id, account_id, import_id, section_key, source,
      period_start, period_end, due_date,
      previous_balance, total_debits, total_credits,
      statement_balance, total_balance,
      minimum_payment, overdue_amount, overdue_installments,
      credit_limit, available_credit,
      interest_rate_annual, avg_daily_balance, avg_daily_balance_prior,
      cost_of_carry, cost_of_carry_prior
    ) values (
      v_user, v_account, v_import, sec->>'section_key', 'import',
      (sec->>'period_start')::date, (sec->>'period_end')::date,
      nullif(sec->>'due_date','')::date,
      (sec->>'previous_balance')::numeric,
      (sec->>'total_debits')::numeric, (sec->>'total_credits')::numeric,
      (sec->>'statement_balance')::numeric, (sec->>'total_balance')::numeric,
      nullif(sec->>'minimum_payment','')::numeric,
      nullif(sec->>'overdue_amount','')::numeric,
      nullif(sec->>'overdue_installments','')::integer,
      nullif(sec->>'credit_limit','')::numeric,
      nullif(sec->>'available_credit','')::numeric,
      nullif(sec->>'interest_rate_annual','')::numeric,
      nullif(sec->>'avg_daily_balance','')::numeric,
      nullif(sec->>'avg_daily_balance_prior','')::numeric,
      nullif(sec->>'cost_of_carry','')::numeric,
      nullif(sec->>'cost_of_carry_prior','')::numeric
    ) returning id into v_stmt;

    for ln in select * from jsonb_array_elements(sec->'lines') loop
      insert into public.card_statement_lines (
        user_id, statement_id, account_id, line_no, made_on, posted_on,
        reference, description, mcc, auth_code, amount, kind
      ) values (
        v_user, v_stmt, v_account,
        (ln->>'line_no')::integer, (ln->>'made_on')::date, (ln->>'posted_on')::date,
        nullif(ln->>'reference',''), ln->>'description',
        nullif(ln->>'mcc',''), nullif(ln->>'auth_code',''),
        (ln->>'amount')::numeric, (ln->>'kind')::public.statement_line_kind
      ) returning id into v_line;

      if (ln->>'kind') <> 'payment' then
        if not exists (
          select 1 from public.categories
          where id = (ln->>'category_id')::uuid and user_id = v_user
        ) then
          raise exception 'category % does not belong to you', ln->>'category_id';
        end if;

        insert into public.transactions (
          user_id, type, account_id, category_id, amount, currency, exchange_rate,
          occurred_at, description, statement_line_id
        ) values (
          v_user, 'expense', v_account, (ln->>'category_id')::uuid,
          (ln->>'amount')::numeric, v_currency,
          coalesce(nullif(sec->>'exchange_rate','')::numeric, 1),
          (ln->>'made_on')::timestamptz, ln->>'description', v_line
        ) returning id into v_txn;

        update public.card_statement_lines set transaction_id = v_txn where id = v_line;
      end if;
    end loop;

    perform public.recompute_card_balance(v_account);
  end loop;

  return v_import;
end;
$$;
revoke execute on function public.import_card_statement(jsonb) from anon;
