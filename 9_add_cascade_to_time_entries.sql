-- Adicionar ON DELETE CASCADE na tabela time_entries para permitir que apagar uma empresa apague seus pontos

-- Primeiro removemos a constraint antiga (assumindo nome padrão gerado pelo Postgres)
-- Se der erro dizendo que não existe, verifique o nome exato no seu banco.
ALTER TABLE public.time_entries 
DROP CONSTRAINT IF EXISTS time_entries_company_id_fkey;

-- Recriamos com ON DELETE CASCADE
ALTER TABLE public.time_entries
ADD CONSTRAINT time_entries_company_id_fkey
FOREIGN KEY (company_id) REFERENCES public.companies(id)
ON DELETE CASCADE;
