-- Documents live DB state. Already applied. Do not re-run.
-- RECONSTRUCTED on 2026-09-26 from supabase/live_schema_dump.json (original file was never saved).
--
-- How an activity expects to be answered. The dump doesn't include column
-- definitions or CHECK constraints, so the allowed values and default below
-- are INFERRED from the client (activity/today.tsx and CLAUDE.md), not copied
-- from live. Verify with:
--   select column_default, is_nullable from information_schema.columns
--    where table_name = 'activities' and column_name = 'response_type';
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.activities'::regclass and contype = 'c';

alter table public.activities
  add column response_type text not null default 'text'
  check (response_type in ('text', 'photo', 'voice'));
