-- 010: pairing hardening
-- Before this, nothing stopped one user from owning several couples (double-tapping
-- "Create Our World", or creating after already joining). getMyCouple() uses
-- .maybeSingle(), so a second row makes it throw and the tabs guard breaks.
begin;

-- 1. At most one couple per user, per side (partial: open invites have partner_two null)
create unique index if not exists couples_partner_one_unique on public.couples (partner_one);
create unique index if not exists couples_partner_two_unique on public.couples (partner_two)
  where partner_two is not null;

-- 2. Create via RPC: refuses if already paired, generates the code server-side
create or replace function public.create_couple(start_date date)
returns public.couples language plpgsql security definer set search_path = public as $$
declare
  v_words text[] := array['BLUE','OCEAN','CORAL','SUNSET','PALM','WAVE','STAR','BEACH'];
  v_row public.couples;
  v_constraint text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  -- Serialises create/join for this user, so the "already in a couple" check can't race
  perform pg_advisory_xact_lock(hashtext('couple:' || auth.uid()::text));
  if exists (select 1 from public.couples where partner_one = auth.uid() or partner_two = auth.uid()) then
    raise exception 'already in a couple';
  end if;
  loop
    begin
      insert into public.couples (partner_one, relationship_start, invite_code)
      values (
        auth.uid(),
        start_date,
        v_words[1 + floor(random() * 8)::int] || '-' || v_words[1 + floor(random() * 8)::int]
          || '-' || (1000 + floor(random() * 9000)::int)::text
      )
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      -- invite_code collision: try another code. Any other unique violation is a real error.
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'couples_invite_code_key' then raise; end if;
    end;
  end loop;
end; $$;
revoke all on function public.create_couple(date) from public, anon;
grant execute on function public.create_couple(date) to authenticated;

-- 3. join_couple: same logic as 009, plus the per-user lock
create or replace function public.join_couple(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext('couple:' || auth.uid()::text));
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

-- 4. Couples rows are only created through create_couple()
drop policy if exists "creator can insert couple" on public.couples;
revoke insert on public.couples from authenticated;

-- 5. anon never needs couples (it still had full UPDATE/INSERT grants; RLS blocked it, but tidy up)
revoke all on public.couples from anon;

-- 6. Duplicate of 008's "partners can view each other" (same condition, not in any migration file)
drop policy if exists "couple members can view partner row" on public.users;

commit;
