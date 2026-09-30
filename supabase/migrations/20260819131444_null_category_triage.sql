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
  v_movement numeric;
  v_computed numeric;
  v_exclude  boolean := coalesce((p->>'exclude_from_budget')::boolean, true);
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

  if (select count(*) from jsonb_array_elements(p->'sections') s) <>
     (select count(distinct s->>'account_id') from jsonb_array_elements(p->'sections') s) then
    raise exception 'duplicate account_id across sections: each section must import to a distinct credit line';
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

    if (sec->>'previous_balance') is null
       or (sec->>'total_balance') is null
       or (sec->>'total_debits') is null
       or (sec->>'total_credits') is null then
      raise exception 'section % is missing balance fields required for checksum validation',
        sec->>'section_key';
    end if;

    -- Defense in depth: the statement's own arithmetic must tie before any
    -- write. previous + Σlines = closing when lines exist; stated totals
    -- otherwise (line-less sections like Cuotas). App-layer validation can
    -- be bypassed by calling this RPC directly, so the invariant lives here.
    if jsonb_array_length(coalesce(sec->'lines', '[]'::jsonb)) > 0 then
      select coalesce(sum((l->>'amount')::numeric), 0) into v_movement
      from jsonb_array_elements(sec->'lines') l;
    else
      v_movement := (sec->>'total_debits')::numeric - (sec->>'total_credits')::numeric;
    end if;
    v_computed := (sec->>'previous_balance')::numeric + v_movement;
    if v_computed <> (sec->>'total_balance')::numeric then
      raise exception 'section % checksum mismatch: computed % vs stated %',
        sec->>'section_key', v_computed, (sec->>'total_balance')::numeric;
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
      cost_of_carry, cost_of_carry_prior, cashback_total
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
      nullif(sec->>'cost_of_carry_prior','')::numeric,
      nullif(sec->>'cashback_total','')::numeric
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
        -- An empty category id means the importer could not tell what this is:
        -- the line lands with a null category and shows up in triage. Anything
        -- non-empty is still checked as strictly as before — this widens the
        -- accepted set by exactly one member, null.
        if nullif(ln->>'category_id','') is not null and not exists (
          select 1 from public.categories
          where id = (ln->>'category_id')::uuid and user_id = v_user
        ) then
          raise exception 'category % does not belong to you', ln->>'category_id';
        end if;

        insert into public.transactions (
          user_id, type, account_id, category_id, amount, currency, exchange_rate,
          fx_fallback, occurred_at, description, statement_line_id, exclude_from_budget
        ) values (
          v_user, 'expense', v_account, nullif(ln->>'category_id','')::uuid,
          (ln->>'amount')::numeric, v_currency,
          coalesce(nullif(sec->>'exchange_rate','')::numeric, 1),
          coalesce((sec->>'fx_fallback')::boolean, false),
          (ln->>'made_on')::timestamptz, ln->>'description', v_line, v_exclude
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

-- transactions.expense_requires_category: an expense may now have no category,
-- but only if nobody was ever asked.
--
-- The column has always been nullable; this CHECK is what actually forbade the
-- null (20260717234227_transactions.sql:36-37). Every imported line inserts as
-- type='expense', so without this the null category fails here instead of at the
-- ownership guard above — the same broken import, one line further down.
--
-- Replaced rather than dropped, because what it protects is still worth
-- protecting: a hand-entered expense sets neither statement_line_id nor
-- subscription_id, so Postgres still rejects one with no category, and the app's
-- Zod schema is not the only thing standing between a user and an uncategorised
-- manual entry. What it now permits is exactly the two paths that write a null
-- on purpose: an imported statement line the app could not identify, and a
-- charge from a subscription saved without a category.
alter table public.transactions drop constraint expense_requires_category;
alter table public.transactions add constraint expense_requires_category
  check (
    type <> 'expense'
    or category_id is not null
    or statement_line_id is not null
    or subscription_id is not null
  );

-- spend_distribution: stop dropping uncategorised spend.
--
-- Every line the importer could not identify now carries a null category
-- instead of being filed under "Other", and this function filtered nulls out —
-- so that money would have vanished from the Insights donut without the donut
-- saying so. It comes back as its own slice; lib/insights/queries.ts already
-- tolerates a null key and names it. Otherwise identical to the definition in
-- 20260731150000_spend_distribution_payments.sql.
create or replace function public.spend_distribution(p_month date)
returns table (category_id uuid, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.category_id, sum(t.base_total_amount) as total
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.type in ('expense','payment')
    and not t.exclude_from_budget
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', p_month)::date
  group by t.category_id
  order by total desc;
$$;

-- uncategorized_spend: the figure above the budget bars.
--
-- category_usage joins FROM categories, so a null-category row cannot appear in
-- it however the filters are written — hence a separate function rather than an
-- extra row. The inclusion rule is copied from category_usage exactly (see
-- 20260731130000_card_payment_default_and_cashflow.sql) so the two cannot
-- disagree about what counts as spending.
create or replace function public.uncategorized_spend(p_month date)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(t.base_total_amount), 0)
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.category_id is null
    and t.type in ('expense','payment')
    and not t.exclude_from_budget
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', p_month)::date;
$$;

-- category_rule_usage: how many statement lines each rule has matched.
--
-- What turns an abstract list of rules into something a person can judge: a rule
-- matching 40 lines is load-bearing, one matching 0 is a typo. `position(... in ...)`
-- rather than LIKE because patterns are user text — a pattern containing % or _
-- would silently become a wildcard under LIKE. This mirrors the JS `includes`
-- the importer matches with (lib/statements/categorize.ts).
--
-- security invoker + RLS on both tables scopes the join to the caller's own rows.
create or replace function public.category_rule_usage()
returns table (rule_id uuid, matches bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id as rule_id, count(l.id) as matches
  from public.category_rules r
  left join public.card_statement_lines l
    on l.user_id = r.user_id
   and ((r.rule_type = 'merchant'
         and position(upper(r.pattern) in upper(l.description)) > 0)
     or (r.rule_type = 'mcc' and l.mcc = r.pattern))
  where r.user_id = (select auth.uid())
  group by r.id;
$$;
