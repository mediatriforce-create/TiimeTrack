-- SQL 3: POLÍTICAS BÁSICAS (PERFIS E EMPRESAS)

-- 1. USER PROFILES
drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

-- 2. COMPANIES
drop policy if exists "Authenticated users can create companies" on public.companies;
create policy "Authenticated users can create companies"
  on public.companies for insert
  to authenticated
  with check (true);

drop policy if exists "Users can view their companies" on public.companies;
create policy "Users can view their companies"
  on public.companies for select
  using (
    exists (
      select 1 from company_members
      where company_members.company_id = companies.id
      and company_members.user_id = auth.uid()
    )
  );

drop policy if exists "Authenticated can select companies by ID" on public.companies;
create policy "Authenticated can select companies by ID"
  on public.companies for select
  to authenticated
  using (true);
