-- Documents live DB state. Already applied. Do not re-run.
-- RECONSTRUCTED on 2026-09-26 from supabase/live_schema_dump.json (original file was never saved).
--
-- Private bucket "memory-media". Object paths start with <couple_id>/, and
-- each policy checks membership against that first folder segment.
-- (The bucket itself was created in the dashboard; the dump doesn't cover buckets.)

create policy "couple members can read their media"
  on storage.objects for select
  using (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy "couple members can upload their media"
  on storage.objects for insert
  with check (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy "couple members can update their media"
  on storage.objects for update
  using (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy "couple members can delete their media"
  on storage.objects for delete
  using (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );
