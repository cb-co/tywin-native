-- Recreates public.ask_query with an identical body and an honest header.
--
-- No behaviour changes. It exists because the comment 20260820181916 shipped
-- with is wrong in the one way a comment must never be wrong: it overstates a
-- security guarantee. `pg_get_functiondef` returns that text to whoever looks
-- next, and someone reading "a string that beats the TypeScript regex still
-- cannot write" would reasonably conclude that lib/ask/guard.ts is
-- belt-and-braces and could be loosened. It is not, and it cannot.
--
-- What is actually true, established by probing this database rather than by
-- reading the manual:
--
--   * `stable` DOES refuse direct DML through EXECUTE. `insert into ...` inside
--     this function raises, as does update, delete, and a data-modifying CTE.
--
--   * `stable` does NOT refuse a plain SELECT that calls a volatile function
--     which writes inside itself. `select public.some_writer()` runs happily.
--     This project has such functions — delete_own_account among them — and
--     none of them contain a forbidden keyword at a word boundary. So the
--     function allowlist in lib/ask/guard.ts is not a second opinion about
--     writes; on that path it is the only one.
--
--   * Cross-user isolation is RLS, and that part is exactly as strong as the
--     design claimed. `security invoker` runs this under the caller's
--     auth.uid(), the views are security_invoker, no service-role key is on
--     this path, and PostgREST runs a `stable` function in a read-only
--     transaction. The worst case if every app-side control failed is the
--     asking user's own data — never anyone else's.
--
-- `search_path = ''` is load-bearing and stays. Nothing here resolves an
-- unqualified name, which means lib/ask/guard.ts must rewrite every `q_` view
-- to `public.q_`, and does. The useful consequence is that a relation the guard
-- does NOT recognise stays unqualified and resolves to nothing at all: a base
-- table smuggled past the relation check (a comma join, say) is refused by the
-- engine rather than read and quietly summed. Do not "fix" this by setting a
-- search_path.
--
-- The row cap is the wire limit, not the context limit. lib/ask/tools.ts trims
-- the result again by BYTES before it reaches the model, because 500 rows of a
-- thirty-column view is a six-figure token count and would spend the whole
-- inference budget shipping a table nobody asked for.
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
