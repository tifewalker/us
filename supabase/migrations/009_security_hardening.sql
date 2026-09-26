begin;

-- 1. Pin search_path on the membership helper
create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.couples c
    where c.id = target_couple_id
      and (c.partner_one = auth.uid() or c.partner_two = auth.uid())
  );
$$;

-- 2. Join via RPC instead of open policies
create or replace function public.join_couple(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.couples where partner_one = auth.uid() or partner_two = auth.uid()) then
    raise exception 'already in a couple';
  end if;
  update public.couples
     set partner_two = auth.uid(), invite_code = null
   where invite_code = upper(trim(code))   -- matches join-couple.tsx: code.trim().toUpperCase()
     and partner_two is null
     and partner_one <> auth.uid()
  returning id into v_id;
  if v_id is null then raise exception 'invalid or used invite code'; end if;
  return v_id;
end; $$;
revoke all on function public.join_couple(text) from public, anon;
grant execute on function public.join_couple(text) to authenticated;

drop policy if exists "authenticated users can view open invites" on public.couples;
drop policy if exists "authenticated users can join an open invite" on public.couples;

-- Creator can't pre-fill partner_two
drop policy if exists "creator can insert couple" on public.couples;
create policy "creator can insert couple" on public.couples
for insert with check (partner_one = auth.uid() and partner_two is null);

-- Members may only edit relationship_start directly (joins go through the RPC)
revoke update on public.couples from authenticated;
grant update (relationship_start) on public.couples to authenticated;

-- 3. Enforce simultaneous reveal in the database
create or replace function public.has_answered(target_daily_activity_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.activity_responses
                 where daily_activity_id = target_daily_activity_id and user_id = auth.uid());
$$;

create or replace function public.partner_has_answered(target_daily_activity_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.activity_responses r
    join public.daily_activities da on da.id = r.daily_activity_id
    where r.daily_activity_id = target_daily_activity_id
      and r.user_id <> auth.uid()
      and public.is_couple_member(da.couple_id)
  );
$$;

drop policy if exists "couple members can manage activity_responses" on public.activity_responses;

create policy "read own or revealed responses" on public.activity_responses
for select using (
  user_id = auth.uid()
  or (
    public.has_answered(daily_activity_id)
    and exists (select 1 from public.daily_activities da
                where da.id = activity_responses.daily_activity_id and public.is_couple_member(da.couple_id))
  )
);
create policy "insert own response" on public.activity_responses
for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.daily_activities da
              where da.id = activity_responses.daily_activity_id and public.is_couple_member(da.couple_id))
);
create policy "update own response" on public.activity_responses
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own response" on public.activity_responses
for delete using (user_id = auth.uid());

-- 4. One answer per person per activity
alter table public.activity_responses
  add constraint activity_responses_one_per_user unique (daily_activity_id, user_id);

-- 5. Required columns
alter table public.memories            alter column couple_id set not null;
alter table public.daily_activities    alter column couple_id set not null;
alter table public.important_dates     alter column couple_id set not null;
alter table public.bottles             alter column couple_id set not null;
alter table public.missions            alter column couple_id set not null;
alter table public.memory_media        alter column memory_id set not null;
alter table public.memory_reflections  alter column memory_id set not null;
alter table public.activity_responses  alter column daily_activity_id set not null;
alter table public.activity_responses  alter column user_id set not null;

commit;
