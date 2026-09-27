-- 012: music — memory songs, song-type activities, "our song today"
begin;

-- 1. A song on a memory, and song answers to activities
alter table public.memories add column if not exists song jsonb;
alter table public.activity_responses add column if not exists song jsonb;

alter table public.activities drop constraint activities_response_type_check;
alter table public.activities add constraint activities_response_type_check
  check (response_type = any (array['text','photo','video','voice','song']));

-- 2. Our song today: one pick per couple per day (first one wins)
create table public.daily_songs (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  song_date   date not null,
  picked_by   uuid not null references public.users(id),
  song        jsonb not null,
  note        text,
  created_at  timestamptz default now(),
  constraint daily_songs_couple_date_unique unique (couple_id, song_date)
);

create table public.song_listens (
  daily_song_id uuid not null references public.daily_songs(id) on delete cascade,
  user_id       uuid not null references public.users(id),
  listened_at   timestamptz default now(),
  primary key (daily_song_id, user_id)
);

alter table public.daily_songs  enable row level security;
alter table public.song_listens enable row level security;

create policy "members read daily songs" on public.daily_songs
  for select to authenticated using (public.is_couple_member(couple_id));
create policy "members pick today's song" on public.daily_songs
  for insert to authenticated
  with check (picked_by = auth.uid() and public.is_couple_member(couple_id));
create policy "picker updates own pick" on public.daily_songs
  for update to authenticated
  using (picked_by = auth.uid() and public.is_couple_member(couple_id))
  with check (picked_by = auth.uid() and public.is_couple_member(couple_id));
create policy "picker deletes own pick" on public.daily_songs
  for delete to authenticated using (picked_by = auth.uid());

create policy "members read listens" on public.song_listens
  for select to authenticated using (exists (
    select 1 from public.daily_songs ds
    where ds.id = song_listens.daily_song_id and public.is_couple_member(ds.couple_id)));
create policy "mark own listen" on public.song_listens
  for insert to authenticated with check (user_id = auth.uid() and exists (
    select 1 from public.daily_songs ds
    where ds.id = song_listens.daily_song_id and public.is_couple_member(ds.couple_id)));
create policy "unmark own listen" on public.song_listens
  for delete to authenticated using (user_id = auth.uid());

-- Signed-in users only (same rule as 011)
revoke all on public.daily_songs, public.song_listens from anon;

-- 3. Five song prompts (skips any that already exist)
insert into public.activities (category, title, description, response_type)
select v.category, v.title, v.description, 'song'
from (values
  ('romantic', 'Pick a song that describes your day',                  'Sweet, chaotic or sleepy — whatever today sounded like.'),
  ('romantic', 'Send the song that reminds you of us',                 'The one that comes on and you think of them.'),
  ('funny',    'What song would play if we were in a movie right now?', 'Soundtrack this exact moment.'),
  ('deep',     'A song you''ve never shown me but think I''d love',     'Something from your own corner of music.'),
  ('funny',    'The song you''d play on our next road trip',            'Windows down, volume up.')
) as v(category, title, description)
where not exists (select 1 from public.activities a where a.title = v.title);

commit;
