-- 015: bottles in the ocean (+ open-when), two perspectives, remember when
begin;

-- ===== a) Bottles: open-when letters =====
alter table public.bottles drop constraint bottles_kind_check;
alter table public.bottles add constraint bottles_kind_check
  check (kind in ('bottle', 'birthday', 'open_when'));
alter table public.bottles add column open_when_label text;
alter table public.bottles add constraint bottles_open_when_label
  check ((kind = 'open_when') = (open_when_label is not null)
         and (open_when_label is null or char_length(open_when_label) <= 60));
alter table public.bottles add constraint bottles_open_when_no_unlock
  check (kind <> 'open_when' or unlock_at is null);
-- (014's policies, trigger and sealed-storage rules are keyed on sender/recipient/
--  unlock_at, not kind — so they already cover open_when.)

drop function public.bottle_is_waiting(uuid);
create function public.bottle_is_waiting(target_couple_id uuid)
returns table (
  waiting_count int, next_unlock_at timestamptz, kinds text[],
  birthday_waiting int, next_birthday_unlock_at timestamptz,
  bottles_in_transit int
)
language sql stable security definer set search_path = public as $$
  select
    count(*)::int,
    min(b.unlock_at),
    coalesce(array_agg(distinct b.kind), '{}'),
    (count(*) filter (where b.kind = 'birthday'))::int,
    min(b.unlock_at) filter (where b.kind = 'birthday'),
    (count(*) filter (where b.kind = 'bottle'))::int
  from public.bottles b
  where b.couple_id = target_couple_id
    and b.recipient_id = auth.uid()
    and public.is_couple_member(target_couple_id)
    and b.unlock_at > now();
$$;
revoke execute on function public.bottle_is_waiting(uuid) from public, anon;
grant execute on function public.bottle_is_waiting(uuid) to authenticated;

-- ===== b) Two perspectives (memory_reflections) =====
alter table public.memory_reflections
  alter column user_id set not null,
  add column updated_at timestamptz default now(),
  add constraint memory_reflections_one_per_user unique (memory_id, user_id),
  add constraint memory_reflections_text_length check (char_length(text) <= 2000);

create or replace function public.has_reflected(target_memory_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memory_reflections
                 where memory_id = target_memory_id and user_id = auth.uid());
$$;
create or replace function public.partner_has_reflected(target_memory_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memory_reflections r
    join public.memories m on m.id = r.memory_id
    where r.memory_id = target_memory_id
      and r.user_id <> auth.uid()
      and public.is_couple_member(m.couple_id));
$$;
revoke execute on function public.has_reflected(uuid), public.partner_has_reflected(uuid) from public, anon;
grant execute on function public.has_reflected(uuid), public.partner_has_reflected(uuid) to authenticated;

drop policy "couple members can manage memory_reflections" on public.memory_reflections;
create policy "read own or revealed reflections" on public.memory_reflections
  for select to authenticated using (
    user_id = auth.uid()
    or (public.has_reflected(memory_id) and exists (
          select 1 from public.memories m
          where m.id = memory_reflections.memory_id and public.is_couple_member(m.couple_id))));
create policy "write own reflection" on public.memory_reflections
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.memories m
      where m.id = memory_reflections.memory_id and public.is_couple_member(m.couple_id)));
create policy "update own reflection" on public.memory_reflections
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
      select 1 from public.memories m
      where m.id = memory_reflections.memory_id and public.is_couple_member(m.couple_id)));
create policy "delete own reflection" on public.memory_reflections
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.memory_reflections from anon;

alter publication supabase_realtime add table public.memory_reflections;

-- ===== c) Remember when =====
create table public.remember_hearts (
  memory_id      uuid not null references public.memories(id) on delete cascade,
  user_id        uuid not null references public.users(id),
  remembered_on  date not null,
  created_at     timestamptz default now(),
  primary key (memory_id, user_id, remembered_on)
);
alter table public.remember_hearts enable row level security;
create policy "members read hearts" on public.remember_hearts
  for select to authenticated using (exists (
    select 1 from public.memories m
    where m.id = remember_hearts.memory_id and public.is_couple_member(m.couple_id)));
create policy "heart own" on public.remember_hearts
  for insert to authenticated with check (user_id = auth.uid() and exists (
    select 1 from public.memories m
    where m.id = remember_hearts.memory_id and public.is_couple_member(m.couple_id)));
create policy "unheart own" on public.remember_hearts
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.remember_hearts from anon;

commit;
