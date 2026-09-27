-- 020: the rest of the Us tab (how we met, favorites, little things, bucket
-- list) + profile photos. Same pattern as everything else: RLS on, members
-- via is_couple_member(), and anything "only mine" checked against auth.uid().
begin;

-- 1. How we met — one story per couple --------------------------------------
create table public.couple_story (
  couple_id  uuid primary key references public.couples(id) on delete cascade,
  story      text not null default '' check (char_length(story) <= 5000),
  photo_path text,                                   -- <couple>/story/<file>
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.couple_story enable row level security;
create policy "members read the story" on public.couple_story for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "members start the story" on public.couple_story for insert to authenticated
  with check (public.is_couple_member(couple_id) and updated_by = auth.uid());
create policy "members edit the story" on public.couple_story for update to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id) and updated_by = auth.uid());

-- 2. Our favorites --------------------------------------------------------------
create table public.couple_favorites (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  kind       text not null check (kind in ('song', 'place', 'food', 'film', 'show', 'dessert', 'custom')),
  label      text not null check (char_length(btrim(label)) between 1 and 60),
  value      text check (char_length(value) <= 200),
  song       jsonb check (song is null or jsonb_typeof(song) = 'object'),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (couple_id, kind, label)
);
alter table public.couple_favorites enable row level security;
create policy "members read favorites" on public.couple_favorites for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "members add favorites" on public.couple_favorites for insert to authenticated
  with check (public.is_couple_member(couple_id) and updated_by = auth.uid());
create policy "members edit favorites" on public.couple_favorites for update to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id) and updated_by = auth.uid());
create policy "members remove favorites" on public.couple_favorites for delete to authenticated
  using (public.is_couple_member(couple_id));

-- 3. Little things about me — members read, only the owner writes ---------------
create table public.personal_favorites (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  label      text not null check (char_length(btrim(label)) between 1 and 60),
  value      text not null check (char_length(value) <= 200),
  updated_at timestamptz not null default now(),
  unique (couple_id, user_id, label)
);
alter table public.personal_favorites enable row level security;
create policy "members read little things" on public.personal_favorites for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "owner adds little things" on public.personal_favorites for insert to authenticated
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "owner edits little things" on public.personal_favorites for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "owner removes little things" on public.personal_favorites for delete to authenticated
  using (user_id = auth.uid());

-- 4. Bucket list ----------------------------------------------------------------
create table public.bucket_items (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  emoji       text check (char_length(emoji) <= 32),
  target_date date,
  created_by  uuid not null default auth.uid() references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  done_at     timestamptz,
  done_by     uuid references public.users(id) on delete set null,
  memory_id   uuid references public.memories(id) on delete set null
);
create index bucket_items_couple_idx on public.bucket_items (couple_id, created_at);
alter table public.bucket_items enable row level security;

-- done_by must be one of the two of us; a linked memory must be ours.
create or replace function public.bucket_item_refs_ok(target_couple_id uuid, doer uuid, linked_memory uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (doer is null or exists (select 1 from public.couples c
                                  where c.id = target_couple_id and doer in (c.partner_one, c.partner_two)))
     and (linked_memory is null or exists (select 1 from public.memories m
                                           where m.id = linked_memory and m.couple_id = target_couple_id));
$$;
revoke execute on function public.bucket_item_refs_ok(uuid, uuid, uuid) from public, anon;
grant execute on function public.bucket_item_refs_ok(uuid, uuid, uuid) to authenticated;

create policy "members read the bucket list" on public.bucket_items for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "members add to the bucket list" on public.bucket_items for insert to authenticated
  with check (public.is_couple_member(couple_id) and created_by = auth.uid()
              and public.bucket_item_refs_ok(couple_id, done_by, memory_id));
create policy "members update the bucket list" on public.bucket_items for update to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id) and public.bucket_item_refs_ok(couple_id, done_by, memory_id));
create policy "members remove from the bucket list" on public.bucket_items for delete to authenticated
  using (public.is_couple_member(couple_id));

-- 5. Profile photos ---------------------------------------------------------------
-- <couple_id>/avatars/<user_id>/<file>. Reading is already covered by the
-- general "members read" storage policy; upload/update/delete join the
-- own-folder list (like activity-responses / reflections / questions).
alter table public.users add column avatar_path text;

drop policy "couple members can upload their media" on storage.objects;
create policy "couple members can upload their media" on storage.objects for insert with check (
  bucket_id = 'memory-media'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] is distinct from 'sealed'
       or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
  and (coalesce((storage.foldername(name))[2], '') not in ('activity-responses', 'reflections', 'questions')
       or (storage.foldername(name))[4] = auth.uid()::text)
  and ((storage.foldername(name))[2] is distinct from 'avatars'
       or (storage.foldername(name))[3] = auth.uid()::text));

drop policy "couple members can update their media" on storage.objects;
create policy "couple members can update their media" on storage.objects for update using (
  bucket_id = 'memory-media'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] is distinct from 'sealed'
       or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
  and (coalesce((storage.foldername(name))[2], '') not in ('activity-responses', 'reflections', 'questions')
       or (storage.foldername(name))[4] = auth.uid()::text)
  and ((storage.foldername(name))[2] is distinct from 'avatars'
       or (storage.foldername(name))[3] = auth.uid()::text));

drop policy "couple members can delete their media" on storage.objects;
create policy "couple members can delete their media" on storage.objects for delete using (
  bucket_id = 'memory-media'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] is distinct from 'sealed'
       or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
  and (coalesce((storage.foldername(name))[2], '') not in ('activity-responses', 'questions')
       or (storage.foldername(name))[4] = auth.uid()::text)
  and ((storage.foldername(name))[2] is distinct from 'avatars'
       or (storage.foldername(name))[3] = auth.uid()::text));

commit;
