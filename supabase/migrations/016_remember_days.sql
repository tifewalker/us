-- 016: one shared "Remember when…" pick per couple per day
begin;

create table public.remember_days (
  couple_id  uuid not null references public.couples(id) on delete cascade,
  day        date not null,
  memory_id  uuid not null references public.memories(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (couple_id, day)
);
alter table public.remember_days enable row level security;

create policy "members read remember days" on public.remember_days
  for select to authenticated using (public.is_couple_member(couple_id));
create policy "members pick today" on public.remember_days
  for insert to authenticated
  with check (
    public.is_couple_member(couple_id)
    and exists (select 1 from public.memories m
                where m.id = remember_days.memory_id and m.couple_id = remember_days.couple_id)
  );
-- no update / delete policies: a day's pick is final
revoke all on public.remember_days from anon;

commit;
