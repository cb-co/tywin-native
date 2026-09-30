-- import_card_statement: teach the checksum and the transaction guard about
-- 'adjustment' lines (see 20260825120000_statement_line_adjustment_kind.sql).
--
-- Two changes, both carve-outs for the new kind, and nothing else moves:
--   1. the checksum's Σlines skips adjustments, so a statement whose own
--      closing balance excludes one still ties;
--   2. an adjustment creates no transaction, the same way a payment does not —
--      it is a printed row, not spending, and turning it into an expense would
--      hand the budget a credit the cardholder never got.
--
-- Otherwise identical to the definition in 20260819131444_null_category_triage.sql.

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
    --
    -- 'adjustment' lines are excluded from Σlines: the statement prints them
    -- without applying them to its own closing balance, so counting them here
    -- would reject a faithful extraction. Mirrors movesBalance() in
    -- lib/statements/validate.ts — change both together.
    if jsonb_array_length(coalesce(sec->'lines', '[]'::jsonb)) > 0 then
      select coalesce(sum((l->>'amount')::numeric), 0) into v_movement
      from jsonb_array_elements(sec->'lines') l
      where (l->>'kind') <> 'adjustment';
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

      -- Payments and adjustments are recorded as statement lines but never
      -- become transactions: a payment is money arriving at the card rather
      -- than spending, and an adjustment moved no money at all. Mirrors
      -- NON_TRANSACTION_KINDS in lib/statements/types.ts.
      if (ln->>'kind') not in ('payment', 'adjustment') then
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
