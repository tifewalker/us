-- 018: voice notes everywhere
begin;

-- 1. Voice columns ({storage_path, duration_seconds, waveform})
alter table public.memory_media       add column waveform jsonb;
alter table public.activity_responses add column voice jsonb;
alter table public.memory_reflections add column voice jsonb;
alter table public.question_answers   add column voice jsonb;

alter table public.activity_responses add constraint activity_responses_voice_shape
  check (voice is null or (jsonb_typeof(voice) = 'object' and voice ? 'storage_path'));
alter table public.memory_reflections add constraint memory_reflections_voice_shape
  check (voice is null or (jsonb_typeof(voice) = 'object' and voice ? 'storage_path'));
alter table public.question_answers add constraint question_answers_voice_shape
  check (voice is null or (jsonb_typeof(voice) = 'object' and voice ? 'storage_path'));

-- 2. Text OR voice (voice-only answers allowed)
alter table public.memory_reflections alter column text drop not null;
alter table public.memory_reflections drop constraint memory_reflections_text_length;
alter table public.memory_reflections add constraint memory_reflections_text_or_voice
  check (char_length(coalesce(text, '')) <= 2000
         and (nullif(btrim(coalesce(text, '')), '') is not null or voice is not null));

alter table public.question_answers alter column answer drop not null;
alter table public.question_answers drop constraint question_answers_answer_check;
alter table public.question_answers add constraint question_answers_text_or_voice
  check (char_length(coalesce(answer, '')) <= 1000
         and (nullif(btrim(coalesce(answer, '')), '') is not null or voice is not null));

-- 3. Let the bucket accept .m4a voice notes (AAC in an MP4 container)
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'video/quicktime', 'video/mp4', 'audio/mp4']
 where id = 'memory-media';

-- 4. Storage locks for voice answers (same pattern as 017's activity photos)
create or replace function public.can_read_reflection_voice(target_memory_id uuid, uploader_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_memory_id is not null and uploader_id is not null
     and (uploader_id = auth.uid()
          or exists (select 1 from public.memories m
                     where m.id = target_memory_id and public.is_couple_member(m.couple_id)
                       and public.has_reflected(target_memory_id)));
$$;
create or replace function public.can_read_question_voice(target_thread_id uuid, uploader_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_thread_id is not null and uploader_id is not null
     and (uploader_id = auth.uid()
          or exists (select 1 from public.question_threads t
                     where t.id = target_thread_id and public.is_couple_member(t.couple_id)
                       and public.has_answered_question(target_thread_id)));
$$;
revoke execute on function public.can_read_reflection_voice(uuid, uuid), public.can_read_question_voice(uuid, uuid) from public, anon;
grant execute on function public.can_read_reflection_voice(uuid, uuid), public.can_read_question_voice(uuid, uuid) to authenticated;

-- Rebuild the four storage policies: everything from 014/017 unchanged, plus
--   reflections/<memory_id>/<user_id>/…  and  questions/<thread_id>/<user_id>/…
drop policy "couple members can read their media" on storage.objects;
create policy "couple members can read their media" on storage.objects for select using (
  bucket_id = 'memory-media'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] is distinct from 'sealed'
       or public.can_read_sealed(((storage.foldername(name))[3])::uuid))
  and ((storage.foldername(name))[2] is distinct from 'activity-responses'
       or public.can_read_activity_photo(public.try_uuid((storage.foldername(name))[3]), public.try_uuid((storage.foldername(name))[4])))
  and ((storage.foldername(name))[2] is distinct from 'reflections'
       or public.can_read_reflection_voice(public.try_uuid((storage.foldername(name))[3]), public.try_uuid((storage.foldername(name))[4])))
  and ((storage.foldername(name))[2] is distinct from 'questions'
       or public.can_read_question_voice(public.try_uuid((storage.foldername(name))[3]), public.try_uuid((storage.foldername(name))[4]))));

drop policy "couple members can upload their media" on storage.objects;
create policy "couple members can upload their media" on storage.objects for insert with check (
  bucket_id = 'memory-media'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] is distinct from 'sealed'
       or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
  and (coalesce((storage.foldername(name))[2], '') not in ('activity-responses', 'reflections', 'questions')
       or (storage.foldername(name))[4] = auth.uid()::text));

drop policy "couple members can update their media" on storage.objects;
create policy "couple members can update their media" on storage.objects for update using (
  bucket_id = 'memory-media'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] is distinct from 'sealed'
       or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
  and (coalesce((storage.foldername(name))[2], '') not in ('activity-responses', 'reflections', 'questions')
       or (storage.foldername(name))[4] = auth.uid()::text));

drop policy "couple members can delete their media" on storage.objects;
create policy "couple members can delete their media" on storage.objects for delete using (
  bucket_id = 'memory-media'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] is distinct from 'sealed'
       or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
  and (coalesce((storage.foldername(name))[2], '') not in ('activity-responses', 'reflections', 'questions')
       or (storage.foldername(name))[4] = auth.uid()::text));

commit;
