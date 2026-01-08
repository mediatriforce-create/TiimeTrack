-- SQL 2: HABILITAR SEGURANÇA (RLS)

alter table public.companies enable row level security;
alter table public.user_profiles enable row level security;
alter table public.company_members enable row level security;
alter table public.time_entries enable row level security;
