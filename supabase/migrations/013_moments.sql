-- 013: special moments — welcome note, live reveal
begin;

-- 1. A note one partner leaves for the other (shown in "It all started here")
alter table public.couples
  add column if not exists welcome_note    text,
  add column if not exists welcome_note_by uuid references public.users(id);
alter table public.couples
  add constraint couples_welcome_note_length
  check (welcome_note is null or char_length(welcome_note) <= 500);

-- Members may edit only these columns directly (joins/creates still go
-- through the 009/010 RPCs; no INSERT, anon still has nothing)
revoke update on public.couples from authenticated;
grant update (relationship_start, welcome_note, welcome_note_by) on public.couples to authenticated;

-- welcome_note_by is always whoever changed the note — can't be spoofed
create or replace function public.stamp_welcome_note_author()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.welcome_note is distinct from old.welcome_note
     or new.welcome_note_by is distinct from old.welcome_note_by then
    new.welcome_note_by := case when new.welcome_note is null then null else auth.uid() end;
  end if;
  return new;
end; $$;
revoke execute on function public.stamp_welcome_note_author() from public, anon, authenticated;

create trigger couples_stamp_welcome_note
  before update on public.couples
  for each row execute function public.stamp_welcome_note_author();

-- 2. Live reveal: stream activity_responses changes (RLS still decides who
-- receives each row — a partner's answer only after you've answered)
alter publication supabase_realtime add table public.activity_responses;

commit;
