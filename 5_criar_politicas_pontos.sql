-- SQL 5: POLÍTICAS DE PONTOS (TIME ENTRIES)

drop policy if exists "Users can view own entries" on public.time_entries;
create policy "Users can view own entries"
  on public.time_entries for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own entries" on public.time_entries;
create policy "Users can insert own entries"
  on public.time_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admins can view company entries" on public.time_entries;
create policy "Admins can view company entries"
  on public.time_entries for select
  using (
    exists (
      select 1 from company_members as admin
      where admin.user_id = auth.uid() 
      and admin.role = 'admin'
      and admin.company_id = time_entries.company_id
    )
  );
