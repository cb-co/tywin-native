-- The app no longer stores statement PDFs at all (confirmStatementImport
-- dropped its Storage upload — see the amended design spec §3.1). The
-- `statements` bucket and its objects were already removed by hand via the
-- Storage API/Studio (the only supported way to do it — Supabase revokes
-- direct DELETE on storage.objects/storage.buckets for the migration role,
-- SQLSTATE 42501, precisely so raw SQL can't desync metadata from the real
-- object storage backend). This migration only drops the now-orphaned RLS
-- policies, which are ordinary Postgres objects with no such restriction.
drop policy if exists "statements bucket: owner read" on storage.objects;
drop policy if exists "statements bucket: owner insert" on storage.objects;
drop policy if exists "statements bucket: owner update" on storage.objects;
drop policy if exists "statements bucket: owner delete" on storage.objects;
