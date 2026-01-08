-- SQL 1: ESTRUTURA INICIAL (MULTI-EMPRESA)

-- 0. Limpeza (DROP) para garantir que a tabela seja criada do zero
drop table if exists public.time_entries cascade;
drop table if exists public.company_members cascade;
drop table if exists public.user_profiles cascade;
drop table if exists public.companies cascade;

-- 1. Tabela de Empresas
create table public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabela de Perfis de Usuário (Dados Pessoais)
create table public.user_profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabela de Membros (Vínculo Usuário <-> Empresa)
create table public.company_members (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  role text check (role in ('admin', 'employee')) not null,
  work_hours varchar(20) default '08:00',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, company_id)
);

-- 4. Tabela de Pontos (Time Entries)
create table public.time_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.user_profiles(id) not null,
  company_id uuid references public.companies(id) not null,
  event_type text check (event_type in ('entry', 'pause', 'return', 'exit')) not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
