-- Documents live DB state. Already applied. Do not re-run.
-- RECONSTRUCTED on 2026-09-26 from supabase/live_schema_dump.json (original file was never saved).
--
-- Creates the public.users row server-side on sign-up. Client-side insert
-- right after signUp() failed RLS because the client isn't authenticated yet.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.users (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'New user'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
