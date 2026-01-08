-- Create table for granular daily shifts
CREATE TABLE IF NOT EXISTS work_shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL, -- "Carga Horária" in minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure one shift per user per day (simplification for now)
    UNIQUE(user_id, work_date)
);

-- Add RLS Policies
ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage shifts for their company members
CREATE POLICY "Admins can manage shifts" ON work_shifts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = work_shifts.company_id
            AND company_members.user_id = auth.uid()
            AND company_members.role = 'owner'
        )
    );

-- Employees can view their own shifts
CREATE POLICY "Employees can view own shifts" ON work_shifts
    FOR SELECT
    USING (
        auth.uid() = user_id
    );
