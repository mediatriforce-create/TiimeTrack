'use client'

import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { User, LogOut, AlertTriangle, Briefcase } from 'lucide-react'

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: companyId } = use(params)
    const { user } = useAuth()
    const supabase = createClient()
    const router = useRouter()

    const [loading, setLoading] = useState(false)
    const [companyName, setCompanyName] = useState('')
    const [profile, setProfile] = useState<{ full_name: string | null }>({ full_name: null })

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

    useEffect(() => {
        if (companyId) {
            supabase.from('companies').select('name').eq('id', companyId).single().then(({ data }) => {
                if (data) setCompanyName(data.name)
            })
        }
    }, [companyId])

    const handleLeaveCompany = async () => {
        if (!confirm('Tem certeza que deseja sair desta empresa? Você perderá acesso ao histórico.')) return

        setLoading(true)
        const { error } = await supabase
            .from('company_members')
            .delete()
            .eq('company_id', companyId)
            // RLS usually requires filtering by user_id too, but assuming policy allows "delete own membership"
            .eq('user_id', user?.id)

        if (error) {
            alert('Erro ao sair: ' + error.message)
            setLoading(false)
        } else {
            router.push('/setup') // Back to portal
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-8 flex flex-col items-center border-b border-gray-100 bg-gray-50/50">
                    <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-3xl mb-4 shadow-inner ring-4 ring-white">
                        {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{profile.full_name || 'Sem Nome'}</h2>
                    <p className="text-gray-500">{user?.email}</p>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 text-gray-700">
                        <div className="p-2 bg-white rounded-lg shadow-sm text-gray-400">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-medium uppercase">Empresa Atual</p>
                            <p className="font-semibold text-gray-900">{companyName || 'Carregando...'}</p>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    <div className="pt-2">
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            Zona de Perigo
                        </h3>
                        <div className="bg-red-50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-red-100">
                            <div className="text-sm text-red-800">
                                <p className="font-bold">Sair da Empresa</p>
                                <p className="opacity-80">Você perderá o acesso e não poderá mais registrar pontos.</p>
                            </div>
                            <button
                                onClick={handleLeaveCompany}
                                disabled={loading}
                                className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm whitespace-nowrap"
                            >
                                {loading ? 'Saindo...' : 'Sair da Empresa'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
