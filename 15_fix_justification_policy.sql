-- Fix RLS Policy for Justifications to include 'admin' role
DROP POLICY IF EXISTS "Admins can manage justifications" ON justifications;

CREATE POLICY "Admins can manage justifications" ON justifications
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = justifications.company_id
            AND company_members.user_id = auth.uid()
            AND company_members.role IN ('owner', 'admin')
        )
    );
