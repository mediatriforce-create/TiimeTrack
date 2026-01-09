'use client'

import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useEffect, useState, use } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, UserX, UserCheck, Users, Activity, Copy, Check, Timer } from 'lucide-react'

type EmployeeSummary = {
    id: string
    full_name: string
    email: string
    last_event: 'entry' | 'pause' | 'return' | 'exit' | null
    last_time: string | null
}

export default function AdminDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id: companyId } = use(params)
    const { user } = useAuth()
    const supabase = createClient()
    const [employees, setEmployees] = useState<EmployeeSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        // Ticking timer for real-time calculation
        const interval = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        async function fetchData() {
            if (!user) return

            // 1. Get all employees for this company (via company_members)
            const { data: members } = await supabase
                .from('company_members')
                .select(`
                    user:user_profiles (id, full_name, email)
                `)
                .eq('company_id', companyId)
                .eq('role', 'employee')

            // Map to flat structure and filter nulls
            const users = members?.map((m: any) => m.user).filter((u: any) => !!u) || []

            // 3. Get TODAY'S latest entry for each employee to determine status
            const summaries: EmployeeSummary[] = []

            if (users) {
                for (const u of users) {
                    const { data: lastEntry } = await supabase
                        .from('time_entries')
                        .select('event_type, timestamp')
                        .eq('user_id', u.id)
                        .order('timestamp', { ascending: false })
                        .limit(1)
                        .single()

                    summaries.push({
                        id: u.id,
                        full_name: u.full_name || 'Sem nome',
                        email: u.email || '',
                        last_event: lastEntry ? lastEntry.event_type : null,
                        last_time: lastEntry ? lastEntry.timestamp : null
                    })
                }
            }

            setEmployees(summaries)
            setLoading(false)
        }

        fetchData()
    }, [user])

    const copyCode = () => {
        navigator.clipboard.writeText(companyId)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const getStatusBadge = (status: EmployeeSummary['last_event']) => {
        switch (status) {
            case 'entry':
            case 'return':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Trabalhando
                    </span>
                )
            case 'pause':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Em Pausa</span>
            case 'exit':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">Saiu</span>
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-400 border border-gray-200">Offline</span>
        }
    }

    const getElapsedTime = (startTime: string | null) => {
        if (!startTime) return '00:00:00'
        const start = new Date(startTime).getTime()
        const current = now.getTime()
        const diff = Math.max(0, current - start)

        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }

    // Stats
    const totalEmployees = employees.length
    const activeNow = employees.filter(e => e.last_event === 'entry' || e.last_event === 'return').length
    const offline = totalEmployees - activeNow

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Visão Geral</h1>
                    <p className="text-gray-500 mt-1">
                        {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 shadow-sm">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span className="font-mono">{format(now, 'HH:mm:ss')}</span>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={copyCode}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm group"
                >
                    <span className="text-gray-400 group-hover:text-indigo-400">ID da Empresa:</span>
                    <span className="font-mono">{companyId.slice(0, 8)}...</span>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:shadow-lg transition-all hover:border-indigo-100">
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Equipe Total</p>
                        <p className="text-4xl font-extrabold text-gray-900 mt-2">{totalEmployees}</p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Users className="w-8 h-8" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:shadow-lg transition-all hover:border-green-100">
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Ativos Agora</p>
                        <p className="text-4xl font-extrabold text-green-600 mt-2">{activeNow}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors">
                        <Activity className="w-8 h-8" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:shadow-lg transition-all hover:border-gray-200">
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Offline / Ausentes</p>
                        <p className="text-4xl font-extrabold text-gray-400 mt-2">{offline}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl text-gray-400 group-hover:bg-gray-400 group-hover:text-white transition-colors">
                        <UserX className="w-8 h-8" />
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white shadow-lg shadow-gray-100 border border-gray-100 rounded-3xl overflow-hidden">
                <div className="px-6 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        Monitoramento em Tempo Real
                    </h3>
                </div>

                <ul className="divide-y divide-gray-100">
                    {loading ? (
                        <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                            <Activity className="w-8 h-8 animate-spin mb-2 opacity-50" />
                            <p>Atualizando dados...</p>
                        </div>
                    ) : employees.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 bg-gray-50/30">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Nenhum funcionário encontrado.</p>
                            <p className="text-sm mt-1">Compartilhe o ID da empresa para adicionar membros.</p>
                        </div>
                    ) : (
                        employees.map((employee) => {
                            const isActive = employee.last_event === 'entry' || employee.last_event === 'return'
                            return (
                                <li key={employee.id} className="px-6 py-5 hover:bg-indigo-50/30 transition-colors group">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex-shrink-0">
                                                <span className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner transition-colors ${isActive ? 'bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 ring-2 ring-indigo-200' : 'bg-gray-100 text-gray-400'}`}>
                                                    {employee.full_name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-base font-bold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">{employee.full_name}</div>
                                                <div className="text-sm text-gray-500 truncate">{employee.email}</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 justify-between sm:justify-start w-full sm:w-auto mt-2 sm:mt-0">
                                            {getStatusBadge(employee.last_event)}

                                            {isActive && employee.last_time && (
                                                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                                    <Timer className="w-4 h-4 text-indigo-600 animate-pulse" />
                                                    <span className="font-mono text-sm font-bold text-indigo-900">
                                                        {getElapsedTime(employee.last_time)}
                                                    </span>
                                                </div>
                                            )}

                                            {!isActive && employee.last_time && (
                                                <div className="text-xs font-medium text-gray-400 flex items-center gap-1">
                                                    Último evento: {format(new Date(employee.last_time), 'HH:mm')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            )
                        })
                    )}
                </ul>
            </div>
        </div>
    )
}
