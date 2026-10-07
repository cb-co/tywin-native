-- Accounts are held in what Dominican banks offer: DOP, USD or EUR.
--
-- A credit card's lines are fixed: DOP, USD and CUOTAS (installments, which
-- Dominican issuers bill in pesos). A card holds at most one of each, so a card
-- group is never more than three lines.
--
-- Until now a line's identity was inferred: from its currency, and for the two
-- DOP lines from its name ("· Cuotas"), with the statement importer learning a
-- section → account routing per card in statement_section_mappings. Storing the
-- line makes the routing a lookup, so the learned table goes.

alter table public.accounts add column card_line text;

-- USD is unambiguous. A DOP line is the cuotas line when anything already says
-- so: an import landed a cuotas section on it, or its name does.
update public.accounts a
set card_line = case
  when a.currency = 'USD' then 'USD'
  when a.currency = 'DOP' and (
    exists (
      select 1 from public.card_statements s
      where s.account_id = a.id and s.section_key ~* '(^|_)CUOTAS(_|$)'
    )
    or a.name ~* '(cuota|installment)'
  ) then 'CUOTAS'
  when a.currency = 'DOP' then 'DOP'
end
where a.type = 'credit_card';

-- Refuse to guess past this point: a card in another currency, or two lines of
-- one card that resolved to the same line, needs a person to look at it.
do $$
declare
  v_bad text;
begin
  select string_agg(format('%s (%s)', id, currency), ', ') into v_bad
  from public.accounts
  where type = 'credit_card' and card_line is null;
  if v_bad is not null then
    raise exception 'credit cards must be DOP or USD; fix these first: %', v_bad;
  end if;

  select string_agg(format('%s (%s)', id, currency), ', ') into v_bad
  from public.accounts
  where currency not in ('DOP', 'USD', 'EUR');
  if v_bad is not null then
    raise exception 'accounts must be DOP, USD or EUR; fix these first: %', v_bad;
  end if;

  select string_agg(format('%s/%s', card_group_id, card_line), ', ') into v_bad
  from (
    select card_group_id, card_line from public.accounts
    where card_group_id is not null and not is_archived
    group by card_group_id, card_line
    having count(*) > 1
  ) d;
  if v_bad is not null then
    raise exception 'card groups with a repeated line; fix these first: %', v_bad;
  end if;
end $$;

-- Replaces the table's original three-letter check, which Postgres named the same.
alter table public.accounts
  drop constraint accounts_currency_check,
  add constraint accounts_currency_check check (currency in ('DOP', 'USD', 'EUR'));

alter table public.accounts
  add constraint accounts_card_line_check check (
    (type <> 'credit_card' and card_line is null)
    or (type = 'credit_card' and (card_line, currency) in (('DOP', 'DOP'), ('USD', 'USD'), ('CUOTAS', 'DOP')))
  );

-- One of each line per card. Archived lines are left out so a retired line does
-- not block its replacement.
create unique index accounts_card_line_per_group_idx
  on public.accounts (card_group_id, card_line)
  where card_group_id is not null and not is_archived;

drop table public.statement_section_mappings;
