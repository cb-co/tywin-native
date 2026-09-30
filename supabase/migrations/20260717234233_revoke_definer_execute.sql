-- Supabase grants EXECUTE on new public functions to anon/authenticated
-- directly (via default privileges), so revoking from PUBLIC alone leaves those
-- grants in place. Revoke from the API roles explicitly (advisors 0028/0029).
-- The new-user trigger still fires (trigger execution does not check EXECUTE),
-- and seed_default_categories is only ever called by handle_new_user (owner).
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.seed_default_categories(uuid) from anon, authenticated;
