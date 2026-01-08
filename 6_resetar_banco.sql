-- SQL 6: RESETAR BANCO DE DADOS
-- Use com cuidado! Apaga todos os dados das tabelas.

truncate table public.time_entries cascade;
truncate table public.company_members cascade;
truncate table public.user_profiles cascade;
truncate table public.companies cascade;

-- Observação:
-- Para limpar os usuários de Login (Authentication), você deve ir no Painel do Supabase.
-- Este script limpa apenas os dados de aplicação.
