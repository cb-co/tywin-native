-- Network fees apply only to transfers to a DIFFERENT bank. A payment between
-- two accounts at the same bank is free. Add a bank/institution field and teach
-- the compute trigger the rule (case-insensitive, whitespace-tolerant match).

alter table public.accounts add column bank text;

create or replace function public.transactions_compute_amounts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  src public.accounts%rowtype;
  dst_bank text;
  same_bank boolean := false;
begin
  select * into src from public.accounts where id = new.account_id;

  if new.type = 'payment' and new.to_account_id is not null then
    select bank into dst_bank from public.accounts where id = new.to_account_id;
    same_bank := src.bank is not null and dst_bank is not null
                 and lower(btrim(src.bank)) = lower(btrim(dst_bank));
  end if;

  new.tax_amount := case
    when new.include_tax then round(new.amount * coalesce(src.transfer_tax_rate, 0), 4)
    else 0 end;
  -- Commission (network fee) is waived for same-bank transfers.
  new.fee_amount := case
    when new.include_commission and not same_bank then coalesce(src.network_fee_amount, 0)
    else 0 end;

  new.total_amount      := new.amount + new.tax_amount + new.fee_amount;
  new.base_amount       := round(new.amount * new.exchange_rate, 4);
  new.base_total_amount := round(new.total_amount * new.exchange_rate, 4);
  return new;
end;
$$;
