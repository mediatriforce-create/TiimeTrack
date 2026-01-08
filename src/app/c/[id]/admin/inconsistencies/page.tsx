'use client'

import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useEffect, useState, use } from 'react'
import { Loader2, AlertTriangle, Search, Filter, Calendar as CalendarIcon, ArrowLeft } from 'lucide-react'
import { format, subDays, eachDayOfInterval, isSameDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

type InconsistencyItem = {
    id: string // composite key
    date: Date
    employeeName: string
    employeeId: string
    type: 'FALTA' | 'ATRASO' | 'INCOMPLETO'
    details: string
    minutes?: number
}

export default function InconsistenciesPage({ params }: { params: Promise<{ id: string }> }) {
    const { user } = useAuth()
    const supabase = createClient()
    const { id: companyId } = use(params)

    const [loading, setLoading] = useState(true)
    const [inconsistencies, setInconsistencies] = useState<InconsistencyItem[]>([])
    const [filterType, setFilterType] = useState<'ALL' | 'FALTA' | 'ATRASO' | 'INCOMPLETO'>('ALL')

    useEffect(() => {
        fetchAllInconsistencies()
    }, [user, companyId])

    const fetchAllInconsistencies = async () => {
        if (!user) return

        // 1. Fetch Employees
        const { data: employees } = await supabase
            .from('company_members')
            .select(`
                id, user_id, work_hours, schedule_type, work_days, 
                fixed_start_time, fixed_end_time, tolerance_minutes,
                created_at,
                user:user_profiles (id, full_name, email)
            `)
            .eq('company_id', companyId)
            .eq('role', 'employee')

        if (!employees) {
            setLoading(false)
            return
        }

        const endDate = new Date()
        const startDate = subDays(endDate, 30)

        // 2. Fetch Time Entries (Optimized: Fetch all for company in range)
        const { data: allEntries } = await supabase
            .from('time_entries')
            .select('*')
            .eq('company_id', companyId)
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString())

        const globalIssues: InconsistencyItem[] = []
        const days = eachDayOfInterval({ start: startDate, end: endDate })

        // 3. Calculate for each employee
        for (const empCheck of employees) {
            const emp: any = {
                ...empCheck,
                full_name: (empCheck.user as any)?.full_name || 'Sem nome',
                userId: empCheck.user_id
            }

            // Entries for this employee
            const empEntries = (allEntries || []).filter((e: any) => e.user_id === emp.userId)
            const joinedAt = emp.created_at ? new Date(emp.created_at) : new Date(0)
            // Reset joinedAt time to 00:00:00 to avoid skipping the joining day itself
            joinedAt.setHours(0, 0, 0, 0)

            for (const day of days) {
                if (day > new Date()) continue
                // Skip days BEFORE the user joined
                if (day < joinedAt) continue

                const dayStr = format(day, 'yyyy-MM-dd')
                const dayEntries = empEntries.filter((e: any) => e.timestamp.startsWith(dayStr))

                const dayKey = format(day, 'EEE').toLowerCase()
                const isWorkDay = emp.work_days?.includes(dayKey)

                if (!isWorkDay) continue

                // Logic Duplicated from EmployeesPage (Refactor later)
                // 1. MISSING
                if (dayEntries.length === 0) {
                    if (!isSameDay(day, new Date())) {
                        globalIssues.push({
                            id: `${emp.id}-${dayStr}-missing`,
                            date: day,
                            employeeName: emp.full_name,
                            employeeId: emp.id,
                            type: 'FALTA',
                            details: 'Não compareceu.'
                        })
                    }
                    continue
                }

                // 2. LATE
                const firstEntry = [...dayEntries].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0]
                if (firstEntry && firstEntry.event_type === 'entry' && emp.schedule_type === 'fixed' && emp.fixed_start_time) {
                    const [h, m] = emp.fixed_start_time.split(':').map(Number)
                    const scheduledTime = new Date(firstEntry.timestamp)
                    scheduledTime.setHours(h, m, 0, 0)
                    const entryTime = new Date(firstEntry.timestamp)

                    const diffMinutes = Math.floor((entryTime.getTime() - scheduledTime.getTime()) / 60000)
                    const tolerance = emp.tolerance_minutes || 0

                    if (diffMinutes > tolerance) {
                        globalIssues.push({
                            id: `${emp.id}-${dayStr}-late`,
                            date: day,
                            employeeName: emp.full_name,
                            employeeId: emp.id,
                            type: 'ATRASO',
                            details: `${diffMinutes}min de atraso`,
                            minutes: diffMinutes
                        })
                    }
                }

                // 3. INCOMPLETE
                const sortedEntries = [...dayEntries].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                const lastEntry = sortedEntries[sortedEntries.length - 1]
                const hasExit = lastEntry && lastEntry.event_type === 'exit'

                if (!isSameDay(day, new Date()) && !hasExit) {
                    globalIssues.push({
                        id: `${emp.id}-${dayStr}-inc`,
                        date: day,
                        employeeName: emp.full_name,
                        employeeId: emp.id,
                        type: 'INCOMPLETO',
                        details: 'Sem batida de saída.'
                    })
                } else if (hasExit) {
                    // Manual calc
                    let total = 0
                    let lastT: number | null = null
                    for (const e of sortedEntries) {
                        const t = new Date(e.timestamp).getTime()
                        if (e.event_type === 'entry' || e.event_type === 'return') lastT = t
                        else if ((e.event_type === 'pause' || e.event_type === 'exit') && lastT !== null) {
                            total += (t - lastT) / 60000
                            lastT = null
                        }
                    }

                    let target = 8 * 60
                    if (emp.schedule_type === 'fixed' && emp.fixed_start_time && emp.fixed_end_time) {
                        const [h1, m1] = emp.fixed_start_time.split(':').map(Number)
                        const [h2, m2] = emp.fixed_end_time.split(':').map(Number)
                        target = (h2 * 60 + m2) - (h1 * 60 + m1)
                    } else if (emp.work_hours) {
                        const [h, m] = emp.work_hours.split(':').map(Number)
                        target = h * 60 + m
                    }

                    if (total < target - (emp.tolerance_minutes || 0)) {
                        globalIssues.push({
                            id: `${emp.id}-${dayStr}-under`,
                            date: day,
                            employeeName: emp.full_name,
                            employeeId: emp.id,
                            type: 'INCOMPLETO',
                            details: `Trabalhou ${Math.floor(total / 60)}h${Math.floor(total % 60)}m (Meta: ${Math.floor(target / 60)}h${Math.floor(target % 60)}m)`,
                            minutes: target - total
                        })
                    }
                }
            }
        }

        // Sort by Date Descending
        globalIssues.sort((a, b) => b.date.getTime() - a.date.getTime())
        setInconsistencies(globalIssues)
        setLoading(false)
    }

    const filteredList = inconsistencies.filter(i => filterType === 'ALL' || i.type === filterType)

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Inconsistências</h1>
                <p className="text-gray-500">Monitoramento global de atrasos, faltas e pontos incompletos.</p>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {(['ALL', 'FALTA', 'ATRASO', 'INCOMPLETO'] as const).map(type => (
                    <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === type
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        {type === 'ALL' ? 'Todas' : type}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {filteredList.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <AlertTriangle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p>Nenhuma inconsistência encontrada com este filtro.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Data</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Colaborador</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredList.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {format(item.date, 'dd/MM/yyyy', { locale: ptBR })}
                                        <span className="text-gray-400 font-normal ml-2">{format(item.date, 'EEEE', { locale: ptBR })}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {item.employeeName}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${item.type === 'FALTA' ? 'bg-red-100 text-red-700' :
                                            item.type === 'ATRASO' ? 'bg-amber-100 text-amber-700' :
                                                'bg-orange-100 text-orange-700'
                                            }`}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {item.details}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
