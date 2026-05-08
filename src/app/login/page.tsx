'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin() {
    if (!email || !password) {
      setErreur('Veuillez remplir tous les champs.')
      return
    }
    setChargement(true)
    setErreur(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErreur('Email ou mot de passe incorrect.')
      setChargement(false)
      return
    }

    router.push('/salon')
  }

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-4">

      {/* Fond décoratif subtil */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-stone-200/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-stone-300/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Logo / Titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-stone-800 rounded-2xl mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-stone-800">Salon Éclat</h1>
          <p className="text-sm text-stone-400 mt-1">Connectez-vous à votre espace</p>
        </div>

        {/* Carte formulaire */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="exemple@email.com"
              autoComplete="email"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400 transition-colors placeholder:text-stone-300"
            />
          </div>

          {/* Mot de passe */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 pr-10 text-sm text-stone-700 bg-white outline-none focus:border-stone-400 transition-colors placeholder:text-stone-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Message d'erreur */}
          {erreur && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-xs text-red-500">{erreur}</p>
            </div>
          )}

          {/* Bouton connexion */}
          <button
            onClick={handleLogin}
            disabled={chargement}
            className="w-full bg-stone-800 text-white rounded-xl py-3 text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors mt-1"
          >
            {chargement ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connexion...
              </span>
            ) : 'Se connecter'}
          </button>
        </div>

        {/* Lien retour page client */}
        <p className="text-center mt-5 text-xs text-stone-400">
          Pas encore de compte ?{' '}
          <a href="/" className="text-stone-600 hover:underline font-medium">
            Retour à l&apos;accueil
          </a>
        </p>

      </div>
    </main>
  )
}