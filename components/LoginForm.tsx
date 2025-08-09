'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { sendPasswordReset } from '@/lib/sendPasswordReset'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const { error } = await sendPasswordReset(email)
    if (error) {
      setError(error.message)
    } else {
      setMessage('Check your email for the reset link')
      // Keep them on reset page but clear the email field
      setEmail('')
    }
    setLoading(false)
  }

  return (
    <div className="w-full max-w-md">
      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-red-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-red-600"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            className="btn w-full disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="text-sm text-white/60">
            <button 
              type="button"
              onClick={() => setMode('reset')}
              className="text-red-400 hover:text-red-300"
            >
              Forgot password?
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <h2 className="text-lg font-medium mb-4">Reset password</h2>
          <div>
            <label className="block text-sm text-white/70 mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-red-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {message && <p className="text-green-400 text-sm">{message}</p>}

          <button
            type="submit"
            className="btn w-full disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>

          <div className="text-sm text-white/60">
            <button 
              type="button"
              onClick={() => setMode('login')}
              className="text-red-400 hover:text-red-300"
            >
              Back to login
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
