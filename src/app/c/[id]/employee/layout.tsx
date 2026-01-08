'use client'

import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useState, useEffect, use } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { ArrowLeft, LayoutDashboard, Calendar, User, Clock } from 'lucide-react'

export default function EmployeeLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const { user, loading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const supabase = createClient()
    const [authorized, setAuthorized] = useState(false)
    const [checking, setChecking] = useState(true)
    const [companyName, setCompanyName] = useState('')
    const [profile, setProfile] = useState<{ full_name: string | null }>({ full_name: null })

    useEffect(() => {
        const checkAccess = async () => {
            if (!user) return

            const { data: member } = await supabase
                .from('company_members')
                .select('role, company:companies(name)')
                .eq('user_id', user.id)
                .eq('company_id', id)
                .single()

            if (!member) {
                router.push('/setup')
            } else {
                setAuthorized(true)
                // @ts-ignore
                setCompanyName(member.company?.name || 'Empresa')
            }
            setChecking(false)
        }

        if (!loading) {
            if (!user) {
                router.push('/')
            } else {
                checkAccess()
            }
        }
    }, [user, loading, router, id])

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return
            const { data } = await supabase
                .from('user_profiles')
                .select('full_name')
                .eq('id', user.id)
                .single()

            if (data) setProfile(data)
            else if (user.user_metadata?.full_name) setProfile({ full_name: user.user_metadata.full_name })
        }
        fetchProfile()
    }, [user])

    const isActive = (path: string) => pathname === path

    if (loading || checking) return <div className="flex h-screen items-center justify-center text-indigo-600 font-medium animate-pulse">Verificando acesso...</div>
    if (!user || !authorized) return null

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
            {/* Header Dark Mode matching Admin */}
            <header className="bg-indigo-950 text-white shadow-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <Link href="/setup" className="bg-white/10 text-indigo-100 p-1.5 rounded hover:bg-white/20 transition-colors" title="Voltar ao Portal">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <span className="font-bold text-lg tracking-tight truncate max-w-[150px] sm:max-w-xs">{companyName}</span>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-1">
                            <Link
                                href={`/c/${id}/employee`}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive(`/c/${id}/employee`) ? 'bg-white/10 text-white' : 'text-indigo-200 hover:text-white hover:bg-white/5'}`}
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                            </Link>
                            <Link
                                href={`/c/${id}/employee/calendar`}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive(`/c/${id}/employee/calendar`) ? 'bg-white/10 text-white' : 'text-indigo-200 hover:text-white hover:bg-white/5'}`}
                            >
                                <Calendar className="w-4 h-4" />
                                Calendário
                            </Link>
                            <Link
                                href={`/c/${id}/employee/profile`}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive(`/c/${id}/employee/profile`) ? 'bg-white/10 text-white' : 'text-indigo-200 hover:text-white hover:bg-white/5'}`}
                            >
                                <User className="w-4 h-4" />
                                Perfil
                            </Link>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2 text-sm text-indigo-200 bg-indigo-900/50 px-3 py-1.5 rounded-full border border-indigo-800">
                            <User className="w-4 h-4 text-indigo-400" />
                            <span>{profile.full_name || user.email}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
                <div className="flex justify-around p-2">
                    <Link
                        href={`/c/${id}/employee`}
                        className={`flex flex-col items-center p-2 rounded-xl min-w-[60px] transition-all ${isActive(`/c/${id}/employee`) ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400'}`}
                    >
                        <LayoutDashboard className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Início</span>
                    </Link>
                    <Link
                        href={`/c/${id}/employee/calendar`}
                        className={`flex flex-col items-center p-2 rounded-xl min-w-[60px] transition-all ${isActive(`/c/${id}/employee/calendar`) ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400'}`}
                    >
                        <Calendar className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Agenda</span>
                    </Link>
                    <Link
                        href={`/c/${id}/employee/profile`}
                        className={`flex flex-col items-center p-2 rounded-xl min-w-[60px] transition-all ${isActive(`/c/${id}/employee/profile`) ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400'}`}
                    >
                        <User className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">Perfil</span>
                    </Link>
                </div>
            </div>

            <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-20 md:mb-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {children}
            </main>
        </div>
    )
}
