-- 008: partners can read each other's users row (and nobody else's)
drop policy if exists "partners can view each other" on public.users;
create policy "partners can view each other" on public.users
for select using (
  exists (
    select 1 from public.couples c
    where (c.partner_one = auth.uid() and c.partner_two = users.id)
       or (c.partner_two = auth.uid() and c.partner_one = users.id)
  )
);
