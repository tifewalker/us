-- 019: let a deleted memory's Two-perspectives voice notes be cleaned up
--
-- Problem: reflections/<memory>/<user>/… voice files are readable by the
-- partner only after they've written their own side (018). Deleting a memory
-- deletes its memory_reflections rows, but the partner's *unrevealed* voice
-- file stays behind: the deleter can't see it (Storage's delete needs SELECT
-- too), and direct DELETEs on storage.objects are blocked by Supabase.
--
-- Fix: once the memory row no longer exists, its leftover reflection voice
-- files become readable + deletable by either member of the couple, so the
-- app's post-delete sweep (lib/memories.ts → sweepReflectionVoices) removes
-- them. While the memory exists nothing changes. The only "leak" would be
-- deleting the whole memory for both of you just to hear an unrevealed side.
begin;

create or replace function public.can_read_reflection_voice(target_memory_id uuid, uploader_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_memory_id is not null and uploader_id is not null
     and (uploader_id = auth.uid()
          -- memory deleted → leftovers are cleanup-only (the storage policy
          -- still requires couple membership via the first folder)
          or not exists (select 1 from public.memories m where m.id = target_memory_id)
          or exists (select 1 from public.memories m
                     where m.id = target_memory_id and public.is_couple_member(m.couple_id)
                       and public.has_reflected(target_memory_id)));
$$;

-- Delete: reflections are no longer limited to your own <user_id> folder
-- (you can only delete what you can read, i.e. revealed sides or leftovers
-- of a deleted memory). Upload/update keep the own-folder rule.
drop policy "couple members can delete their media" on storage.objects;
create policy "couple members can delete their media" on storage.objects for delete using (
  bucket_id = 'memory-media'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] is distinct from 'sealed'
       or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
  and (coalesce((storage.foldername(name))[2], '') not in ('activity-responses', 'questions')
       or (storage.foldername(name))[4] = auth.uid()::text));

commit;
