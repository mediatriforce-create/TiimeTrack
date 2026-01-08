'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Save, Trash2, AlertTriangle, Loader2 } from 'lucide-react'

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [companyName, setCompanyName] = useState('')
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        fetchCompany()
    }, [id])

    const fetchCompany = async () => {
        const { data, error } = await supabase
            .from('companies')
            .select('name')
            .eq('id', id)
            .single()

        if (data) {
            setCompanyName(data.name)
        }
        setLoading(false)
    }

    const handleUpdateName = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        const { error } = await supabase
            .from('companies')
            .update({ name: companyName })
            .eq('id', id)

        if (error) {
            setMessage({ type: 'error', text: 'Erro ao atualizar nome.' })
        } else {
            setMessage({ type: 'success', text: 'Nome da empresa atualizado com sucesso!' })
            router.refresh() // Refresh layout to update header name
        }
        setSaving(false)
    }

    const handleDeleteCompany = async () => {
        if (deleteConfirmText !== companyName) return

        setDeleting(true)
        setMessage(null)

        try {
            // Because we set up ON DELETE CASCADE in the database, 
            // deleting the company will delete members and time_entries automatically.
            const { error } = await supabase
                .from('companies')
                .delete()
                .eq('id', id)

            if (error) throw error

            // Redirect to Portal after deletion
            router.push('/setup')

        } catch (err: any) {
            setMessage({ type: 'error', text: 'Erro ao apagar empresa: ' + err.message })
            setDeleting(false)
            setShowDeleteModal(false)
        }
    }

    if (loading) return <div>Carregando...</div>

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Configurações da Empresa</h1>
                <p className="text-gray-500">Gerencie as informações principais da sua organização.</p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-2 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {/* Rename Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Dados Gerais</h2>
                <form onSubmit={handleUpdateName} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-900"
                            required
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 rounded-xl shadow-sm border border-red-100 p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-100 rounded-lg text-red-600">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-red-900">Zona de Perigo</h2>
                        <p className="text-red-700 mt-1 text-sm">
                            Apagar a empresa é uma ação irreversível. Todos os dados, incluindo pontos registrados e vínculos com colaboradores, serão permanentemente excluídos.
                        </p>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="mt-4 flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Apagar Empresa
                        </button>
                    </div>
                </div>
            </div>

            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Tem certeza absoluta?</h3>
                        <p className="text-gray-500 text-sm mb-4">
                            Esta ação não pode ser desfeita. Isso irá apagar permanentemente a empresa <strong>{companyName}</strong> e remover todos os dados associados.
                        </p>

                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">
                                Digite <strong>{companyName}</strong> para confirmar:
                            </label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 outline-none text-gray-900"
                                value={deleteConfirmText}
                                onChange={e => setDeleteConfirmText(e.target.value)}
                                placeholder={companyName}
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteCompany}
                                disabled={deleteConfirmText !== companyName || deleting}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {deleting ? 'Apagando...' : 'Confirmar Exclusão'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
