'use client'

import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useEffect, useState, use } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, startOfDay, isAfter, addMinutes, differenceInMinutes, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertCircle, Clock, AlertTriangle, X, Send, FileText } from 'lucide-react'

type ScheduleConfig = {
    schedule_type: 'fixed' | 'flexible'
    work_days: string[]
    fixed_start_time: string | null
    fixed_end_time: string | null
    tolerance_minutes: number
    work_hours: string | null
    joined_at: string
}

type WorkShift = {
    work_date: string
    start_time: string
    duration_minutes: number
}

type Justification = {
    id: string
    date: string
    reason: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    admin_notes: string | null
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const getDayCode = (date: Date) => WEEKDAYS[date.getDay()]

export default function EmployeeCalendar({ params }: { params: Promise<{ id: string }> }) {
    const { id: companyId } = use(params)
    const { user } = useAuth()
    const supabase = createClient()

    const [currentDate, setCurrentDate] = useState(new Date())
    const [schedule, setSchedule] = useState<ScheduleConfig | null>(null)
    const [entries, setEntries] = useState<any[]>([])
    const [shifts, setShifts] = useState<WorkShift[]>([])
    const [justifications, setJustifications] = useState<Justification[]>([])
    const [loading, setLoading] = useState(true)

    // Modal State
    const [selectedDay, setSelectedDay] = useState<{ date: Date, status: any } | null>(null)
    const [justificationReason, setJustificationReason] = useState('')
    const [sendingJustification, setSendingJustification] = useState(false)

    useEffect(() => {
        let mounted = true
        if (user) {
            setLoading(true)
            Promise.all([fetchSchedule(), fetchMonthData()]).then(() => {
                if (mounted) setLoading(false)
            })
        }
        return () => { mounted = false }
    }, [user, currentDate])

    const fetchSchedule = async () => {
        if (!user) return
        const { data } = await supabase
            .from('company_members')
            .select('schedule_type, work_days, fixed_start_time, fixed_end_time, tolerance_minutes, work_hours, created_at')
            .eq('company_id', companyId)
            .eq('user_id', user.id)
            .single()

        if (data) {
            setSchedule({
                ...data,
                joined_at: data.created_at
            })
        }
    }

    const fetchMonthData = async () => {
        if (!user) return
        const start = startOfMonth(currentDate).toISOString()
        const end = endOfMonth(currentDate).toISOString()

        // Fetch Entries
        const { data: entriesData } = await supabase
            .from('time_entries')
            .select('*')
            .eq('user_id', user.id)
            .eq('company_id', companyId)
            .gte('timestamp', start)
            .lte('timestamp', end)
            .order('timestamp', { ascending: true })

        setEntries(entriesData || [])

        // Fetch Shifts (Exceptions)
        const { data: shiftsData } = await supabase
            .from('work_shifts')
            .select('work_date, start_time, duration_minutes')
            .eq('user_id', user.id)
            .eq('company_id', companyId)
            .gte('work_date', format(startOfMonth(currentDate), 'yyyy-MM-dd'))
            .lte('work_date', format(endOfMonth(currentDate), 'yyyy-MM-dd'))

        setShifts(shiftsData || [])

        // Fetch Justifications
        const { data: justData } = await supabase
            .from('justifications')
            .select('*')
            .eq('user_id', user.id)
            .eq('company_id', companyId)
            .gte('date', format(startOfMonth(currentDate), 'yyyy-MM-dd'))
            .lte('date', format(endOfMonth(currentDate), 'yyyy-MM-dd'))

        setJustifications(justData || [])
    }

    const sendJustification = async () => {
        if (!user || !selectedDay || !justificationReason.trim()) return
        setSendingJustification(true)

        const dateStr = format(selectedDay.date, 'yyyy-MM-dd')

        const { error } = await supabase
            .from('justifications')
            .insert({
                user_id: user.id,
                company_id: companyId,
                date: dateStr,
                reason: justificationReason,
                status: 'PENDING'
            })

        if (error) {
            alert('Erro ao enviar: ' + error.message)
        } else {
            await fetchMonthData() // Refresh
            setSelectedDay(null) // Close modal
            setJustificationReason('')
        }
        setSendingJustification(false)
    }

    const getDailyStatus = (date: Date) => {
        if (!schedule) return { status: 'none', label: '', details: {} }

        // 1. Check Join Date
        const joinDate = new Date(schedule.joined_at)
        if (isBefore(startOfDay(date), startOfDay(joinDate))) {
            return { status: 'none-joined', label: '', details: {} }
        }

        const dateStr = format(date, 'yyyy-MM-dd')

        // 1. Check Justifications
        const justification = justifications.find(j => j.date === dateStr)
        if (justification) {
            if (justification.status === 'APPROVED') return { status: 'justified', label: 'Abonado', details: { justification } }
            if (justification.status === 'REJECTED') return { status: 'missed', label: 'Rejeitado', details: { justification } } // Forces error color
        }

        const shift = shifts.find(s => s.work_date === dateStr)
        const dayCode = getDayCode(date)
        const isWorkDay = shift ? true : schedule.work_days?.includes(dayCode)
        const isPast = isBefore(date, new Date()) && !isSameDay(date, new Date())
        const isToday = isSameDay(date, new Date())

        if (!isWorkDay) return { status: 'off', label: 'Folga', details: {} }

        // --- Justification Override ---
        if (justification) {
            if (justification.status === 'APPROVED') {
                return { status: 'justified', label: 'Abonado', details: { justification } }
            }
            // If Pending, we calculate stats but Status is 'pending'
            // If Rejected, we calculate stats normally
        }

        // --- Determine Targets (Priority: Shift > Default) ---
        let targetStart = schedule.fixed_start_time
        let targetDuration = 8 * 60 // Default fallback

        if (shift) {
            targetStart = shift.start_time
            targetDuration = shift.duration_minutes
        } else {
            if (schedule.schedule_type === 'fixed' && schedule.fixed_start_time && schedule.fixed_end_time) {
                targetStart = schedule.fixed_start_time
                const [h1, m1] = schedule.fixed_start_time.split(':').map(Number)
                const [h2, m2] = schedule.fixed_end_time.split(':').map(Number)
                targetDuration = (h2 * 60 + m2) - (h1 * 60 + m1)
            } else if (schedule.work_hours) {
                const [h, m] = schedule.work_hours.split(':').map(Number)
                targetDuration = h * 60 + m
            }
        }

        // Future days
        if (!isPast && !isToday) {
            let displayTime = 'Flexível'
            if (targetStart) {
                const [h, m] = targetStart.split(':').map(Number)
                const startD = new Date().setHours(h, m, 0, 0)
                const endD = addMinutes(startD, targetDuration)
                displayTime = `${targetStart.slice(0, 5)} - ${format(endD, 'HH:mm')}`
            }

            return {
                status: 'future',
                label: displayTime,
                details: { targetStart, targetDuration }
            }
        }

        // --- Logic for Past & Today ---

        // Filter entries
        const dailyEntries = entries.filter(e => isSameDay(new Date(e.timestamp), date))

        // Calculate Worked Time
        let totalMs = 0
        let lastEntryTime: number | null = null
        let firstEntryTime: Date | null = null

        for (const e of dailyEntries) {
            const time = new Date(e.timestamp).getTime()
            if (e.event_type === 'entry') {
                if (!firstEntryTime) firstEntryTime = new Date(e.timestamp)
            }
            if (e.event_type === 'entry' || e.event_type === 'return') {
                lastEntryTime = time
            } else if ((e.event_type === 'pause' || e.event_type === 'exit') && lastEntryTime !== null) {
                totalMs += (time - lastEntryTime)
                lastEntryTime = null
            }
        }

        if (lastEntryTime !== null && isToday) {
            totalMs += (new Date().getTime() - lastEntryTime)
        }

        const workedMinutes = totalMs / 60000
        const tolerance = schedule.tolerance_minutes || 0

        // --- Checks ---

        // 1. MISSED (Falta)
        if (dailyEntries.length === 0 && isPast) {
            const status = justification?.status === 'PENDING' ? 'pending' : 'missed'
            return { status: status, label: status === 'pending' ? 'Em Análise' : 'Falta', details: { targetStart, targetDuration, workedMinutes: 0, justification } }
        }

        // 2. Lateness (Atrasado)
        let isLate = false
        let lateMinutes = 0
        if (firstEntryTime && targetStart) {
            const [h, m] = targetStart.split(':').map(Number)
            const targetDate = new Date(firstEntryTime)
            targetDate.setHours(h, m, 0, 0)

            const diff = differenceInMinutes(firstEntryTime, targetDate)
            if (diff > tolerance) {
                isLate = true
                lateMinutes = diff
            }
        }

        // 3. Incomplete
        const missingMinutes = targetDuration - workedMinutes
        const isIncomplete = workedMinutes < (targetDuration - tolerance)

        // Define Return Object Details
        const details = {
            targetStart,
            targetDuration,
            workedMinutes: Math.floor(workedMinutes),
            entries: dailyEntries,
            lateMinutes,
            missingMinutes: missingMinutes > 0 ? Math.floor(missingMinutes) : 0,
            isLate,
            isIncomplete,
            justification
        }

        // PENDING Override
        if (justification?.status === 'PENDING') {
            return { status: 'pending', label: 'Em Análise', details }
        }

        // Apply Status Logic
        if (isToday) {
            // Priority: Incomplete > Late
            if (isIncomplete) {
                const hasExited = dailyEntries.some(e => e.event_type === 'exit')
                if (hasExited) return { status: 'incomplete', label: 'Incompleto', details }
                // If hasn't exited yet, but is late:
                if (isLate) return { status: 'late', label: 'Atrasado', details }
                return { status: 'neutral', label: 'Em andamento', details }
            }
            if (isLate) return { status: 'late', label: 'Atrasado', details }
            return { status: 'success', label: 'Concluído', details }
        }

        // Past
        if (isIncomplete) return { status: 'incomplete', label: 'Incompleto', details }
        if (isLate) return { status: 'late', label: 'Atrasado', details }

        return { status: 'success', label: 'Concluído', details }
    }

    const days = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
    })

    const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Meu Calendário</h1>
                <div className="flex items-center gap-4 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                    <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronLeft className="w-5 h-5" /></button>
                    <span className="font-bold text-gray-900 w-32 text-center select-none">
                        {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronRight className="w-5 h-5" /></button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                        <div key={d} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                            {d}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 auto-rows-[120px]">
                    {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="bg-gray-50/10 border-b border-r border-gray-100" />
                    ))}

                    {days.map(day => {
                        const { status, label, details } = getDailyStatus(day)
                        const isToday = isSameDay(day, new Date())

                        let bgClass = 'bg-white'

                        if (status === 'none-joined') bgClass = 'bg-gray-100/50'
                        if (status === 'off') bgClass = 'bg-gray-50/50'
                        if (status === 'missed') bgClass = 'bg-red-50'
                        if (status === 'late') bgClass = 'bg-yellow-50'
                        if (status === 'incomplete') bgClass = 'bg-red-50'
                        if (status === 'success') bgClass = 'bg-green-50'
                        if (status === 'justified') bgClass = 'bg-blue-50'
                        if (status === 'pending') bgClass = 'bg-orange-50'

                        const canClick = status !== 'none-joined' && status !== 'off' && status !== 'future'

                        return (
                            <div
                                key={day.toISOString()}
                                onClick={() => canClick && setSelectedDay({ date: day, status: { status, label, details } })}
                                className={`p-2 border-b border-r border-gray-100 ${bgClass} relative group transition-colors hover:bg-opacity-80 flex flex-col justify-between ${canClick ? 'cursor-pointer hover:ring-2 hover:ring-indigo-200 z-10' : ''}`}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-700'}`}>
                                        {format(day, 'd')}
                                    </span>
                                    {status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                    {(status === 'missed' || status === 'incomplete') && <XCircle className="w-4 h-4 text-red-500" />}
                                    {status === 'late' && <Clock className="w-4 h-4 text-yellow-600" />}
                                    {status === 'justified' && <FileText className="w-4 h-4 text-blue-500" />}
                                    {status === 'pending' && <Clock className="w-4 h-4 text-orange-500" />}
                                </div>

                                <div className="text-center">
                                    {status !== 'off' && status !== 'none' && status !== 'none-joined' && (
                                        <div className={`text-[10px] font-bold px-1 py-0.5 rounded border inline-block max-w-full truncate ${status === 'success' ? 'bg-green-100 text-green-700 border-green-200' :
                                            (status === 'missed' || status === 'incomplete') ? 'bg-red-100 text-red-700 border-red-200' :
                                                status === 'late' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                    status === 'justified' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                        status === 'pending' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                            status === 'future' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                                'bg-gray-100 text-gray-500 border-gray-200'
                                            }`}>
                                            {label}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Details Modal */}
            {selectedDay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 capitalize">
                                {format(selectedDay.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                            </h3>
                            <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Status Header */}
                            <div className={`p-4 rounded-xl flex items-center gap-3 ${selectedDay.status.status === 'success' ? 'bg-green-50 text-green-700' :
                                selectedDay.status.status === 'incomplete' ? 'bg-red-50 text-red-700' :
                                    selectedDay.status.status === 'missed' ? 'bg-red-50 text-red-700' :
                                        selectedDay.status.status === 'late' ? 'bg-yellow-50 text-yellow-700' :
                                            selectedDay.status.status === 'justified' ? 'bg-blue-50 text-blue-700' :
                                                selectedDay.status.status === 'pending' ? 'bg-orange-50 text-orange-700' :
                                                    'bg-gray-100 text-gray-600'
                                }`}>
                                <div className="flex-1">
                                    <p className="font-bold text-lg uppercase">{selectedDay.status.label}</p>
                                    <p className="text-xs opacity-80">Resumo do dia</p>
                                </div>
                            </div>

                            {/* Details List */}
                            <div className="space-y-2 text-sm text-gray-600">
                                {selectedDay.status.details.isLate && (
                                    <div className="flex justify-between text-yellow-700 font-medium">
                                        <span>Atraso:</span>
                                        <span>+{selectedDay.status.details.lateMinutes} min</span>
                                    </div>
                                )}
                                {selectedDay.status.details.isIncomplete && (
                                    <div className="flex justify-between text-red-600 font-medium">
                                        <span>Horas Devidas:</span>
                                        <span>{Math.floor(selectedDay.status.details.missingMinutes / 60)}h {selectedDay.status.details.missingMinutes % 60}m</span>
                                    </div>
                                )}

                                <hr className="border-gray-100 my-2" />

                                <div className="flex justify-between">
                                    <span>Meta do Dia:</span>
                                    <span className="font-mono font-bold">
                                        {(selectedDay.status.details.targetDuration / 60).toFixed(1)}h
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Horas Trabalhadas:</span>
                                    <span className="font-mono font-bold">{(selectedDay.status.details.workedMinutes / 60).toFixed(1)}h</span>
                                </div>
                            </div>

                            {/* Justification UI */}
                            {(selectedDay.status.status === 'missed' || selectedDay.status.status === 'incomplete' || selectedDay.status.status === 'late') && !selectedDay.status.details.justification && (
                                <div className="mt-4 animate-in slide-in-from-bottom-2">
                                    <hr className="border-gray-100 mb-4" />
                                    <h4 className="font-bold text-gray-900 mb-2 text-sm">Justificar Ocorrência</h4>
                                    <textarea
                                        className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mb-2 text-gray-900"
                                        rows={3}
                                        placeholder="Escreva o motivo (ex: Médico, Trânsito...)"
                                        value={justificationReason}
                                        onChange={e => setJustificationReason(e.target.value)}
                                    />
                                    <button
                                        onClick={sendJustification}
                                        disabled={!justificationReason.trim() || sendingJustification}
                                        className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {sendingJustification ? <span className="animate-spin">Wait</span> : <Send className="w-4 h-4" />}
                                        Enviar Justificativa
                                    </button>
                                </div>
                            )}

                            {selectedDay.status.details.justification && (
                                <div className="mt-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Status da Justificativa</p>
                                    <div className="flex items-center gap-2 mb-2">
                                        {selectedDay.status.details.justification.status === 'PENDING' && <span className="text-orange-600 font-bold text-xs bg-orange-100 px-2 py-0.5 rounded">EM ANÁLISE</span>}
                                        {selectedDay.status.details.justification.status === 'APPROVED' && <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-0.5 rounded">APROVADA</span>}
                                        {selectedDay.status.details.justification.status === 'REJECTED' && <span className="text-red-600 font-bold text-xs bg-red-100 px-2 py-0.5 rounded">REJEITADA</span>}
                                    </div>
                                    <p className="text-sm text-gray-700 italic">"{selectedDay.status.details.justification.reason}"</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
