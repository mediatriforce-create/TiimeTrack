-- SQL 12: CORRIGIR VISIBILIDADE DE PERFIS

-- O erro "Cannot read property id of null" acontece porque o Admin tenta buscar os dados do usuário (nome, email),
-- mas a política de segurança (RLS) atual impede que ele veja perfis que não sejam o dele.
-- Resultado: o banco retorna NULL para o perfil do funcionário, e o código quebra ao tentar ler o ID.

-- Solução: Permitir que usuários autenticados vejam perfis básicos (Nome, Email) de outros usuários.
-- Isso é necessário para que o Admin veja quem são seus funcionários.

drop policy if exists "Users can view own profile" on public.user_profiles;

create policy "Authenticated users can view all profiles"
  on public.user_profiles for select
  to authenticated
  using (true);

-- (A política de Update continua restrita apenas ao próprio usuário, garantida em scripts anteriores)
