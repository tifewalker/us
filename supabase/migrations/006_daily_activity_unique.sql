-- Documents live DB state. Already applied. Do not re-run.
-- RECONSTRUCTED on 2026-09-26 from supabase/live_schema_dump.json (original file was never saved).
--
-- One daily activity per couple per day. getTodayActivity() relies on this:
-- if both partners open the screen at once, the loser's insert fails with
-- 23505 and it refetches the winner's row.
-- The dump only shows the unique index; it may have been created as a plain
-- unique index rather than a constraint — behaviour is identical.

alter table public.daily_activities
  add constraint daily_activities_couple_date_unique unique (couple_id, activity_date);
