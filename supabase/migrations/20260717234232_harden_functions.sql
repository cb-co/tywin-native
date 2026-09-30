-- Pin search_path on the trigger functions (advisor 0011). They only touch
-- pg_catalog builtins and schema-qualified public objects, so an empty
-- search_path is safe and closes the mutable-search-path warning.

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.accounts_forbid_currency_change()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.currency is distinct from old.currency then
    raise exception 'accounts.currency is immutable';
  end if;
  return new;
end;
$$;

create or replace function public.transactions_compute_amounts()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  src public.accounts%rowtype;
begin
  select * into src from public.accounts where id = new.account_id;

  new.tax_amount := case
    when new.include_tax then round(new.amount * coalesce(src.transfer_tax_rate, 0), 4)
    else 0 end;
  new.fee_amount := case
    when new.include_commission then coalesce(src.network_fee_amount, 0)
    else 0 end;

  new.total_amount      := new.amount + new.tax_amount + new.fee_amount;
  new.base_amount       := round(new.amount * new.exchange_rate, 4);
  new.base_total_amount := round(new.total_amount * new.exchange_rate, 4);
  return new;
end;
$$;

create or replace function public.transactions_forbid_money_change()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.currency is distinct from old.currency
     or new.exchange_rate is distinct from old.exchange_rate then
    raise exception 'transactions.currency and exchange_rate are immutable';
  end if;
  return new;
end;
$$;

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
      update public.accounts set current_balance = current_balance + old.amount
      where id = old.to_account_id;
    end if;
  end if;

  if tg_op in ('INSERT','UPDATE') and new.type = 'payment' and new.to_account_id is not null then
    select type = 'credit_card' into is_card from public.accounts where id = new.to_account_id;
    if is_card then
      update public.accounts set current_balance = current_balance - new.amount
      where id = new.to_account_id;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

-- Lock down the SECURITY DEFINER functions (advisors 0028/0029). They are only
-- meant to run inside the new-user trigger chain (as the owner), never to be
-- called by a client via PostgREST RPC. Revoking EXECUTE from PUBLIC removes the
-- inherited grant for anon/authenticated; trigger firing does not require EXECUTE,
-- and seed_default_categories is invoked internally by handle_new_user (owner).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.seed_default_categories(uuid) from public;
