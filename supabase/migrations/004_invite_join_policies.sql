-- Documents live DB state. Already applied. Do not re-run.
-- RECONSTRUCTED on 2026-09-26 from supabase/live_schema_dump.json (original file was never saved).
--
-- Lets a not-yet-member find and claim an open invite. Setting invite_code
-- back to null on join closes both policies again.
-- NOTE: superseded by 009_security_hardening.sql (join_couple RPC), which drops both.

create policy "authenticated users can view open invites"
  on public.couples for select
  using (invite_code is not null);

create policy "authenticated users can join an open invite"
  on public.couples for update
  using (invite_code is not null and partner_two is null)
  with check (partner_two = auth.uid());
