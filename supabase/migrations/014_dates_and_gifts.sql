-- 014: per-person welcome notes, important dates, sealed gifts
begin;

-- ===== a) Welcome notes, one per person (replaces 013's single column) =====
create table public.welcome_notes (
  couple_id  uuid not null references public.couples(id) on delete cascade,
  author_id  uuid not null references public.users(id),
  note       text not null check (char_length(note) <= 500),
  updated_at timestamptz default now(),
  primary key (couple_id, author_id)
);
alter table public.welcome_notes enable row level security;
create policy "members read welcome notes" on public.welcome_notes
  for select to authenticated using (public.is_couple_member(couple_id));
create policy "write own welcome note" on public.welcome_notes
  for insert to authenticated with check (author_id = auth.uid() and public.is_couple_member(couple_id));
create policy "update own welcome note" on public.welcome_notes
  for update to authenticated
  using (author_id = auth.uid() and public.is_couple_member(couple_id))
  with check (author_id = auth.uid() and public.is_couple_member(couple_id));
create policy "delete own welcome note" on public.welcome_notes
  for delete to authenticated using (author_id = auth.uid());
revoke all on public.welcome_notes from anon;

insert into public.welcome_notes (couple_id, author_id, note)
select id, welcome_note_by, welcome_note from public.couples
where welcome_note is not null and welcome_note_by is not null;

drop trigger if exists couples_stamp_welcome_note on public.couples;
drop function if exists public.stamp_welcome_note_author();
alter table public.couples drop column welcome_note, drop column welcome_note_by;
revoke update on public.couples from authenticated;
grant update (relationship_start) on public.couples to authenticated;

-- ===== b) Important dates =====
alter table public.important_dates
  add column person_id uuid references public.users(id),
  add column emoji text;
alter table public.important_dates drop constraint important_dates_type_check;
alter table public.important_dates add constraint important_dates_type_check
  check (type in ('birthday', 'custom'));  -- the anniversary comes from couples.relationship_start
alter table public.important_dates add constraint important_dates_birthday_person
  check ((type = 'birthday') = (person_id is not null));
create unique index important_dates_one_birthday_per_person
  on public.important_dates (couple_id, person_id) where type = 'birthday';

drop policy "couple members can manage important_dates" on public.important_dates;
create policy "members read dates" on public.important_dates
  for select to authenticated using (public.is_couple_member(couple_id));
create policy "members write dates" on public.important_dates
  for all to authenticated
  using (public.is_couple_member(couple_id))
  with check (
    public.is_couple_member(couple_id)
    and (person_id is null or exists (
      select 1 from public.couples c
      where c.id = important_dates.couple_id and person_id in (c.partner_one, c.partner_two)))
  );
revoke all on public.important_dates from anon;

-- ===== c) Sealed gifts (bottles) =====
alter table public.bottles
  add column kind  text not null default 'bottle' check (kind in ('bottle', 'birthday')),
  add column song  jsonb,
  add column media jsonb not null default '[]'::jsonb,
  alter column sender_id set not null,
  alter column recipient_id set not null;

drop policy "couple members can manage bottles" on public.bottles;
create policy "sender manages own bottles" on public.bottles
  for all to authenticated
  using (sender_id = auth.uid() and public.is_couple_member(couple_id))
  with check (
    sender_id = auth.uid() and public.is_couple_member(couple_id)
    and exists (select 1 from public.couples c
                where c.id = bottles.couple_id and bottles.recipient_id in (c.partner_one, c.partner_two))
  );
create policy "recipient reads unlocked bottles" on public.bottles
  for select to authenticated
  using (recipient_id = auth.uid() and public.is_couple_member(couple_id)
         and (unlock_at is null or unlock_at <= now()));
create policy "recipient opens unlocked bottles" on public.bottles
  for update to authenticated
  using (recipient_id = auth.uid() and public.is_couple_member(couple_id)
         and (unlock_at is null or unlock_at <= now()))
  with check (recipient_id = auth.uid());
revoke all on public.bottles from anon;

-- Anyone who isn't the sender may change opened_at and nothing else
create or replace function public.bottles_recipient_only_opened_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.sender_id is distinct from auth.uid()
     and (to_jsonb(new) - 'opened_at') is distinct from (to_jsonb(old) - 'opened_at') then
    raise exception 'recipients can only mark a bottle as opened';
  end if;
  return new;
end; $$;
revoke execute on function public.bottles_recipient_only_opened_at() from public, anon, authenticated;
create trigger bottles_recipient_only_opened_at
  before update on public.bottles
  for each row execute function public.bottles_recipient_only_opened_at();

-- "Something is waiting": count + earliest unlock of MY locked bottles, no content
create or replace function public.bottle_is_waiting(target_couple_id uuid)
returns table (waiting_count int, next_unlock_at timestamptz, kinds text[])
language sql stable security definer set search_path = public as $$
  select count(*)::int, min(b.unlock_at), coalesce(array_agg(distinct b.kind), '{}')
  from public.bottles b
  where b.couple_id = target_couple_id
    and b.recipient_id = auth.uid()
    and public.is_couple_member(target_couple_id)
    and b.unlock_at > now();
$$;
revoke execute on function public.bottle_is_waiting(uuid) from public, anon;
grant execute on function public.bottle_is_waiting(uuid) to authenticated;

-- Sealed media access (storage paths <couple_id>/sealed/<bottle_id>/...)
create or replace function public.can_read_sealed(target_bottle_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bottles b
    where b.id = target_bottle_id and public.is_couple_member(b.couple_id)
      and (b.sender_id = auth.uid()
           or (b.recipient_id = auth.uid() and (b.unlock_at is null or b.unlock_at <= now()))));
$$;
create or replace function public.can_write_sealed(target_bottle_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bottles b
    where b.id = target_bottle_id and b.sender_id = auth.uid() and public.is_couple_member(b.couple_id));
$$;
revoke execute on function public.can_read_sealed(uuid), public.can_write_sealed(uuid) from public, anon;
grant execute on function public.can_read_sealed(uuid), public.can_write_sealed(uuid) to authenticated;

-- Storage: non-sealed paths behave exactly as before
drop policy "couple members can read their media" on storage.objects;
create policy "couple members can read their media" on storage.objects
  for select using (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[2] is distinct from 'sealed'
         or public.can_read_sealed(((storage.foldername(name))[3])::uuid)));
drop policy "couple members can upload their media" on storage.objects;
create policy "couple members can upload their media" on storage.objects
  for insert with check (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[2] is distinct from 'sealed'
         or public.can_write_sealed(((storage.foldername(name))[3])::uuid)));
drop policy "couple members can update their media" on storage.objects;
create policy "couple members can update their media" on storage.objects
  for update using (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[2] is distinct from 'sealed'
         or public.can_write_sealed(((storage.foldername(name))[3])::uuid)));
drop policy "couple members can delete their media" on storage.objects;
create policy "couple members can delete their media" on storage.objects
  for delete using (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[2] is distinct from 'sealed'
         or public.can_write_sealed(((storage.foldername(name))[3])::uuid)));

commit;
