'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { Play, Pause, Square, LogIn, Clock, AlertCircle, Calendar, ArrowRight, Sun, Moon, AlertTriangle, CheckCircle, Info, Check } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type TimeEntry = {
    id: string
    event_type: 'entry' | 'pause' | 'return' | 'exit'
    timestamp: string
}

type ScheduleConfig = {
    schedule_type: 'fixed' | 'flexible'
    work_days: string[]
    fixed_start_time: string | null
    fixed_end_time: string | null
    tolerance_minutes: number
    work_hours: string | null
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// Helper to calculate total minutes
const calculateTotalMinutes = (entries: TimeEntry[]) => {
    let totalMs = 0
    let lastTime: number | null = null

    entries.forEach(e => {
        const t = new Date(e.timestamp).getTime()
        if (e.event_type === 'entry' || e.event_type === 'return') {
            lastTime = t
        } else if ((e.event_type === 'pause' || e.event_type === 'exit') && lastTime) {
            totalMs += (t - lastTime)
            lastTime = null
        }
    })

    // Note: This calculates CLOSED intervals. For finalized day, this is correct.
    return totalMs / 60000
}

const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = Math.floor(minutes % 60)
    return `${h}h ${m.toString().padStart(2, '0')}m`
}

export default function EmployeeDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id: companyId } = use(params)
    const { user } = useAuth()
    const supabase = createClient()

    // State
    const [entries, setEntries] = useState<TimeEntry[]>([])
    const [schedule, setSchedule] = useState<ScheduleConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [userName, setUserName] = useState<string>('colaborador')

    // Occurrences State
    const [occurrences, setOccurrences] = useState<string[]>([])

    // Computed State
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null
    const currentStatus = lastEntry ? lastEntry.event_type : 'exit'
    const hasFinishedDay = entries.some(e => e.event_type === 'exit')

    useEffect(() => {
        let mounted = true
        if (user) {
            fetchData().then(() => {
                if (!mounted) return
            })
        }
        return () => { mounted = false }
    }, [user])

    // Re-calculate occurrences whenever entries/schedule change
    useEffect(() => {
        calculateOccurrences()
    }, [entries, schedule])

    const fetchData = async () => {
        setLoading(true)
        await Promise.all([fetchTodayEntries(), fetchSchedule(), fetchProfile()])
        setLoading(false)
    }

    const fetchProfile = async () => {
        if (!user) return
        const { data } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()

        if (data?.full_name) {
            setUserName(data.full_name)
        } else if (user.user_metadata?.full_name) {
            setUserName(user.user_metadata.full_name)
        }
    }

    const fetchSchedule = async () => {
        if (!user) return
        const { data } = await supabase
            .from('company_members')
            .select('schedule_type, work_days, fixed_start_time, fixed_end_time, tolerance_minutes, work_hours')
            .eq('company_id', companyId)
            .eq('user_id', user.id)
            .single()

        if (data) setSchedule(data)
    }

    const fetchTodayEntries = async () => {
        if (!user) return

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayISO = today.toISOString()

        const { data, error } = await supabase
            .from('time_entries')
            .select('*')
            .eq('user_id', user.id)
            .eq('company_id', companyId)
            .gte('timestamp', todayISO)
            .order('timestamp', { ascending: true })

        if (error) console.error(error)
        else setEntries(data || [])
    }

    const calculateOccurrences = () => {
        if (!schedule || entries.length === 0) {
            setOccurrences([])
            return
        }

        const newOccurrences: string[] = []

        // 1. Check Lateness (Atraso) based on the FIRST entry
        const firstEntry = entries.find(e => e.event_type === 'entry')
        if (firstEntry && schedule.schedule_type === 'fixed' && schedule.fixed_start_time) {
            const [h, m] = schedule.fixed_start_time.split(':').map(Number)
            const scheduleStart = new Date(firstEntry.timestamp)
            scheduleStart.setHours(h, m, 0, 0)

            const tolerance = schedule.tolerance_minutes || 0
            const limit = new Date(scheduleStart.getTime() + tolerance * 60000)
            const entryTime = new Date(firstEntry.timestamp)

            if (entryTime > limit) {
                // If late
                // Ensure we only mark if it was ON A WORK DAY? User asked for strict strictness.
                const diff = Math.floor((entryTime.getTime() - scheduleStart.getTime()) / 60000)
                newOccurrences.push(`ATRASO`) // Simple text as requested by user logic "Será dado como ATRASADO"
            }
        }

        // 2. Check Incomplete Shift (Carga Horária) based on EXIT
        const exitEntry = entries.find(e => e.event_type === 'exit')
        if (exitEntry) {
            const workedMinutes = calculateTotalMinutes(entries)

            let targetMinutes = 8 * 60 // Default
            if (schedule.schedule_type === 'fixed' && schedule.fixed_start_time && schedule.fixed_end_time) {
                const [h1, m1] = schedule.fixed_start_time.split(':').map(Number)
                const [h2, m2] = schedule.fixed_end_time.split(':').map(Number)
                targetMinutes = (h2 * 60 + m2) - (h1 * 60 + m1) // Rough gross target
            } else if (schedule.work_hours) {
                const [h, m] = schedule.work_hours.split(':').map(Number)
                targetMinutes = h * 60 + m
            }

            // Tolerance applies to total hours too? Usually yes.
            // "Carga horária não completa" usually implies significant deficit.
            // Let's use tolerance here too.
            if (workedMinutes < targetMinutes - (schedule.tolerance_minutes || 0)) {
                newOccurrences.push('CARGA HORÁRIA NÃO COMPLETA')
            }
        }

        setOccurrences(newOccurrences)
    }

    const handleRegisterPoint = async (type: 'entry' | 'pause' | 'return' | 'exit') => {
        if (!user) return
        setErrorMessage(null)

        // 1. One Shift Per Day Rule
        if (type === 'entry' && hasFinishedDay) {
            setErrorMessage('Você já finalizou sua jornada de hoje. Apenas um turno é permitido.')
            return
        }

        // 2. Lateness Warning (Pre-Action)
        if (type === 'entry' && schedule?.schedule_type === 'fixed' && schedule.fixed_start_time) {
            const now = new Date()
            const [h, m] = schedule.fixed_start_time.split(':').map(Number)
            const target = new Date()
            target.setHours(h, m, 0, 0)
            const limit = new Date(target.getTime() + (schedule.tolerance_minutes || 0) * 60000)

            if (now > limit) {
                const confirmed = window.confirm('O administrador será notificado pelo seu atraso. Será dado como ATRASADO.\n\nDeseja continuar?')
                if (!confirmed) return
            }
        }

        // 3. Incomplete Shift Warning (Pre-Action)
        if (type === 'exit') {
            const tempEntries = [...entries, { id: 'temp', event_type: 'exit', timestamp: new Date().toISOString() }] as TimeEntry[]
            const workedMinutes = calculateTotalMinutes(tempEntries) // Use helper

            let targetMinutes = 8 * 60
            if (schedule?.schedule_type === 'fixed' && schedule.fixed_start_time && schedule.fixed_end_time) {
                const [h1, m1] = schedule.fixed_start_time.split(':').map(Number)
                const [h2, m2] = schedule.fixed_end_time.split(':').map(Number)
                targetMinutes = (h2 * 60 + m2) - (h1 * 60 + m1)
            } else if (schedule?.work_hours) {
                const [h, m] = schedule.work_hours.split(':').map(Number)
                targetMinutes = h * 60 + m
            }

            if (workedMinutes < targetMinutes - (schedule?.tolerance_minutes || 0)) {
                const confirmed = window.confirm('Carga horária não completa e o administrador será notificado.\n\nDeseja encerrar mesmo assim?')
                if (!confirmed) return
            }
        }


        const { error } = await supabase.from('time_entries').insert({
            user_id: user.id,
            company_id: companyId,
            event_type: type,
        })

        if (error) {
            setErrorMessage('Erro ao registrar ponto: ' + error.message)
        } else {
            // Fetch will trigger calculateOccurrences
            await fetchTodayEntries()
        }
    }

    const renderActions = () => {
        if (hasFinishedDay) {
            return (
                <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col items-center justify-center w-full max-w-sm animate-in zoom-in-95 duration-300 relative overflow-hidden">
                    <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-500"></div>
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4 ring-4 ring-green-50/50">
                        <Check className="w-10 h-10 text-green-500 animate-in zoom-in spin-in-12 duration-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-1">Jornada Finalizada</h2>
                    <p className="text-gray-500 font-medium mb-6">Bom descanso!</p>

                    <div className="w-full bg-gray-50 rounded-xl p-4 flex justify-between items-center text-sm border border-gray-100">
                        <span className="text-gray-500">Total Hoje</span>
                        <span className="font-mono font-bold text-gray-900">{formatMinutes(calculateTotalMinutes(entries))}</span>
                    </div>
                </div>
            )
        }

        switch (currentStatus) {
            case 'exit':
                return (
                    <button
                        onClick={() => handleRegisterPoint('entry')}
                        className="group relative w-full sm:w-72 h-72 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-full shadow-2xl shadow-indigo-300 hover:scale-105 hover:shadow-indigo-400 transition-all duration-300 active:scale-95"
                    >
                        <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-[pulse_3s_ease-in-out_infinite]"></div>
                        <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                            <Play className="w-12 h-12 fill-white ml-1" />
                        </div>
                        <span className="text-xl font-bold tracking-widest uppercase text-white/90">Iniciar Dia</span>
                    </button>
                )
            case 'entry':
            case 'return':
                return (
                    <div className="grid grid-cols-2 gap-6 w-full max-w-lg">
                        <button
                            onClick={() => handleRegisterPoint('pause')}
                            className="flex flex-col items-center justify-center gap-3 p-8 bg-amber-50 rounded-2xl border-2 border-amber-100 text-amber-700 hover:bg-amber-100 hover:border-amber-200 transition-all hover:-translate-y-1 shadow-sm hover:shadow-md"
                        >
                            <Pause className="w-10 h-10" />
                            <span className="font-bold text-lg">Pausa</span>
                        </button>
                        <button
                            onClick={() => handleRegisterPoint('exit')}
                            className="flex flex-col items-center justify-center gap-3 p-8 bg-white rounded-2xl border-2 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 transition-all hover:-translate-y-1 shadow-sm hover:shadow-md"
                        >
                            <Square className="w-10 h-10 fill-current" />
                            <span className="font-bold text-lg">Encerrar</span>
                        </button>
                    </div>
                )
            case 'pause':
                return (
                    <button
                        onClick={() => handleRegisterPoint('return')}
                        className="group relative w-full sm:w-72 h-72 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-full shadow-2xl shadow-indigo-300 hover:scale-105 hover:shadow-indigo-400 transition-all duration-300 active:scale-95"
                    >
                        <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-[pulse_3s_ease-in-out_infinite]"></div>
                        <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                            <Play className="w-12 h-12 fill-white ml-1" />
                        </div>
                        <span className="text-xl font-bold tracking-widest uppercase text-white/90">Retornar</span>
                    </button>
                )
        }
    }

    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 text-indigo-600 font-medium mb-1">
                        <Sun className="w-5 h-5" />
                        {greeting}, {userName.split(' ')[0]}!
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </h1>
                </div>

                {schedule && (
                    <div className="bg-white border border-gray-200 px-5 py-3 rounded-2xl shadow-sm text-sm">
                        <p className="text-gray-500 mb-1 font-medium text-xs uppercase tracking-wider">Sua Jornada</p>
                        <div className="flex items-center gap-2 text-gray-900 font-bold">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            {schedule.schedule_type === 'fixed'
                                ? `${schedule.fixed_start_time?.slice(0, 5)} - ${schedule.fixed_end_time?.slice(0, 5)}`
                                : 'Horário Flexível'}
                        </div>
                    </div>
                )}
            </div>

            {/* Ocorrências Alert */}
            {occurrences.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl animate-in slide-in-from-top-2">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-red-800 uppercase tracking-wide text-xs mb-1">Ocorrências do Dia</p>
                            <ul className="space-y-1">
                                {occurrences.map((occ, i) => (
                                    <li key={i} className="text-red-700 font-bold text-sm flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                                        {occ}
                                    </li>
                                ))}
                            </ul>
                            <p className="text-xs text-red-600 mt-2 font-medium">O administrador foi notificado.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Action Area */}
            <div className={`min-h-[350px] flex flex-col items-center justify-center p-8 bg-white rounded-3xl shadow-xl shadow-indigo-50 border border-indigo-50 relative overflow-hidden ${hasFinishedDay ? 'opacity-90 grayscale' : ''}`}>
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

                {errorMessage && (
                    <div className="absolute top-4 inset-x-4 max-w-md mx-auto p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-center justify-center gap-2 z-10 shadow-sm">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium text-sm">{errorMessage}</span>
                    </div>
                )}

                <div className="relative z-10 w-full flex justify-center">
                    {loading ? (
                        <div className="flex flex-col items-center gap-4 text-indigo-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                            <span className="font-medium">Sincronizando...</span>
                        </div>
                    ) : renderActions()}
                </div>
            </div>

            {/* Timeline */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        Linha do Tempo
                    </h2>
                    <span className="text-xs font-medium px-2.5 py-1 bg-gray-100 rounded-lg text-gray-500 uppercase tracking-wide">Hoje</span>
                </div>

                {entries.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Sua jornada ainda não começou.</p>
                    </div>
                ) : (
                    <div className="relative border-l-2 border-indigo-100 ml-4 md:ml-6 space-y-8 py-2">
                        {entries.map((entry) => {
                            let iconDetails = { color: 'bg-gray-400', text: 'Evento', ring: 'ring-gray-100' }
                            if (entry.event_type === 'entry') iconDetails = { color: 'bg-green-500', text: 'Entrada', ring: 'ring-green-100' }
                            else if (entry.event_type === 'pause') iconDetails = { color: 'bg-amber-500', text: 'Pausa', ring: 'ring-amber-100' }
                            else if (entry.event_type === 'return') iconDetails = { color: 'bg-indigo-500', text: 'Retorno', ring: 'ring-indigo-100' }
                            else if (entry.event_type === 'exit') iconDetails = { color: 'bg-red-500', text: 'Saída', ring: 'ring-red-100' }

                            return (
                                <div key={entry.id} className="ml-8 relative group">
                                    <span className={`absolute -left-[41px] md:-left-[43px] top-1.5 w-5 h-5 rounded-full border-4 border-white shadow-sm ${iconDetails.color} group-hover:scale-110 transition-transform`}></span>

                                    <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100 hover:bg-white hover:shadow-md transition-all">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-2 h-2 rounded-full ${iconDetails.color}`}></span>
                                            <span className="font-bold text-gray-900 text-sm uppercase tracking-wide">{iconDetails.text}</span>
                                        </div>
                                        <span className="font-mono text-lg font-bold text-gray-900">
                                            {format(new Date(entry.timestamp), 'HH:mm')}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
