'use client'

import { useAuth } from '@/components/AuthProvider'
import { ArrowLeft, LayoutDashboard, Users, User, AlertCircle, Settings } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase'

export default function AdminLayout({
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
    const [isAdmin, setIsAdmin] = useState(false)
    const [checkingRole, setCheckingRole] = useState(true)

    useEffect(() => {
        const checkAdmin = async () => {
            if (!user) return

            // Check if user is admin of THIS company (id)
            const { data: member } = await supabase
                .from('company_members')
                .select('role')
                .eq('user_id', user.id)
                .eq('company_id', id)
                .single()

            if (member?.role !== 'admin') {
                router.push('/setup') // Back to portal if not authorized
            } else {
                setIsAdmin(true)
            }
            setCheckingRole(false)
        }

        if (!loading) {
            if (!user) {
                router.push('/')
            } else {
                checkAdmin()
            }
        }
    }, [user, loading, router, id])

    if (loading || checkingRole) return <div className="flex h-screen items-center justify-center text-indigo-600 animate-pulse font-medium">Verificando privilégios...</div>
    if (!user || !isAdmin) return null

    const navItems = [
        { href: `/c/${id}/admin`, label: 'Visão Geral', icon: LayoutDashboard },
        { href: `/c/${id}/admin/employees`, label: 'Equipe', icon: Users },
        { href: `/c/${id}/admin/inconsistencies`, label: 'Inconsistências', icon: AlertCircle },
        { href: `/c/${id}/admin/settings`, label: 'Configurações', icon: Settings },
    ]

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
            {/* Header Dark Mode for Admin */}
            <header className="bg-indigo-950 text-white shadow-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <Link href="/setup" className="bg-white/10 text-indigo-100 p-1.5 rounded hover:bg-white/20 transition-colors" title="Voltar ao Portal">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <span className="font-bold text-lg tracking-tight">TimeTrack <span className="text-indigo-400">Admin</span></span>
                        </div>

                        <nav className="hidden md:flex gap-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href
                                const Icon = item.icon
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all
                      ${isActive
                                                ? 'bg-indigo-800/50 text-white shadow-inner border border-indigo-700'
                                                : 'text-indigo-300 hover:text-white hover:bg-indigo-900'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2 text-sm text-indigo-200 bg-indigo-900/50 px-3 py-1.5 rounded-full border border-indigo-800">
                            <User className="w-4 h-4 text-indigo-400" />
                            <span>{user.email}</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
                {children}
            </main>
        </div>
    )
}
