-- 011: function grants cleanup (security advisor lints 0028/0029) + memory-media upload limits
-- Trigger functions don't need callers to hold EXECUTE: Postgres only checks it at CREATE TRIGGER time.
begin;

-- 1. Trigger / event-trigger functions: never called directly by clients
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2. RLS helpers: signed-in users only (policies evaluate them as the calling role)
revoke execute on function public.is_couple_member(uuid)     from public, anon;
revoke execute on function public.has_answered(uuid)         from public, anon;
revoke execute on function public.partner_has_answered(uuid) from public, anon;
grant  execute on function public.is_couple_member(uuid)     to authenticated;
grant  execute on function public.has_answered(uuid)         to authenticated;
grant  execute on function public.partner_has_answered(uuid) to authenticated;

-- 3. memory-media: 50 MB per file (Free plan global cap), only the types the app uploads.
--    Keep in sync with MAX_UPLOAD_BYTES in src/lib/upload.ts.
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg', 'video/quicktime', 'video/mp4']
 where id = 'memory-media';

commit;
