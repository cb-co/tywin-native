-- Normalize "bank" from a free-text field into a per-user banks table referenced
-- by accounts, so same-bank detection is an exact id match, not a string compare.

create table public.banks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.banks enable row level security;
create policy "banks: owner read" on public.banks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "banks: owner insert" on public.banks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "banks: owner update" on public.banks
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "banks: owner delete" on public.banks
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger banks_set_updated_at before update on public.banks
  for each row execute function public.set_updated_at();

alter table public.accounts
  add column bank_id uuid references public.banks (id) on delete set null;
create index accounts_bank_id_idx on public.accounts (bank_id);

-- Carry any free-text bank values into the new table and link them up.
insert into public.banks (user_id, name)
select distinct user_id, btrim(bank)
from public.accounts
where bank is not null and btrim(bank) <> ''
on conflict (user_id, name) do nothing;

update public.accounts a
set bank_id = b.id
from public.banks b
where a.bank is not null and btrim(a.bank) <> ''
  and b.user_id = a.user_id and b.name = btrim(a.bank);

alter table public.accounts drop column bank;

-- Same-bank check now uses bank_id equality.
create or replace function public.transactions_compute_amounts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  src public.accounts%rowtype;
  dst_bank uuid;
  same_bank boolean := false;
begin
  select * into src from public.accounts where id = new.account_id;

  if new.type = 'payment' and new.to_account_id is not null then
    select bank_id into dst_bank from public.accounts where id = new.to_account_id;
    same_bank := src.bank_id is not null and dst_bank is not null and src.bank_id = dst_bank;
  end if;

  new.tax_amount := case
    when new.include_tax then round(new.amount * coalesce(src.transfer_tax_rate, 0), 4)
    else 0 end;
  new.fee_amount := case
    when new.include_commission and not same_bank then coalesce(src.network_fee_amount, 0)
    else 0 end;

  new.total_amount      := new.amount + new.tax_amount + new.fee_amount;
  new.base_amount       := round(new.amount * new.exchange_rate, 4);
  new.base_total_amount := round(new.total_amount * new.exchange_rate, 4);
  return new;
end;
$$;
