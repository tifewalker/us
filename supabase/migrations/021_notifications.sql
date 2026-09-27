-- 021: notifications via Web Push (the installed iPhone web app).
--
--   * push_subscriptions  — one row per browser/device subscription (own rows only)
--   * notification_prefs  — per-person categories, quiet hours, nudge cap (own row only)
--   * notification_log    — what was sent (dedupe: unique user+kind+ref; caps)
--   * notification_queue  — events that arrived during quiet hours (service only)
--   * users.timezone / users.last_seen_at — set by the app on open/focus
--   * triggers → pg_net → Edge Function notify-event (shared secret from Vault)
--   * pg_cron every 10 min → Edge Function notify-scheduled
--
-- Vault secrets (created once OUTSIDE this file, so no secret is in git):
--   notify_url    = https://<project-ref>.supabase.co
--   notify_secret = long random string (functions check it via check_notify_secret)
begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- 1. users: where and when -----------------------------------------------------
alter table public.users
  add column timezone text check (timezone is null or char_length(timezone) between 1 and 64),
  add column last_seen_at timestamptz;

-- 2. push subscriptions ----------------------------------------------------------
create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.users(id) on delete cascade,
  endpoint        text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh          text not null check (char_length(p256dh) <= 200),
  auth            text not null check (char_length(auth) <= 100),
  user_agent      text check (char_length(user_agent) <= 400),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "own subscriptions: read" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own subscriptions: add" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "own subscriptions: update" on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own subscriptions: remove" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- Save (or re-save) this device's subscription for ME. If the same browser was
-- subscribed by the other account before (signed out / in on one phone), the
-- device now belongs to me — RLS alone couldn't take the endpoint over.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> auth.uid();
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 400))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- 3. preferences -------------------------------------------------------------------
create table public.notification_prefs (
  user_id          uuid primary key references public.users(id) on delete cascade,
  partner_activity boolean not null default true,
  bottles_gifts    boolean not null default true,
  dates            boolean not null default true,
  remember         boolean not null default true,
  nudges           boolean not null default true,
  quiet_start      time not null default '23:00',
  quiet_end        time not null default '08:00',
  daily_nudge_cap  int not null default 2 check (daily_nudge_cap between 0 and 10),
  updated_at       timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
create policy "own prefs: read" on public.notification_prefs for select to authenticated using (user_id = auth.uid());
create policy "own prefs: add" on public.notification_prefs for insert to authenticated with check (user_id = auth.uid());
create policy "own prefs: update" on public.notification_prefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4. log (dedupe + caps) and quiet-hours queue — written only by the functions --------
create table public.notification_log (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind    text not null,
  ref_id  text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
create index notification_log_user_sent_idx on public.notification_log (user_id, sent_at desc);
alter table public.notification_log enable row level security;
create policy "own log: read" on public.notification_log for select to authenticated using (user_id = auth.uid());

create table public.notification_queue (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  kind       text not null,
  ref_id     text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
alter table public.notification_queue enable row level security; -- no policies: service role only

-- 5. calling the functions from the database ---------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- POST {body} to <notify_url>/functions/v1/<fn> with the shared secret. Never
-- raises: a notification problem must not break the insert that caused it.
create or replace function private.notify_post(fn text, body jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  base text;
  secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'notify_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'notify_secret';
  if base is null or secret is null then return; end if;
  perform net.http_post(
    url := base || '/functions/v1/' || fn,
    body := body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
    timeout_milliseconds := 8000
  );
exception when others then
  raise warning 'notify_post(%) failed: %', fn, sqlerrm;
end;
$$;
revoke execute on function private.notify_post(text, jsonb) from public, anon, authenticated;

-- The functions (service role) check the header against Vault with this.
create or replace function public.check_notify_secret(candidate text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'notify_secret' and decrypted_secret = candidate);
$$;
revoke execute on function public.check_notify_secret(text) from public, anon, authenticated;
grant execute on function public.check_notify_secret(text) to service_role;

-- One trigger function for every event. It sends only ids — never answer
-- text, bottle text or titles; the function reads what it needs itself.
create or replace function private.on_notify_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  body jsonb;
begin
  if TG_TABLE_NAME = 'question_answers' then
    body := jsonb_build_object('table', TG_TABLE_NAME, 'thread_id', NEW.thread_id, 'user_id', NEW.user_id);
  elsif TG_TABLE_NAME = 'missions' then
    if OLD.completed_at is not null or NEW.completed_at is null then return NEW; end if;
    body := jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id);
  elsif TG_TABLE_NAME = 'bottles' then
    if NEW.kind <> 'open_when' then return NEW; end if;
    body := jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id);
  else
    body := jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id);
  end if;
  perform private.notify_post('notify-event', body);
  return NEW;
exception when others then
  raise warning 'on_notify_event(%) failed: %', TG_TABLE_NAME, sqlerrm;
  return NEW;
end;
$$;
revoke execute on function private.on_notify_event() from public, anon, authenticated;

create trigger notify_activity_response after insert on public.activity_responses for each row execute function private.on_notify_event();
create trigger notify_question_thread  after insert on public.question_threads   for each row execute function private.on_notify_event();
create trigger notify_question_answer  after insert on public.question_answers   for each row execute function private.on_notify_event();
create trigger notify_daily_song       after insert on public.daily_songs        for each row execute function private.on_notify_event();
create trigger notify_memory           after insert on public.memories           for each row execute function private.on_notify_event();
create trigger notify_reflection       after insert on public.memory_reflections for each row execute function private.on_notify_event();
create trigger notify_mission_done     after update of completed_at on public.missions for each row execute function private.on_notify_event();
create trigger notify_open_when        after insert on public.bottles            for each row execute function private.on_notify_event();

-- 6. every 10 minutes: scheduled notifications + flush the quiet-hours queue ---------
select cron.schedule('notify-scheduled', '*/10 * * * *', $$ select private.notify_post('notify-scheduled', '{}'::jsonb) $$);

commit;
