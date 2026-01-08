-- SQL 11: ADICIONAR COLUNAS DE JORNADA DE TRABALHO
-- Adiciona configurações de escala: dias da semana, horário fixo vs flexível, tolerância.

ALTER TABLE public.company_members
ADD COLUMN IF NOT EXISTS schedule_type text CHECK (schedule_type IN ('fixed', 'flexible')) DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS work_days text[] DEFAULT ARRAY['mon', 'tue', 'wed', 'thu', 'fri'], -- ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
ADD COLUMN IF NOT EXISTS fixed_start_time time DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS fixed_end_time time DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS tolerance_minutes integer DEFAULT 10;
