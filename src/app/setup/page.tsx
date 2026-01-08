'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, Building2, UserPlus, LogOut, ArrowRight, Plus, Zap } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

type CompanyMembership = {
    company: {
        id: string
        name: string
    }
    role: 'admin' | 'employee'
}

export default function PortalPage() {
    const { user, signOut } = useAuth()
    const router = useRouter()
    const supabase = createClient()

    // State
    const [memberships, setMemberships] = useState<CompanyMembership[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'list' | 'create' | 'join'>('list')

    // Forms
    const [companyName, setCompanyName] = useState('')
    const [companyCode, setCompanyCode] = useState('')
    const [actionLoading, setActionLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (user) fetchMemberships()
    }, [user])

    const fetchMemberships = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('company_members')
            .select(`
                role,
                company:companies(id, name)
            `)
            .eq('user_id', user?.id)

        if (error) console.error(error)

        // Cast data because TS doesn't know the deeply nested structure perfectly without types
        const typedData = (data || []).map((item: any) => ({
            company: item.company,
            role: item.role
        })) as CompanyMembership[]

        setMemberships(typedData)
        setLoading(false)
    }

    const handleCreateCompany = async (e: React.FormEvent) => {
        e.preventDefault()
        setActionLoading(true)
        setError(null)

        try {
            // 1. Create Company
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .insert({ name: companyName })
                .select()
                .single()

            if (companyError) throw new Error("Erro ao criar empresa: " + companyError.message)

            // 2. Create Membership (Admin)
            const { error: memberError } = await supabase
                .from('company_members')
                .insert({
                    user_id: user?.id,
                    company_id: company.id,
                    role: 'admin'
                })

            if (memberError) throw new Error("Erro ao vincular membro: " + memberError.message)

            // Refresh and View
            await fetchMemberships()
            setView('list')
            setCompanyName('')

        } catch (err: any) {
            setError(err.message)
        } finally {
            setActionLoading(false)
        }
    }

    const handleJoinCompany = async (e: React.FormEvent) => {
        e.preventDefault()
        setActionLoading(true)
        setError(null)

        try {
            // 1. Check if Code exists
            const { data: company, error: checkError } = await supabase
                .from('companies')
                .select('id')
                .eq('id', companyCode.trim())
                .single()

            if (checkError || !company) throw new Error("Empresa não encontrada. Verifique o código.")

            // 2. Create Membership (Employee)
            const { error: memberError } = await supabase
                .from('company_members')
                .insert({
                    user_id: user?.id,
                    company_id: company.id,
                    role: 'employee'
                })

            if (memberError) {
                if (memberError.code === '23505') throw new Error("Você já faz parte desta empresa.")
                throw new Error("Erro ao entrar: " + memberError.message)
            }

            // Refresh
            await fetchMemberships()
            setView('list')
            setCompanyCode('')

        } catch (err: any) {
            setError(err.message)
        } finally {
            setActionLoading(false)
        }
    }

    const enterCompany = (companyId: string, role: string) => {
        // Redirect to specialized route
        // We will move dashboard to /c/[id]/...
        const path = role === 'admin' ? 'admin' : 'employee'
        router.push(`/c/${companyId}/${path}`)
    }

    if (!user) return null

    const myCompanies = memberships.filter(m => m.role === 'admin')
    const otherCompanies = memberships.filter(m => m.role === 'employee')

    return (
        <div className="min-h-screen bg-gray-50 font-sans selection:bg-indigo-500 selection:text-white">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-8 shadow-sm rounded-2xl border border-indigo-50 gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none"></div>

                    <div className="relative z-10 w-full text-center sm:text-left">
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center justify-center sm:justify-start gap-3">
                            <div className="p-2 bg-indigo-600 rounded-lg text-white">
                                <Zap className="w-6 h-6 fill-white" />
                            </div>
                            Seu Portal
                        </h1>
                        <p className="text-gray-500 mt-2 text-lg">Gerencie suas empresas ou acesse seus pontos.</p>
                    </div>
                    <div className="flex items-center gap-6 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 relative z-10">
                        <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user.email}</span>
                        <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>
                        <button onClick={signOut} className="text-gray-500 hover:text-red-600 font-medium text-sm flex items-center gap-2 transition-colors">
                            <LogOut className="w-4 h-4" /> Sair
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                {view === 'list' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500 relative">

                        {/* Vertical line divider for Desktop */}
                        <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 -ml-px transform translate-x-1/2"></div>

                        {/* 1. Minhas Empresas (Admin) */}
                        <section className="lg:pr-12">
                            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center justify-center lg:justify-start gap-3">
                                <span className="inline-block w-2 h-8 bg-indigo-600 rounded-full"></span>
                                Minhas Empresas (Admin)
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-6">
                                {/* List Companies */}
                                {myCompanies.map(m => (
                                    <div key={m.company.id} className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-xl hover:shadow-indigo-100 hover:border-indigo-100 transition-all duration-300">
                                        <div>
                                            <h3 className="font-bold text-2xl text-gray-900 mb-2 tracking-tight group-hover:text-indigo-700 transition-colors">{m.company.name}</h3>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white uppercase tracking-wider">
                                                Administrador
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => enterCompany(m.company.id, 'admin')}
                                            className="mt-8 w-full flex items-center justify-between bg-white text-gray-700 py-3 px-4 border border-gray-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all font-medium rounded-xl group-hover:translate-x-1"
                                        >
                                            Gerenciar <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}

                                {/* Card to Create New */}
                                <button
                                    onClick={() => setView('create')}
                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all duration-300 group min-h-[200px]"
                                >
                                    <div className="bg-gray-100 p-4 rounded-full mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                                        <Plus className="w-8 h-8" />
                                    </div>
                                    <span className="font-bold text-lg">Criar Nova Empresa</span>
                                </button>
                            </div>
                        </section>

                        {/* Divider for Mobile (Horizontal) - Hidden on desktop */}
                        <div className="lg:hidden relative py-8">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-gray-50 px-2 text-gray-400 text-sm">Área do Colaborador</span>
                            </div>
                        </div>

                        {/* 2. Empresas que Participo (Employee) */}
                        <section className="lg:pl-12">
                            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center justify-center lg:justify-start gap-3">
                                <span className="inline-block w-2 h-8 bg-violet-500 rounded-full"></span>
                                Área do Colaborador
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-6">
                                {otherCompanies.map(m => (
                                    <div key={m.company.id} className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-xl hover:shadow-violet-100 hover:border-violet-100 transition-all duration-300">
                                        <div>
                                            <h3 className="font-bold text-2xl text-gray-900 mb-2 tracking-tight">{m.company.name}</h3>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-700 uppercase tracking-wider">
                                                Funcionário
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => enterCompany(m.company.id, 'employee')}
                                            className="mt-8 w-full flex items-center justify-between bg-violet-600 text-white py-3 px-4 border border-transparent hover:bg-violet-700 transition-all font-medium rounded-xl shadow-md hover:shadow-xl hover:-translate-y-0.5"
                                        >
                                            Acessar Ponto <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}

                                <button
                                    onClick={() => setView('join')}
                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 hover:border-violet-500 hover:text-violet-600 hover:bg-violet-50/50 transition-all duration-300 group min-h-[220px]"
                                >
                                    <div className="bg-gray-100 p-4 rounded-full mb-4 group-hover:bg-violet-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                                        <Plus className="w-8 h-8" />
                                    </div>
                                    <span className="font-bold text-lg">Entrar em Outra</span>
                                </button>
                            </div>
                        </section>

                    </div>
                )}

                {/* Create Form */}
                {view === 'create' && (
                    <div className="max-w-lg mx-auto bg-white p-10 rounded-3xl shadow-2xl shadow-indigo-100 border border-gray-100 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-2 bg-indigo-600"></div>
                        <div className="text-center mb-8">
                            <div className="inline-flex p-3 bg-indigo-600 text-white rounded-2xl mb-4 shadow-lg shadow-indigo-200">
                                <Building2 className="w-8 h-8" />
                            </div>
                            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Nova Empresa</h2>
                            <p className="text-gray-500 mt-2">Dê um nome para sua nova organização.</p>
                        </div>

                        {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-6 text-sm font-medium flex items-center gap-2 border border-red-100">⚠️ {error}</div>}

                        <form onSubmit={handleCreateCompany} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nome da Empresa</label>
                                <input
                                    className="w-full border border-gray-200 p-4 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none font-medium placeholder:font-normal text-gray-900"
                                    placeholder="Ex: Minha Loja Matriz"
                                    value={companyName}
                                    onChange={e => setCompanyName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button type="button" onClick={() => setView('list')} className="flex-1 py-3.5 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors text-gray-700">Cancelar</button>
                                <button type="submit" disabled={actionLoading} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-0">
                                    {actionLoading ? 'Criando...' : 'Criar Empresa'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Join Form */}
                {view === 'join' && (
                    <div className="max-w-lg mx-auto bg-white p-10 rounded-3xl shadow-2xl shadow-violet-100 border border-gray-100 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-2 bg-violet-600"></div>
                        <div className="text-center mb-8">
                            <div className="inline-flex p-3 bg-violet-100 text-violet-700 rounded-2xl mb-4">
                                <UserPlus className="w-8 h-8" />
                            </div>
                            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Entrar em Empresa</h2>
                            <p className="text-gray-500 mt-2">Insira o ID fornecido pelo administrador.</p>
                        </div>

                        {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-6 text-sm font-medium flex items-center gap-2 border border-red-100">⚠️ {error}</div>}

                        <form onSubmit={handleJoinCompany} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Código da Empresa (UUID)</label>
                                <input
                                    className="w-full border border-gray-200 p-4 rounded-xl focus:ring-4 focus:ring-violet-100 focus:border-violet-600 transition-all outline-none font-mono text-sm placeholder:font-sans text-gray-900"
                                    placeholder="Ex: 550e8400-e29b-41d4-a716-446655440000"
                                    value={companyCode}
                                    onChange={e => setCompanyCode(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button type="button" onClick={() => setView('list')} className="flex-1 py-3.5 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors text-gray-700">Cancelar</button>
                                <button type="submit" disabled={actionLoading} className="flex-1 py-3.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 font-bold shadow-lg shadow-violet-200 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-0">
                                    {actionLoading ? 'Entrando...' : 'Entrar'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

            </div>
        </div>
    )
}
