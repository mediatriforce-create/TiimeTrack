export type Role = 'admin' | 'employee'
export type EventType = 'entry' | 'pause' | 'return' | 'exit'

export interface Company {
    id: string
    name: string
    created_at: string
    work_hours_daily: number
}

export interface UserProfile {
    id: string
    email: string
    full_name: string
    role: Role
    company_id: string | null
    created_at: string
}

export interface TimeEntry {
    id: string
    user_id: string
    company_id: string
    event_type: EventType
    timestamp: string
    created_at: string
}
