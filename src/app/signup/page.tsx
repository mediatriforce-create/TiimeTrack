'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowRight, Zap, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // 1. Sign Up
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            })

            if (authError) throw authError
            if (!authData.user) throw new Error("Erro ao criar usuário.")

            // 2. Create Profile (Basic)
            const { error: profileError } = await supabase
                .from('user_profiles')
                .insert({
                    id: authData.user.id,
                    email: email,
                    full_name: fullName,
                })

            // If profile fails (rare race condition or RLS), usually it's fine or handled by triggers.
            // But here we insert explicitly.
            if (profileError) {
                console.error("Profile creation warning:", profileError)
                // We don't block flow necessarily, but good to know.
            }

            // Success! Redirect.
            router.push('/setup')

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-white font-sans selection:bg-indigo-500 selection:text-white">

            {/* Esquerda: Branding (Reutilizando estilo do Login mas com variação) */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-indigo-950 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900 to-violet-900 opacity-90 z-10" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay" />

                <div className="relative z-20 flex flex-col justify-center px-16 h-full text-white space-y-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 text-indigo-100 text-sm font-medium">
                            <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                            Embarque Imediato
                        </div>
                        <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
                            Junte-se à revolução <br /> do <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-400">trabalho moderno</span>.
                        </h1>
                        <p className="text-lg text-indigo-200 max-w-md leading-relaxed">
                            Crie sua conta em segundos e comece a transformar a produtividade da sua equipe.
                        </p>
                    </div>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <div className="p-2 bg-indigo-500 rounded-lg">
                                <CheckCircle2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Controle Total</h3>
                                <p className="text-indigo-200 text-sm">Painéis administrativos completos.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <div className="p-2 bg-violet-500 rounded-lg">
                                <CheckCircle2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Flexibilidade</h3>
                                <p className="text-indigo-200 text-sm">Multi-empresas e multi-cargos.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Direita: Signup Form */}
            <div className="flex-1 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-24 bg-gray-50">
                <div className="w-full max-w-md space-y-10 bg-white p-10 rounded-2xl shadow-xl shadow-indigo-100/50">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Crie sua conta</h2>
                        <p className="text-gray-500">Comece gratuitamente. Sem cartão de crédito.</p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSignup}>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome Completo</label>
                            <input
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="block w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none bg-gray-50 focus:bg-white"
                                placeholder="João Silva"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Profissional</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none bg-gray-50 focus:bg-white"
                                placeholder="joao@empresa.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Senha Forte</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none bg-gray-50 focus:bg-white"
                                placeholder="Min. 8 caracteres"
                            />
                        </div>

                        {error && (
                            <div className="p-4 rounded-lg bg-red-50 border border-red-100 flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                <p className="text-sm font-medium text-red-600">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-lg shadow-lg shadow-indigo-500/20 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-none"
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                <span className="flex items-center gap-2">Finalizar Cadastro <ArrowRight className="w-4 h-4" /></span>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-sm text-gray-600">
                        Já tem uma conta?{' '}
                        <Link href="/" className="font-bold text-indigo-600 hover:text-indigo-500 hover:underline transition-colors">
                            Fazer login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
