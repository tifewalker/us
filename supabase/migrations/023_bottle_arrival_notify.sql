-- 023: notify the moment a bottle arrives.
--
-- Until now only "Open when…" letters triggered an instant notification;
-- ordinary bottles relied on notify-scheduled (every 10 min), which only
-- notifies about UNOPENED bottles — so a bottle sent "Now" and opened within
-- a few minutes never notified anyone (found 2026-09-27).
--
-- Now the trigger also fires for kind 'bottle'; notify-event sends
-- "Something washed ashore for you 🌊" right away when unlock_at has already
-- passed (sent "Now"). Later arrivals are still handled by notify-scheduled —
-- both use kind bottle_arrived + ref = bottle id, so notification_log makes
-- sure it's only ever sent once. Birthday gifts stay sealed (not included).
begin;

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
    if NEW.kind not in ('open_when', 'bottle') then return NEW; end if;
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

commit;
