-- Create table for justifications (abonos)
CREATE TABLE IF NOT EXISTS justifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- One request per day per user (for now)
    UNIQUE(user_id, date)
);

-- RLS Policies
ALTER TABLE justifications ENABLE ROW LEVEL SECURITY;

-- Admins can view/manage all for their company
CREATE POLICY "Admins can manage justifications" ON justifications
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = justifications.company_id
            AND company_members.user_id = auth.uid()
            AND company_members.role = 'owner'
        )
    );

-- Employees can view and create their own
CREATE POLICY "Employees can view own justifications" ON justifications
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Employees can create justifications" ON justifications
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
