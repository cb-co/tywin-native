-- Re-import overwrites the deterministic per-period object path via storage
-- upsert, which requires UPDATE on storage.objects. The original bucket
-- policies (20260722120000) omitted it, so every re-import silently
-- degraded to file_path = ''.
create policy "statements bucket: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'statements'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'statements'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
