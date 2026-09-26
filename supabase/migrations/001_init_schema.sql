-- ============================================================
-- "Us" app — schema + Row Level Security
-- Run this once in the Supabase SQL editor.
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  partner_one uuid references public.users(id),
  partner_two uuid references public.users(id),
  relationship_start date not null,
  invite_code text unique,
  created_at timestamptz default now()
);

create table public.important_dates (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade,
  label text not null,
  date date not null,
  type text not null check (type in ('anniversary', 'birthday', 'custom')),
  created_at timestamptz default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade,
  title text not null,
  description text,
  memory_date date,
  location text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

create table public.memory_media (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid references public.memories(id) on delete cascade,
  media_type text not null check (media_type in ('photo', 'video', 'voice')),
  storage_path text not null,
  thumbnail_path text,
  duration_seconds int,
  caption text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

create table public.memory_reflections (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid references public.memories(id) on delete cascade,
  user_id uuid references public.users(id),
  text text not null,
  created_at timestamptz default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('romantic','funny','deep','adventure','memory','chaos','voice')),
  title text not null,
  description text not null,
  difficulty int default 1
);

create table public.daily_activities (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade,
  activity_id uuid references public.activities(id),
  activity_date date not null,
  created_at timestamptz default now()
);

create table public.activity_responses (
  id uuid primary key default gen_random_uuid(),
  daily_activity_id uuid references public.daily_activities(id) on delete cascade,
  user_id uuid references public.users(id),
  response text,
  media_url text,
  completed_at timestamptz
);

create table public.bottles (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade,
  sender_id uuid references public.users(id),
  recipient_id uuid references public.users(id),
  message text not null,
  unlock_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz default now()
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade,
  sender_id uuid references public.users(id),
  recipient_id uuid references public.users(id),
  mission_text text not null,
  category text,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table public.couple_world (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  chapter int default 1,
  unlocked_items jsonb default '[]',
  updated_at timestamptz default now()
);

-- ============================================================
-- HELPER FUNCTION — is the current user a member of this couple?
-- Reused across every RLS policy instead of repeating the join.
-- ============================================================

create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.couples c
    where c.id = target_couple_id
      and (c.partner_one = auth.uid() or c.partner_two = auth.uid())
  );
$$;

-- ============================================================
-- ENABLE RLS ON EVERYTHING
-- ============================================================

alter table public.users enable row level security;
alter table public.couples enable row level security;
alter table public.important_dates enable row level security;
alter table public.memories enable row level security;
alter table public.memory_media enable row level security;
alter table public.memory_reflections enable row level security;
alter table public.activities enable row level security;
alter table public.daily_activities enable row level security;
alter table public.activity_responses enable row level security;
alter table public.bottles enable row level security;
alter table public.missions enable row level security;
alter table public.couple_world enable row level security;

-- ============================================================
-- POLICIES
-- ============================================================

-- users: you can see/edit your own row, and your partner's row
create policy "users can view own row"
  on public.users for select
  using (id = auth.uid());

create policy "users can update own row"
  on public.users for update
  using (id = auth.uid());

create policy "users can insert own row"
  on public.users for insert
  with check (id = auth.uid());

-- couples: only the two partners can see/update their couple row
create policy "couple members can view couple"
  on public.couples for select
  using (partner_one = auth.uid() or partner_two = auth.uid());

create policy "creator can insert couple"
  on public.couples for insert
  with check (partner_one = auth.uid());

create policy "couple members can update couple"
  on public.couples for update
  using (partner_one = auth.uid() or partner_two = auth.uid());

-- important_dates
create policy "couple members can manage important_dates"
  on public.important_dates for all
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));

-- memories
create policy "couple members can manage memories"
  on public.memories for all
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));

-- memory_media (joins through memories to get couple_id)
create policy "couple members can manage memory_media"
  on public.memory_media for all
  using (
    exists (
      select 1 from public.memories m
      where m.id = memory_media.memory_id
        and is_couple_member(m.couple_id)
    )
  )
  with check (
    exists (
      select 1 from public.memories m
      where m.id = memory_media.memory_id
        and is_couple_member(m.couple_id)
    )
  );

-- memory_reflections
create policy "couple members can manage memory_reflections"
  on public.memory_reflections for all
  using (
    exists (
      select 1 from public.memories m
      where m.id = memory_reflections.memory_id
        and is_couple_member(m.couple_id)
    )
  )
  with check (
    exists (
      select 1 from public.memories m
      where m.id = memory_reflections.memory_id
        and is_couple_member(m.couple_id)
    )
  );

-- activities: static shared catalog, readable by any authenticated user
create policy "authenticated users can read activities"
  on public.activities for select
  using (auth.role() = 'authenticated');

-- daily_activities
create policy "couple members can manage daily_activities"
  on public.daily_activities for all
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));

-- activity_responses (joins through daily_activities)
create policy "couple members can manage activity_responses"
  on public.activity_responses for all
  using (
    exists (
      select 1 from public.daily_activities da
      where da.id = activity_responses.daily_activity_id
        and is_couple_member(da.couple_id)
    )
  )
  with check (
    exists (
      select 1 from public.daily_activities da
      where da.id = activity_responses.daily_activity_id
        and is_couple_member(da.couple_id)
    )
  );

-- bottles
create policy "couple members can manage bottles"
  on public.bottles for all
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));

-- missions
create policy "couple members can manage missions"
  on public.missions for all
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));

-- couple_world
create policy "couple members can manage couple_world"
  on public.couple_world for all
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));