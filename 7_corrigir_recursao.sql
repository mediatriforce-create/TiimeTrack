-- SQL 7: CORRIGIR RECURSÃO INFINITA (RLS)

-- O problema acontece porque a política consultava a própria tabela 'company_members' para checar permissão,
-- gerando um loop infinito (Recursion).
-- A solução é criar uma função "Security Definer" que checa a permissão ignorando o RLS.

create or replace function public.has_company_role(_company_id uuid, _role text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = _company_id
    and user_id = auth.uid()
    and role = _role
  );
$$;

-- Agora recriamos as políticas usando essa função segura.

-- 1. Limpar políticas antigas da tabela de membros
drop policy if exists "Admins can view company members" on public.company_members;
drop policy if exists "Admins can update/delete members" on public.company_members;
drop policy if exists "Users can view own memberships" on public.company_members;
drop policy if exists "Users can insert own membership" on public.company_members;

-- 2. Recriar Políticas Seguras

-- A) Ver membros
-- Quem pode ver? O próprio dono do vínculo OU um Admin daquela empresa.
create policy "View members (Self or Admin)"
  on public.company_members for select
  using (
    user_id = auth.uid() 
    or 
    public.has_company_role(company_id, 'admin')
  );

-- B) Inserir (Criar empresa ou Entrar)
-- Quem pode inserir? O próprio usuário se vinculando.
create policy "Insert membership (Self)"
  on public.company_members for insert
  with check (user_id = auth.uid());

-- C) Editar/Excluir
-- Apenas Admins podem alterar outros membros.
create policy "Manage members (Admin only)"
  on public.company_members for update
  using (public.has_company_role(company_id, 'admin'));

create policy "Delete members (Admin only)"
  on public.company_members for delete
  using (public.has_company_role(company_id, 'admin'));
