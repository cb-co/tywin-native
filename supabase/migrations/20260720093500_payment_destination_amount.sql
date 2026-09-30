-- A payment between accounts of different currencies was corrupting one leg.
--
-- `transactions` carried a single `amount` in a single `currency`, and
-- `exchange_rate` converted that only into the user's *base* currency
-- (base_amount / base_total_amount, used by net worth and cashflow). Nothing
-- converted between the two accounts. `account_balances` then applied the raw
-- figure to both legs:
--
--   payment, account_id    = a.id -> -t.total_amount   (source)
--   payment, to_account_id = a.id -> +t.amount         (destination)
--
-- so a 10,000 DOP payment out of a USD account credited 10,000 DOP to the DOP
-- account (right) and debited 10,000 USD from the USD account (wrong — it
-- should have been ~1,742 USD). The rate the user typed never touched either
-- balance. The same raw `amount` was used by `loan_status.outstanding_balance`
-- and by `transactions_sync_card_balance`, so payments into a foreign-currency
-- loan or credit card were wrong the same way.
--
-- Fix: a payment now carries both legs. `amount` is denominated in the SOURCE
-- account's currency (the form locks the currency picker to it) and the new
-- `to_amount` holds the figure in the DESTINATION account's currency. Each
-- balance reads the leg in its own currency.
--
-- Existing rows keep to_amount null and are read via coalesce(to_amount,
-- amount) — identical behaviour to today, which is correct for the
-- same-currency payments that make up almost all of them. Genuinely
-- cross-currency rows written before this migration stay wrong until edited;
-- they are not backfilled, since only the person who entered them knows the
-- rate that applied at the time.

alter table public.transactions
  add column to_amount numeric(18,4)
    check (to_amount is null or to_amount >= 0);

comment on column public.transactions.to_amount is
  'Payment destination leg, in the destination account''s currency. Null on non-payments and on payment rows written before 20260720093500.';

alter table public.transactions
  add constraint non_payment_has_no_destination_amount
    check (type = 'payment' or to_amount is null);

-- Fill the destination leg and reject a cross-currency payment that omits it.
-- Same-currency payments may leave it null; it mirrors `amount`.
create or replace function public.transactions_set_destination_amount()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  src_currency text;
  dst_currency text;
begin
  if new.type <> 'payment' then
    new.to_amount := null;
    return new;
  end if;

  select currency into src_currency from public.accounts where id = new.account_id;
  select currency into dst_currency from public.accounts where id = new.to_account_id;

  if new.to_amount is null then
    if src_currency is distinct from dst_currency then
      raise exception
        'a payment from % to % must supply to_amount (the destination-currency leg)',
        src_currency, dst_currency;
    end if;
    new.to_amount := new.amount;
  end if;

  return new;
end;
$$;

-- Independent of transactions_compute_amounts (it reads only amount, type and
-- the two account ids), so the relative firing order does not matter.
create trigger transactions_destination_amount
  before insert or update on public.transactions
  for each row execute function public.transactions_set_destination_amount();

-- Balances: credit the destination its own-currency leg -------------------
create or replace view public.account_balances
with (security_invoker = true) as
with movements as (
  select a.id as account_id,
         a.user_id,
         a.currency,
         a.starting_balance,
         -- own-currency net from transactions (exclude budget_only)
         coalesce(sum(case
           when t.budget_only then 0
           when t.type = 'income'  and t.account_id = a.id then t.amount
           when t.type = 'expense' and t.account_id = a.id then -t.total_amount
           when t.type = 'payment' and t.account_id = a.id then -t.total_amount
           when t.type = 'payment' and t.to_account_id = a.id
             then coalesce(t.to_amount, t.amount)
           else 0 end), 0) as net_amount,
         -- base-currency net. The destination leg is worth the same in base as
         -- the source leg, so base_amount serves both; only tax/fee (which stay
         -- with the source) make the two sides differ.
         coalesce(sum(case
           when t.budget_only then 0
           when t.type = 'income'  and t.account_id = a.id then t.base_amount
           when t.type = 'expense' and t.account_id = a.id then -t.base_total_amount
           when t.type = 'payment' and t.account_id = a.id then -t.base_total_amount
           when t.type = 'payment' and t.to_account_id = a.id then t.base_amount
           else 0 end), 0) as net_base_amount
  from public.accounts a
  left join public.transactions t
    on (t.account_id = a.id or t.to_account_id = a.id)
  -- loans and cards are represented solely by their *_status views
  where a.type not in ('credit_card', 'loan')
  group by a.id, a.user_id, a.currency, a.starting_balance
)
select account_id, user_id, currency,
       starting_balance,
       starting_balance + net_amount as balance,   -- own currency
       net_base_amount               as base_movement
from movements;

-- Loans: a payment reduces the loan by its own-currency leg ---------------
-- Column list and order are unchanged from 20260719123234 (create or replace
-- view cannot drop or rename columns); only paid_amount gains the coalesce.
create or replace view public.loan_status
with (security_invoker = true) as
select a.id as account_id,
       a.user_id,
       a.currency,
       a.principal,
       a.installment_amount,
       a.term_months,
       a.payment_due_day,
       a.principal - coalesce(p.paid_amount, 0) as outstanding_balance,
       coalesce(p.paid_count, 0)                as installments_paid,
       a.original_term_months,
       coalesce(a.original_term_months, a.term_months) as progress_term_months,
       greatest(coalesce(a.original_term_months, a.term_months) - coalesce(a.term_months, 0), 0)
         + coalesce(p.paid_count, 0) as progress_installments_paid
from public.accounts a
left join lateral (
  select count(*) as paid_count, sum(coalesce(t.to_amount, t.amount)) as paid_amount
  from public.transactions t
  where t.to_account_id = a.id and t.type = 'payment' and not t.budget_only
) p on true
where a.type = 'loan';

-- Cards: pay down the card by its own-currency leg ------------------------
create or replace function public.transactions_sync_card_balance()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  is_card boolean;
begin
  if tg_op in ('DELETE','UPDATE') and old.type = 'payment' and old.to_account_id is not null then
    select type = 'credit_card' into is_card from public.accounts where id = old.to_account_id;
    if is_card then
      update public.accounts
      set current_balance = current_balance + coalesce(old.to_amount, old.amount)
      where id = old.to_account_id;  -- undo the prior effect
    end if;
  end if;

  if tg_op in ('INSERT','UPDATE') and new.type = 'payment' and new.to_account_id is not null then
    select type = 'credit_card' into is_card from public.accounts where id = new.to_account_id;
    if is_card then
      update public.accounts
      set current_balance = current_balance - coalesce(new.to_amount, new.amount)
      where id = new.to_account_id;  -- apply the new effect
    end if;
  end if;

  return coalesce(new, old);
end;
$$;
