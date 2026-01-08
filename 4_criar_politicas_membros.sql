-- SQL 4: POLÍTICAS DE MEMBROS (VÍNCULOS)

-- 1. Visualização
drop policy if exists "Users can view own memberships" on public.company_members;
create policy "Users can view own memberships"
  on public.company_members for select
  using (user_id = auth.uid());

drop policy if exists "Admins can view company members" on public.company_members;
create policy "Admins can view company members"
  on public.company_members for select
  using (
    exists (
      select 1 from company_members as requestor
      where requestor.user_id = auth.uid()
      and requestor.company_id = company_members.company_id
      and requestor.role = 'admin'
    )
  );

-- 2. Inserção / Edição
drop policy if exists "Users can insert own membership" on public.company_members;
create policy "Users can insert own membership"
  on public.company_members for insert
  with check (user_id = auth.uid());

drop policy if exists "Admins can update/delete members" on public.company_members;
create policy "Admins can update/delete members"
  on public.company_members for all
  using (
    exists (
      select 1 from company_members as requestor
      where requestor.user_id = auth.uid()
      and requestor.company_id = company_members.company_id
      and requestor.role = 'admin'
    )
  );
