-- Lets a signed-in user permanently delete their own account from Settings.
-- Every user-owned table (profiles, accounts, transactions, categories,
-- subscriptions, card_statements, ...) references auth.users(id) on delete
-- cascade, so removing the auth.users row is sufficient to erase all of it.
-- SECURITY DEFINER is required because ordinary users have no privilege to
-- delete from auth.users directly; search_path is pinned empty and every
-- name is schema-qualified, matching the other definer functions.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users where id = (select auth.uid());
end;
$$;

-- Unlike the trigger-only definer functions (handle_new_user,
-- seed_default_categories), this one is meant to be called directly by the
-- signed-in user via RPC, and it can only ever delete auth.uid()'s own row.
grant execute on function public.delete_own_account() to authenticated;
