-- Executes one model-written SELECT against the q_ views.
--
-- `stable` is the guard that matters. Postgres refuses to run a data-modifying
-- statement inside a non-volatile function, EXECUTE included, so a string that
-- beats the TypeScript regex in lib/ask/guard.ts still cannot write — the
-- engine raises instead. That is a property of this declaration rather than a
-- pattern match, which is why it outranks the denylist in front of it.
--
-- `security invoker` puts it under the caller's auth.uid(), so RLS on the base
-- tables behind the views is the same isolation every screen already trusts.
-- No service-role key touches this path.
--
-- The row cap protects the model's context window more than the database: ten
-- thousand rows coming back is a worse problem than a slow query. 501 are
-- fetched so that hitting the cap is detectable, and `truncated` tells the
-- model to narrow or aggregate rather than report a total it only partly saw.
create or replace function public.ask_query(p_sql text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
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

revoke all on function public.ask_query(text) from public, anon;
grant execute on function public.ask_query(text) to authenticated;
