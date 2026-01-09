'use client'

import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useEffect, useState, use, Fragment } from 'react'
import {
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    MoreHorizontal,
    Download,
    Calendar,
    Settings,
    UserPlus,
    Clock,
    AlertTriangle,
    Check,
    Loader2,
    CalendarDays,
    X,
    Paperclip,
    Save
} from 'lucide-react'
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, subDays, isSameDay, isWeekend, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type EmployeeProfile = {
    id: string
    userId: string
    full_name: string
    email: string
    work_hours: string
    schedule_type: 'fixed' | 'flexible'
    work_days: string[]
    fixed_start_time: string | null
    fixed_end_time: string | null
    tolerance_minutes: number | null
    created_at: string
}

type Justification = {
    id: string
    reason: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    created_at: string
    attachment_url?: string
    admin_notes?: string
}

type DailyIssue = {
    date: Date
    types: ('FALTA' | 'ATRASO' | 'INCOMPLETO')[]
    details: string[]
    minutes: number
    justification?: Justification
}

const DAYS_MAP = [
    { id: 'mon', label: 'Seg' },
    { id: 'tue', label: 'Ter' },
    { id: 'wed', label: 'Qua' },
    { id: 'thu', label: 'Qui' },
    { id: 'fri', label: 'Sex' },
    { id: 'sat', label: 'Sáb' },
    { id: 'sun', label: 'Dom' },
]

export default function EmployeesPage({ params }: { params: Promise<{ id: string }> }) {
    const { user } = useAuth()
    const supabase = createClient()
    const { id: companyId } = use(params)

    const [employees, setEmployees] = useState<EmployeeProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Inconsistencies State
    const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null)
    const [dailyIssuesMap, setDailyIssuesMap] = useState<{ [key: string]: DailyIssue[] }>({})
    const [loadingInconsistencies, setLoadingInconsistencies] = useState(false)

    // Justification Modal
    const [viewJustification, setViewJustification] = useState<DailyIssue['justification'] | null>(null)

    // Standard Config Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingEmp, setEditingEmp] = useState<EmployeeProfile | null>(null)
    const [editForm, setEditForm] = useState<Partial<EmployeeProfile>>({})
    const [saving, setSaving] = useState(false)

    // Shift Manager Modal
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
    const [shiftEmp, setShiftEmp] = useState<EmployeeProfile | null>(null)
    const [shiftMode, setShiftMode] = useState<'day' | 'week' | 'month'>('day')
    const [shiftDate, setShiftDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [shiftStartTime, setShiftStartTime] = useState('08:00')
    const [shiftDuration, setShiftDuration] = useState('08:00')
    const [savingShift, setSavingShift] = useState(false)

    useEffect(() => {
        fetchEmployees()
    }, [user])

    const fetchEmployees = async () => {
        if (!user) return

        const { data, error } = await supabase
            .from('company_members')
            .select(`
                id,
                user_id,
                work_hours,
                schedule_type,
                work_days,
                fixed_start_time,
                fixed_end_time,
                tolerance_minutes,
                created_at,
                user:user_profiles (id, full_name, email)
            `)
            .eq('company_id', companyId)
            .eq('role', 'employee')

        if (error) console.error(error)

        const flatList = (data || []).map((item: any) => ({
            id: item.id,
            userId: item.user_id,
            full_name: item.user.full_name,
            email: item.user.email,
            work_hours: item.work_hours,
            schedule_type: item.schedule_type || 'fixed',
            work_days: item.work_days || [],
            fixed_start_time: item.fixed_start_time,
            fixed_end_time: item.fixed_end_time,
            tolerance_minutes: item.tolerance_minutes,
            created_at: item.created_at
        })) as EmployeeProfile[]

        setEmployees(flatList)
        setLoading(false)
    }

    const formatDuration = (totalMinutes: number) => {
        const h = Math.floor(Math.abs(totalMinutes) / 60)
        const m = Math.abs(totalMinutes) % 60
        return `${h}h ${m}m`
    }

    const toggleExpand = async (emp: EmployeeProfile) => {
        if (expandedEmpId === emp.id) {
            setExpandedEmpId(null)
            return
        }

        setExpandedEmpId(emp.id)

        setLoadingInconsistencies(true)
        await fetchInconsistencies(emp)
        setLoadingInconsistencies(false)
    }

    const fetchInconsistencies = async (emp: EmployeeProfile) => {
        const endDate = new Date()
        const startDate = subDays(endDate, 30)

        // Fetch Entries
        const { data: entries } = await supabase
            .from('time_entries')
            .select('*')
            .eq('user_id', emp.userId)
            .eq('company_id', companyId)
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString())
            .order('timestamp', { ascending: true })

        // Fetch Justifications
        const { data: justifications } = await supabase
            .from('justifications')
            .select('*')
            .eq('user_id', emp.userId)
            .eq('company_id', companyId)
            .gte('date', startDate.toISOString())
            .lte('date', endDate.toISOString())

        const days = eachDayOfInterval({ start: startDate, end: endDate })
        const issuesList: DailyIssue[] = []

        const joinedAt = emp.created_at ? new Date(emp.created_at) : new Date(0)
        joinedAt.setHours(0, 0, 0, 0)

        for (const day of days) {
            if (day > new Date()) continue
            if (day < joinedAt) continue

            const dayStr = format(day, 'yyyy-MM-dd')
            const dayEntries = (entries || []).filter(e => e.timestamp.startsWith(dayStr))
            const dayJustification = (justifications || []).find(j => j.date === dayStr)

            const dayKey = format(day, 'EEE').toLowerCase() // 'mon', 'tue'...
            const isWorkDay = emp.work_days?.includes(dayKey)

            if (!isWorkDay) continue

            const dailyParams: DailyIssue = {
                date: day,
                types: [],
                details: [],
                minutes: 0,
                justification: dayJustification
            }

            // 1. MISSING
            if (dayEntries.length === 0) {
                if (!isSameDay(day, new Date())) {
                    dailyParams.types.push('FALTA')
                    dailyParams.details.push('Dia de trabalho sem registro.')
                    issuesList.push(dailyParams)
                }
                continue
            }

            // 2. LATE
            const firstEntry = dayEntries.find(e => e.event_type === 'entry')
            if (firstEntry && emp.schedule_type === 'fixed' && emp.fixed_start_time) {
                const [h, m] = emp.fixed_start_time.split(':').map(Number)
                const scheduledTime = new Date(firstEntry.timestamp)
                scheduledTime.setHours(h, m, 0, 0)
                const entryTime = new Date(firstEntry.timestamp)

                const diffMinutes = Math.floor((entryTime.getTime() - scheduledTime.getTime()) / 60000)
                const tolerance = emp.tolerance_minutes || 0

                if (diffMinutes > tolerance) {
                    dailyParams.types.push('ATRASO')
                    dailyParams.details.push(`Chegada às ${format(entryTime, 'HH:mm')} (${formatDuration(diffMinutes)} de atraso)`)
                    dailyParams.minutes += diffMinutes
                }
            }

            // 3. INCOMPLETE & Utils
            const lastEntry = dayEntries[dayEntries.length - 1]
            const hasExit = lastEntry && lastEntry.event_type === 'exit'

            if (!isSameDay(day, new Date()) && !hasExit) {
                dailyParams.types.push('INCOMPLETO')
                dailyParams.details.push('Turno não finalizado (sem saída).')
            } else if (hasExit) {
                const totalMinutes = calculateDailyMinutes(dayEntries)
                let targetMinutes = 8 * 60

                if (emp.schedule_type === 'fixed' && emp.fixed_start_time && emp.fixed_end_time) {
                    const [h1, m1] = emp.fixed_start_time.split(':').map(Number)
                    const [h2, m2] = emp.fixed_end_time.split(':').map(Number)
                    targetMinutes = (h2 * 60 + m2) - (h1 * 60 + m1)
                } else if (emp.work_hours) {
                    const [h, m] = emp.work_hours.split(':').map(Number)
                    targetMinutes = h * 60 + m
                }

                if (totalMinutes < targetMinutes - (emp.tolerance_minutes || 0)) {
                    const missing = targetMinutes - totalMinutes
                    dailyParams.types.push('INCOMPLETO')
                    dailyParams.details.push(`Carga de ${formatDuration(totalMinutes)} (Meta: ${formatDuration(targetMinutes)})`)
                    dailyParams.minutes += missing
                }
            }

            if (dailyParams.types.length > 0) {
                issuesList.push(dailyParams)
            }
        }
        setDailyIssuesMap(prev => ({ ...prev, [emp.id]: issuesList.reverse() }))
    }

    const calculateDailyMinutes = (entries: any[]) => {
        const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        let total = 0
        let lastEntryTime: number | null = null

        for (const entry of sorted) {
            const time = new Date(entry.timestamp).getTime()

            if (entry.event_type === 'entry' || entry.event_type === 'return') {
                lastEntryTime = time
            } else if ((entry.event_type === 'pause' || entry.event_type === 'exit') && lastEntryTime !== null) {
                total += (time - lastEntryTime) / 60000
                lastEntryTime = null
            }
        }
        return Math.floor(total)
    }

    const handleUpdateStatus = async (justificationId: string, newStatus: 'APPROVED' | 'REJECTED') => {
        const { error } = await supabase
            .from('justifications')
            .update({ status: newStatus })
            .eq('id', justificationId)

        if (error) {
            alert('Erro ao atualizar status')
            console.error(error)
            return
        }

        // Close modal and refresh currently expanded employee
        setViewJustification(null)
        if (expandedEmpId) {
            const emp = employees.find(e => e.id === expandedEmpId)
            if (emp) fetchInconsistencies(emp)
        }
    }

    const startEdit = (emp: EmployeeProfile) => {
        setEditingEmp(emp)
        setEditForm({
            work_hours: emp.work_hours || '08:00',
            schedule_type: emp.schedule_type || 'fixed',
            work_days: emp.work_days || [],
            fixed_start_time: emp.fixed_start_time || '08:00',
            fixed_end_time: emp.fixed_end_time || '18:00',
            tolerance_minutes: emp.tolerance_minutes || 10
        })
        setIsEditModalOpen(true)
    }

    const saveEdit = async () => {
        if (!editingEmp) return
        setSaving(true)

        const updates = {
            work_hours: editForm.work_hours,
            schedule_type: editForm.schedule_type,
            work_days: editForm.work_days,
            fixed_start_time: editForm.fixed_start_time,
            fixed_end_time: editForm.fixed_end_time,
            tolerance_minutes: editForm.tolerance_minutes
        }

        const { error } = await supabase.from('company_members').update(updates).eq('id', editingEmp.id)

        if (error) alert('Erro ao salvar: ' + error.message)
        else {
            await fetchEmployees()
            setIsEditModalOpen(false)
        }
        setSaving(false)
    }

    const toggleDay = (dayId: string) => {
        const currentDays = editForm.work_days || []
        if (currentDays.includes(dayId)) {
            setEditForm({ ...editForm, work_days: currentDays.filter(d => d !== dayId) })
        } else {
            setEditForm({ ...editForm, work_days: [...currentDays, dayId] })
        }
    }

    const openShiftManager = (emp: EmployeeProfile) => {
        setShiftEmp(emp)
        setShiftMode('day')
        setShiftDate(format(new Date(), 'yyyy-MM-dd'))
        setShiftStartTime('08:00')
        setShiftDuration('08:00')
        setIsShiftModalOpen(true)
    }

    const saveShiftsAction = async () => {
        if (!shiftEmp || !user) return
        setSavingShift(true)

        const targetUserId = shiftEmp.userId
        let datesToAdd: Date[] = []
        const baseDate = parseISO(shiftDate)

        if (shiftMode === 'day') {
            datesToAdd = [baseDate]
        } else if (shiftMode === 'week') {
            const startW = startOfWeek(baseDate, { weekStartsOn: 0 })
            const endW = endOfWeek(baseDate, { weekStartsOn: 0 })
            datesToAdd = eachDayOfInterval({ start: startW, end: endW })
        } else if (shiftMode === 'month') {
            const start = startOfMonth(baseDate)
            const end = endOfMonth(baseDate)
            datesToAdd = eachDayOfInterval({ start, end })
        }

        const [dh, dm] = shiftDuration.split(':').map(Number)
        const durationMinutes = (dh * 60) + dm

        const records = datesToAdd.map(date => ({
            user_id: targetUserId,
            company_id: companyId,
            work_date: format(date, 'yyyy-MM-dd'),
            start_time: shiftStartTime,
            duration_minutes: durationMinutes
        }))

        const { error } = await supabase
            .from('work_shifts')
            .upsert(records, { onConflict: 'user_id, work_date' })

        if (error) {
            alert('Erro ao salvar escala: ' + error.message)
        } else {
            alert(`Escala aplicada para ${records.length} dias com sucesso!`)
            setIsShiftModalOpen(false)
        }
        setSavingShift(false)
    }

    const filteredEmployees = employees.filter(emp =>
        emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>

    return (
        <div className="space-y-6 relative">
            {/* Header and Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
                    <p className="text-gray-500">Gerencie seus colaboradores, escalas e registros.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setEditForm({
                                work_hours: '08:00',
                                schedule_type: 'fixed',
                                work_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
                                fixed_start_time: '08:00',
                                fixed_end_time: '17:00',
                                tolerance_minutes: 10
                            })
                            setIsEditModalOpen(true)
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                    >
                        <Settings className="w-4 h-4" />
                        Configuração (Jornada)
                    </button>
                    {/* <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm">
                        <UserPlus className="w-4 h-4" />
                        Novo Colaborador
                    </button> */}
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-500"
                    />
                </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="w-12 px-4 py-3"></th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Colaborador</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Jornada</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">Carregando equipe...</td></tr>
                        ) : filteredEmployees.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">Nenhum colaborador encontrado.</td></tr>
                        ) : filteredEmployees.map(emp => {
                            const isExpanded = expandedEmpId === emp.id
                            const empIssues = dailyIssuesMap[emp.id] || []

                            return (
                                <Fragment key={emp.id}>
                                    <tr className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/30' : ''}`} onClick={() => toggleExpand(emp)}>
                                        <td className="px-4 py-4 text-center">
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                                    {emp.full_name?.[0]}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="font-bold text-gray-900">{emp.full_name}</div>
                                                    <div className="text-xs text-gray-500">{emp.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {emp.schedule_type === 'fixed' ? (
                                                <div className="flex flex-col text-sm">
                                                    <span className="font-medium text-gray-700">Horário Fixo</span>
                                                    <span className="text-gray-500">{emp.fixed_start_time?.slice(0, 5)} - {emp.fixed_end_time?.slice(0, 5)}</span>
                                                </div>
                                            ) : (
                                                <span className="inline-flex px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">Flexível</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => openShiftManager(emp)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors border border-indigo-200"
                                                title="Gerenciar Escala"
                                            >
                                                <CalendarDays className="w-4 h-4" />
                                                Escala
                                            </button>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-indigo-50/30 cursor-default" onClick={e => e.stopPropagation()}>
                                            <td colSpan={4} className="px-8 py-4">
                                                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm animate-in slide-in-from-top-2">
                                                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                        Inconsistências (Últimos 30 dias)
                                                    </h4>

                                                    {loadingInconsistencies ? (
                                                        <div className="flex justify-center p-4 text-indigo-500"><Loader2 className="animate-spin" /></div>
                                                    ) : empIssues.length === 0 ? (
                                                        <div className="p-4 text-center text-green-600 bg-green-50 rounded-lg border border-green-100 flex flex-col items-center">
                                                            <Check className="w-6 h-6 mb-1" />
                                                            <span className="font-medium">Nenhuma inconsistência encontrada no período.</span>
                                                        </div>
                                                    ) : (
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left">Data</th>
                                                                    <th className="px-3 py-2 text-left">Ocorrências</th>
                                                                    <th className="px-3 py-2 text-left">Detalhes</th>
                                                                    <th className="px-3 py-2 text-right">Justificativa</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {empIssues.map((issue, idx) => (
                                                                    <tr key={idx} className="hover:bg-gray-50">
                                                                        <td className="px-3 py-2 font-mono text-gray-700">{format(issue.date, 'dd/MM/yyyy')}</td>
                                                                        <td className="px-3 py-2 flex flex-wrap gap-1">
                                                                            {issue.types.map(t => (
                                                                                <span key={t} className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${t === 'FALTA' ? 'bg-red-100 text-red-700' :
                                                                                    t === 'ATRASO' ? 'bg-amber-100 text-amber-700' :
                                                                                        'bg-orange-100 text-orange-700'
                                                                                    }`}>
                                                                                    {t}
                                                                                </span>
                                                                            ))}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-gray-600">
                                                                            {issue.details.join(' | ')}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right">
                                                                            {issue.justification ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault()
                                                                                        e.stopPropagation()
                                                                                        setViewJustification(issue.justification)
                                                                                    }}
                                                                                    className={`text-xs font-bold px-3 py-1 rounded transition-colors cursor-pointer border ${issue.justification.status === 'APPROVED' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' :
                                                                                        issue.justification.status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' :
                                                                                            'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
                                                                                        }`}
                                                                                >
                                                                                    {issue.justification.status === 'PENDING' ? 'VER (PENDENTE)' :
                                                                                        issue.justification.status === 'APPROVED' ? 'VER (APROVADO)' : 'VER (REJEITADO)'}
                                                                                </button>
                                                                            ) : (
                                                                                <span className="text-gray-300">-</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 pb-20">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>
                ) : filteredEmployees.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-sm">Nenhum colaborador encontrado.</div>
                ) : filteredEmployees.map(emp => {
                    const isExpanded = expandedEmpId === emp.id
                    const empIssues = dailyIssuesMap[emp.id] || []

                    return (
                        <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4" onClick={() => toggleExpand(emp)}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                                            {emp.full_name?.[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 text-lg">{emp.full_name}</div>
                                            <div className="text-sm text-gray-500">{emp.email}</div>
                                        </div>
                                    </div>
                                    {emp.schedule_type === 'fixed' ? (
                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold whitespace-nowrap">
                                            {emp.fixed_start_time?.slice(0, 5)} - {emp.fixed_end_time?.slice(0, 5)}
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">Flexível</span>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => openShiftManager(emp)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors border border-indigo-200"
                                    >
                                        <CalendarDays className="w-4 h-4" />
                                        Escala
                                    </button>
                                    <button
                                        onClick={() => toggleExpand(emp)}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors border ${isExpanded ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                                    >
                                        <AlertTriangle className={`w-4 h-4 ${isExpanded ? 'text-amber-500' : 'text-gray-400'}`} />
                                        Inconsistências
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Mobile Inconsistencies List */}
                            {isExpanded && (
                                <div className="bg-gray-50 border-t border-gray-200 p-4 animate-in slide-in-from-top-2">
                                    {loadingInconsistencies ? (
                                        <div className="flex justify-center p-4 text-indigo-500"><Loader2 className="animate-spin" /></div>
                                    ) : empIssues.length === 0 ? (
                                        <div className="p-4 text-center text-green-600 bg-green-50 rounded-lg border border-green-100 flex flex-col items-center">
                                            <Check className="w-6 h-6 mb-1" />
                                            <span className="font-medium text-sm">Nenhuma inconsistência.</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {empIssues.map((issue, idx) => (
                                                <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-mono text-sm font-bold text-gray-900">{format(issue.date, 'dd/MM/yyyy')}</span>
                                                        <div className="flex gap-1">
                                                            {issue.types.map(t => (
                                                                <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${t === 'FALTA' ? 'bg-red-100 text-red-700' : t === 'ATRASO' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                    {t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mb-3 leading-snug">
                                                        {issue.details.join(' | ')}
                                                    </p>

                                                    {issue.justification ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setViewJustification(issue.justification)
                                                            }}
                                                            className={`w-full py-2 rounded-lg text-xs font-bold border transition-colors ${issue.justification.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                    issue.justification.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                        'bg-blue-50 text-blue-700 border-blue-200'
                                                                }`}
                                                        >
                                                            {issue.justification.status === 'PENDING' ? 'VER JUSTIFICATIVA (PENDENTE)' :
                                                                issue.justification.status === 'APPROVED' ? 'JUSTIFICATIVA APROVADA' : 'JUSTIFICATIVA REJEITADA'}
                                                        </button>
                                                    ) : (
                                                        <div className="text-center py-1 text-xs text-gray-400 italic bg-gray-50 rounded">Sem justificativa</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Shift Modal */}
            {isShiftModalOpen && shiftEmp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Gerenciar Escala</h3>
                                <p className="text-sm text-gray-500">{shiftEmp.full_name}</p>
                            </div>
                            <button onClick={() => setIsShiftModalOpen(false)}><X className="w-6 h-6 text-gray-400" /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                {['day', 'week', 'month'].map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setShiftMode(m as any)}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${shiftMode === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {m === 'day' ? 'Dia' : m === 'week' ? 'Semana' : 'Mês'}
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Referência</label>
                                <input
                                    type={shiftMode === 'month' ? 'month' : 'date'}
                                    className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                                    value={shiftDate}
                                    onChange={e => setShiftDate(e.target.value)}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {shiftMode === 'day' && 'Será aplicada apenas neste dia.'}
                                    {shiftMode === 'week' && 'Será aplicada para a semana inteira desta data.'}
                                    {shiftMode === 'month' && 'Será aplicada para todos os dias deste mês.'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Início</label>
                                    <input
                                        type="time"
                                        className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                                        value={shiftStartTime}
                                        onChange={e => setShiftStartTime(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Carga (Duração)</label>
                                    <input
                                        type="time"
                                        className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                                        value={shiftDuration}
                                        onChange={e => setShiftDuration(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={saveShiftsAction}
                                disabled={savingShift}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                            >
                                {savingShift ? <Loader2 className="animate-spin" /> : <Save className="w-4 h-4" />}
                                Aplicar Escala
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Justification Modal rendered at root level */}
            {viewJustification && (
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setViewJustification(null)}
                >
                    {/* Content of the justification modal */}
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Justificativa</h3>
                            <button onClick={() => setViewJustification(null)}><X className="w-6 h-6 text-gray-400" /></button>
                        </div>
                        {viewJustification && (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Status:</p>
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${viewJustification.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                        viewJustification.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                        {viewJustification.status === 'PENDING' ? 'PENDENTE' :
                                            viewJustification.status === 'APPROVED' ? 'APROVADO' : 'REJEITADO'}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Data de Envio:</p>
                                    <p className="text-gray-900">{new Date(viewJustification.created_at).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Motivo:</p>
                                    <p className="text-gray-900">{viewJustification.reason}</p>
                                </div>
                                {viewJustification.attachment_url && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Anexo:</p>
                                        <a href={viewJustification.attachment_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
                                            <Paperclip className="w-4 h-4" />
                                            Ver Anexo
                                        </a>
                                    </div>
                                )}
                                {viewJustification.admin_notes && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Notas do Administrador:</p>
                                        <p className="text-gray-900">{viewJustification.admin_notes}</p>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                                    <button
                                        onClick={() => setViewJustification(null)}
                                        className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                                    >
                                        Fechar
                                    </button>
                                    {viewJustification.status === 'PENDING' && (
                                        <>
                                            <button
                                                onClick={() => handleUpdateStatus(viewJustification.id, 'REJECTED')}
                                                className="px-4 py-2 bg-red-50 text-red-600 font-bold hover:bg-red-100 rounded-lg border border-red-200"
                                            >
                                                Rejeitar
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(viewJustification.id, 'APPROVED')}
                                                className="px-4 py-2 bg-green-600 text-white font-bold hover:bg-green-700 rounded-lg shadow-md hover:shadow-lg transition-all"
                                            >
                                                Aprovar
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Editar Configuração Padrão</h3>
                            <button onClick={() => setIsEditModalOpen(false)}><X className="w-6 h-6 text-gray-400" /></button>
                        </div>

                        <div className="space-y-6">
                            {/* Schedule Type */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700">Tipo de Jornada</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 border p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-colors ${editForm.schedule_type === 'fixed' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}>
                                        <input
                                            type="radio"
                                            name="schedule_type"
                                            checked={editForm.schedule_type === 'fixed'}
                                            onChange={() => setEditForm(p => ({ ...p, schedule_type: 'fixed' }))}
                                            className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className={`font-semibold ${editForm.schedule_type === 'fixed' ? 'text-indigo-900' : 'text-gray-600'}`}>Horário Fixo</span>
                                    </label>
                                    <label className={`flex-1 border p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-colors ${editForm.schedule_type === 'flexible' ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:border-purple-200'}`}>
                                        <input
                                            type="radio"
                                            name="schedule_type"
                                            checked={editForm.schedule_type === 'flexible'}
                                            onChange={() => setEditForm(p => ({ ...p, schedule_type: 'flexible' }))}
                                            className="text-purple-600 focus:ring-purple-500"
                                        />
                                        <span className={`font-semibold ${editForm.schedule_type === 'flexible' ? 'text-purple-900' : 'text-gray-600'}`}>Flexível</span>
                                    </label>
                                </div>
                            </div>

                            {/* Days Selection */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700">Dias de Trabalho</label>
                                <div className="flex gap-1">
                                    {DAYS_MAP.map(day => {
                                        const isSelected = editForm.work_days?.includes(day.id)
                                        return (
                                            <button
                                                key={day.id}
                                                onClick={() => toggleDay(day.id)}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                            >
                                                {day.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Times */}
                            {editForm.schedule_type === 'fixed' && (
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Entrada</label>
                                        <input
                                            type="time"
                                            value={editForm.fixed_start_time || ''}
                                            onChange={e => setEditForm(p => ({ ...p, fixed_start_time: e.target.value }))}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Saída</label>
                                        <input
                                            type="time"
                                            value={editForm.fixed_end_time || ''}
                                            onChange={e => setEditForm(p => ({ ...p, fixed_end_time: e.target.value }))}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tolerância (min)</label>
                                        <input
                                            type="number"
                                            value={editForm.tolerance_minutes || 0}
                                            onChange={e => setEditForm(p => ({ ...p, tolerance_minutes: parseInt(e.target.value) }))}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar Configuração
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
