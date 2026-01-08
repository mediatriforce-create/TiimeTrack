-- Permitir que administradores excluam suas próprias empresas

-- 1. Habilitar RLS na tabela companies (se já não estiver)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Criar policy de DELETE
-- Apenas usuários que são membros 'admin' daquela empresa podem excluí-la.
DROP POLICY IF EXISTS "Admins can delete their own companies" ON public.companies;

CREATE POLICY "Admins can delete their own companies"
ON public.companies
FOR DELETE
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM public.company_members 
    WHERE company_id = companies.id 
    AND role = 'admin'
  )
);
