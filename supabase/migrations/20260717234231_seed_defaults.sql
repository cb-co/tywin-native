-- Shared, read-only currency reference table -----------------------------
create table public.currencies (
  code   text primary key check (char_length(code) = 3),
  name   text not null,
  symbol text not null
);

alter table public.currencies enable row level security;
create policy "currencies: readable by authenticated"
  on public.currencies for select to authenticated using (true);

insert into public.currencies (code, name, symbol) values
  ('USD','US Dollar','$'),
  ('DOP','Dominican Peso','RD$'),
  ('EUR','Euro','€')
on conflict (code) do nothing;

-- Seed starter categories for each new profile ---------------------------
create or replace function public.seed_default_categories(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (user_id, name, emoji, sort_order)
  values
    (p_user,'Groceries','🛒',1),
    (p_user,'Dining','🍽️',2),
    (p_user,'Transport','🚗',3),
    (p_user,'Housing','🏠',4),
    (p_user,'Utilities','💡',5),
    (p_user,'Health','⚕️',6),
    (p_user,'Shopping','🛍️',7),
    (p_user,'Entertainment','🎬',8),
    (p_user,'Savings','💰',9),
    (p_user,'Other','•',10);
end;
$$;

-- Extend the new-user handler to also seed categories.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;
