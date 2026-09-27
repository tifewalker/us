-- 022: anniversary mode + "Our year" recap.
--
--   * anniversary_answers — "Where should our next chapter take us?", one per
--     person per anniversary year; text OR voice; reveal enforced exactly like
--     question_answers (017): read your own, your partner's only once you've
--     answered. In Realtime so the envelope opens live.
--   * anniversary_views — "I opened the recap for year N" (own rows only);
--     notify-scheduled uses it for the 19:30 "Your year together is ready" note.
--   * voice files at <couple_id>/anniversary/<year>/<user_id>/… with the 018
--     storage lock (uploader, or the partner once they've answered that year).
-- Recap stats are computed on the fly (lib/stats.ts) — no cache table.
-- Year stones live in couple_world.unlocked_items (existing, members-only).
begin;

-- 1. answers ----------------------------------------------------------------------
create table public.anniversary_answers (
  couple_id        uuid not null references public.couples(id) on delete cascade,
  anniversary_year int  not null check (anniversary_year between 1 and 200),
  user_id          uuid not null references public.users(id) on delete cascade,
  answer           text check (answer is null or char_length(answer) <= 1000),
  voice            jsonb check (voice is null or (jsonb_typeof(voice) = 'object' and voice ? 'storage_path')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (couple_id, anniversary_year, user_id),
  constraint anniversary_answers_text_or_voice check (nullif(btrim(coalesce(answer, '')), '') is not null or voice is not null)
);
alter table public.anniversary_answers enable row level security;

create or replace function public.has_answered_anniversary(target_couple_id uuid, target_year int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.anniversary_answers
                 where couple_id = target_couple_id and anniversary_year = target_year and user_id = auth.uid());
$$;

-- "Has my partner answered year N?" — a boolean only (their row stays hidden).
create or replace function public.partner_has_answered_anniversary(target_year int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.anniversary_answers a
    join public.couples c on c.id = a.couple_id
    where a.anniversary_year = target_year
      and a.user_id <> auth.uid()
      and (c.partner_one = auth.uid() or c.partner_two = auth.uid()));
$$;

-- storage lock for <couple>/anniversary/<year>/<uploader>/…
create or replace function public.can_read_anniversary_voice(target_couple_id uuid, year_segment text, uploader_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_couple_id is not null and uploader_id is not null and year_segment ~ '^[0-9]{1,3}$'
     and (uploader_id = auth.uid()
          or (public.is_couple_member(target_couple_id)
              and public.has_answered_anniversary(target_couple_id, year_segment::int)));
$$;

revoke execute on function public.has_answered_anniversary(uuid, int), public.partner_has_answered_anniversary(int),
  public.can_read_anniversary_voice(uuid, text, uuid) from public, anon;
grant execute on function public.has_answered_anniversary(uuid, int), public.partner_has_answered_anniversary(int),
  public.can_read_anniversary_voice(uuid, text, uuid) to authenticated;

create policy "read own or revealed anniversary answers" on public.anniversary_answers for select to authenticated
  using (user_id = auth.uid()
         or (public.is_couple_member(couple_id) and public.has_answered_anniversary(couple_id, anniversary_year)));
create policy "answer the anniversary myself" on public.anniversary_answers for insert to authenticated
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "edit my anniversary answer" on public.anniversary_answers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "delete my anniversary answer" on public.anniversary_answers for delete to authenticated
  using (user_id = auth.uid());

alter publication supabase_realtime add table public.anniversary_answers;

-- 2. "I watched our year" -----------------------------------------------------------
create table public.anniversary_views (
  user_id          uuid not null default auth.uid() references public.users(id) on delete cascade,
  couple_id        uuid not null references public.couples(id) on delete cascade,
  anniversary_year int  not null check (anniversary_year between 1 and 200),
  opened_at        timestamptz not null default now(),
  primary key (user_id, couple_id, anniversary_year)
);
alter table public.anniversary_views enable row level security;
create policy "own views: read" on public.anniversary_views for select to authenticated using (user_id = auth.uid());
create policy "own views: add" on public.anniversary_views for insert to authenticated
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- 3. storage: rebuild the four policies with the anniversary folder added -----------
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
       or public.can_read_question_voice(public.try_uuid((storage.foldername(name))[3]), public.try_uuid((storage.foldername(name))[4])))
  and ((storage.foldername(name))[2] is distinct from 'anniversary'
       or public.can_read_anniversary_voice(public.try_uuid((storage.foldername(name))[1]), (storage.foldername(name))[3], public.try_uuid((storage.foldername(name))[4]))));

drop policy "couple members can upload their media" on storage.objects;
create policy "couple members can upload their media" on storage.objects for insert with check (
  bucket_id = 'memory-media'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] is distinct from 'sealed'
       or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
  and (coalesce((storage.foldername(name))[2], '') not in ('activity-responses', 'reflections', 'questions', 'anniversary')
       or (storage.foldername(name))[4] = auth.uid()::text)
  and ((storage.foldername(name))[2] is distinct from 'avatars'
       or (storage.foldername(name))[3] = auth.uid()::text));

drop policy "couple members can update their media" on storage.objects;
create policy "couple members can update their media" on storage.objects for update using (
  bucket_id = 'memory-media'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] is distinct from 'sealed'
       or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
  and (coalesce((storage.foldername(name))[2], '') not in ('activity-responses', 'reflections', 'questions', 'anniversary')
       or (storage.foldername(name))[4] = auth.uid()::text)
  and ((storage.foldername(name))[2] is distinct from 'avatars'
       or (storage.foldername(name))[3] = auth.uid()::text));

drop policy "couple members can delete their media" on storage.objects;
create policy "couple members can delete their media" on storage.objects for delete using (
  bucket_id = 'memory-media'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] is distinct from 'sealed'
       or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
  and (coalesce((storage.foldername(name))[2], '') not in ('activity-responses', 'questions', 'anniversary')
       or (storage.foldername(name))[4] = auth.uid()::text)
  and ((storage.foldername(name))[2] is distinct from 'avatars'
       or (storage.foldername(name))[3] = auth.uid()::text));

commit;
