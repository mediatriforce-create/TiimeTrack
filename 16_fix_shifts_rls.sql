-- Fix RLS Policy for work_shifts to allow insert/update/delete for admins
DROP POLICY IF EXISTS "Admins can manage work_shifts" ON work_shifts;

CREATE POLICY "Admins can manage work_shifts" ON work_shifts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = work_shifts.company_id
            AND company_members.user_id = auth.uid()
            AND company_members.role IN ('owner', 'admin')
        )
    );

-- Ensure company_id is required
ALTER TABLE work_shifts ALTER COLUMN company_id SET NOT NULL;
