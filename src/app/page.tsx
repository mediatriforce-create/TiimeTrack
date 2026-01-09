'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [greeting, setGreeting] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // 1. Greeting
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Bom dia')
    else if (hour < 18) setGreeting('Boa tarde')
    else setGreeting('Boa noite')

    // 2. Auto-Redirect if Logged In
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/setup') // Redirects to portal/dashboard
      }
    }
    checkSession()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (user) {
      router.push('/setup')
    }
  }

  return (
    <div className="h-screen w-full flex bg-white font-sans selection:bg-indigo-500 selection:text-white overflow-hidden">

      {/* Mobile Landing Page (Only visible on Mobile when !showLogin) */}
      <div className={`lg:hidden fixed inset-0 z-50 bg-indigo-900 flex flex-col justify-center px-8 transition-transform duration-500 ${showLogin ? '-translate-x-full' : 'translate-x-0'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-indigo-900 opacity-90 z-10" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay" />

        <div className="relative z-20 text-white space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-indigo-100 text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping absolute"></span>
              <span className="w-2 h-2 rounded-full bg-indigo-500 relative"></span>
              Controle Inteligente
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight mb-4">
              {greeting}. <br />
              Seu tempo vale <span className="text-indigo-300">ouro</span>.
            </h1>
            <p className="text-indigo-100 text-lg max-w-xs">
              Gerencie sua jornada e equipe com maestria, na palma da sua mão.
            </p>
          </div>

          <div className="pt-8">
            <button
              onClick={() => setShowLogin(true)}
              className="w-full flex items-center justify-center gap-2 py-4 bg-white text-indigo-900 rounded-xl font-bold text-lg shadow-xl shadow-indigo-900/50 active:scale-95 transition-all"
            >
              Fazer Login <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-center mt-6 text-indigo-300 text-sm">© 2024 TimeTrack Inc.</p>
          </div>
        </div>
      </div>

      {/* Desktop Left Side (Brand) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-indigo-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-indigo-900 opacity-90 z-10" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay" />

        <div className="relative z-20 flex flex-col justify-center px-16 h-full text-white space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-indigo-100 text-sm font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Controle de Ponto Inteligente
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
              Seu tempo vale <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-white">ouro</span>.
              <br /> Gerencie com maestria.
            </h1>
            <p className="text-lg text-indigo-100 max-w-md leading-relaxed">
              TimeTrack é a plataforma definitiva para empresas modernas. Controle jornadas, gerencie equipes e otimize recursos em um só lugar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-300" />
              <span className="font-medium text-white/90">Multiempesas</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-300" />
              <span className="font-medium text-white/90">Relatórios em Tempo Real</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-300" />
              <span className="font-medium text-white/90">Geolocalização (Em breve)</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-300" />
              <span className="font-medium text-white/90">Design Premium</span>
            </div>
          </div>

          <div className="pt-12 text-sm text-indigo-300 font-medium">
            © 2024 TimeTrack Inc.
          </div>
        </div>
      </div>

      {/* Login Form (Right Side) */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-24 bg-gray-50 relative overflow-y-auto w-full">
        {/* Mobile Header (When form is visible) */}
        <div className="lg:hidden w-full max-w-md mb-8 space-y-2 animate-in slide-in-from-top-4 duration-700">
          <button onClick={() => setShowLogin(false)} className="text-sm text-indigo-600 font-bold mb-2 hover:underline">← Voltar</button>
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">
            Entrar no <span className="text-indigo-600">Sistema</span>
          </h1>
        </div>
        <div className="w-full max-w-md space-y-10 bg-white p-10 rounded-2xl shadow-xl shadow-indigo-100/50">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Seja bem-vindo!</h2>
            <p className="text-gray-500">Insira suas credenciais para continuar.</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Corporativo</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none bg-gray-50 focus:bg-white"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Senha</label>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none bg-gray-50 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>
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
                <span className="flex items-center gap-2">Entrar na Plataforma <ArrowRight className="w-4 h-4" /></span>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600">
            Ainda não tem uma conta?{' '}
            <Link href="/signup" className="font-bold text-indigo-600 hover:text-indigo-500 hover:underline transition-colors">
              Comece agora gratuitamente
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
