-- ask_query only runs statements the Worker has vetted and signed.
--
-- Until now `ask_query(text)` was granted to `authenticated` and lived in an
-- API-exposed schema, so anyone with an account could POST
-- /rest/v1/rpc/ask_query with any SQL they liked: lib/ask/guard.ts runs in the
-- Worker and never saw those calls. RLS still kept other people's rows out of
-- reach, but the catalogs, every function `authenticated` may execute, and
-- three-second queries in unlimited numbers were all open.
--
-- The Worker now signs each guarded statement:
--
--   p_sig = hex(HMAC-SHA256(secret, auth.uid() || E'\n' || p_sql))
--
-- and this function refuses anything whose signature does not match. The
-- secret lives in Supabase Vault (name `ask_query_secret`) and in the Worker
-- as the `ASK_QUERY_SECRET` secret; nobody else holds it. Binding the caller's
-- id means a signature, even if one ever leaked, re-runs only that exact
-- statement for that one person.
--
-- One-time setup on each project (the value must equal ASK_QUERY_SECRET):
--   select vault.create_secret('<64 random hex chars>', 'ask_query_secret');
-- Until it exists every Ask query is refused, which is the safe failure.

create extension if not exists pgcrypto with schema extensions;

-- Not in the API's exposed schemas, so nothing here is reachable over HTTP.
create schema if not exists private;
revoke all on schema private from public, anon;
-- ask_query runs as the caller and has to reach the verifier below.
grant usage on schema private to authenticated;

-- Security definer only so it can read Vault. Returns a boolean and nothing
-- else: it cannot be used to learn the secret.
create or replace function private.ask_signature_ok(p_sql text, p_sig text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if p_sql is null or p_sig is null or auth.uid() is null then
    return false;
  end if;

  select s.decrypted_secret into v_secret
  from vault.decrypted_secrets s
  where s.name = 'ask_query_secret'
  limit 1;

  if v_secret is null or length(v_secret) < 32 then
    return false;
  end if;

  return encode(
    extensions.hmac(auth.uid()::text || E'\n' || p_sql, v_secret, 'sha256'),
    'hex'
  ) = lower(p_sig);
end;
$$;

revoke all on function private.ask_signature_ok(text, text) from public, anon;
grant execute on function private.ask_signature_ok(text, text) to authenticated;

drop function if exists public.ask_query(text);

-- Same body as 20260821172153_ask_query_comment_truth.sql (read its header for
-- what `stable`, `security invoker` and the empty search_path do and do not
-- guarantee), behind the signature check.
create function public.ask_query(p_sql text, p_sig text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if not private.ask_signature_ok(p_sql, p_sig) then
    raise exception 'ask_query: statement is not signed' using errcode = '42501';
  end if;

  perform set_config('statement_timeout', '3000', true);

  execute format(
    'select coalesce(jsonb_agg(r), ''[]''::jsonb) from (select * from (%s) x limit 501) r',
    p_sql
  ) into v_rows;

  if jsonb_array_length(v_rows) > 500 then
    return jsonb_build_object(
      'rows', (select jsonb_agg(e) from jsonb_array_elements(v_rows) with ordinality t(e, i) where i <= 500),
      'truncated', true
    );
  end if;

  return jsonb_build_object('rows', v_rows, 'truncated', false);
end;
$$;

revoke all on function public.ask_query(text, text) from public, anon;
grant execute on function public.ask_query(text, text) to authenticated;
