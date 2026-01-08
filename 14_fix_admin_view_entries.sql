-- SQL 14: CORRIGIR RLS PARA TIME_ENTRIES (ADMIN VIEW)

-- 1. Habilitar RLS (caso não esteja)
alter table public.time_entries enable row level security;

-- 2. Limpar políticas antigas para evitar conflitos
drop policy if exists "Users can view own entries" on public.time_entries;
drop policy if exists "Admins can view company entries" on public.time_entries;
drop policy if exists "Users can insert own entries" on public.time_entries;
drop policy if exists "Users can update own entries" on public.time_entries;

-- 3. Política: Usuários podem ver seus próprios registros
create policy "Users can view own entries"
  on public.time_entries for select
  using (auth.uid() = user_id);

-- 4. Política: Usuários podem inserir (bater ponto) para si mesmos
create policy "Users can insert own entries"
  on public.time_entries for insert
  with check (auth.uid() = user_id);

-- 5. Política: Admins podem VER E GERENCIAR registros da sua empresa
create policy "Admins can manage company entries"
  on public.time_entries for all
  using (
    exists (
      select 1 from public.company_members
      where user_id = auth.uid()
      and role = 'admin'
      and company_id = time_entries.company_id
    )
  );
