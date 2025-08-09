'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Step = 'checking' | 'ready' | 'saving' | 'done' | 'error'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('checking')
  const [error, setError] = useState<string>('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    (async () => {
      try {
        // 1) New flow (PKCE): ?code=...
        const code = searchParams.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else {
          // 2) Legacy/hash flow: #access_token=...&refresh_token=...
          const hash = typeof window !== 'undefined' ? window.location.hash : ''
          if (hash?.includes('access_token')) {
            const params = new URLSearchParams(hash.replace(/^#/, ''))
            const access_token = params.get('access_token') || ''
            const refresh_token = params.get('refresh_token') || ''
            if (access_token && refresh_token) {
              const { error } = await supabase.auth.setSession({ access_token, refresh_token })
              if (error) throw error
            }
          }
        }

        // If either path succeeded (or user was already signed in), show the form
        setStep('ready')
      } catch (e: any) {
        setError(e?.message || 'The reset link is invalid or has expired.')
        setStep('error')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setStep('saving')
    const { error: updErr } = await supabase.auth.updateUser({ password })
    if (updErr) {
      setError(updErr.message)
      setStep('ready')
      return
    }
    setStep('done')
  }

  if (step === 'checking') {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-lg font-semibold mb-2">Resetting password…</h1>
        <p className="text-white/70 text-sm">Please wait.</p>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-lg font-semibold mb-2">Password updated</h1>
        <p className="text-white/70 text-sm mb-4">You can now sign in with your new password.</p>
        <Link href="/login" className="btn">Go to login</Link>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-lg font-semibold mb-2">Reset link error</h1>
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <Link href="/login" className="btn">Back to login</Link>
      </div>
    )
  }

  // step === 'ready'
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Set a new password</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-white/70 mb-1">New password</label>
          <input
            type="password"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-red-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-white/70 mb-1">Confirm password</label>
          <input
            type="password"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-red-600"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          className="btn w-full disabled:opacity-50"
          disabled={step === 'saving'}
        >
          {step === 'saving' ? 'Saving…' : 'Update password'}
        </button>

        <div className="text-sm text-white/60 mt-2">
          <Link href="/login" className="underline">Back to login</Link>
        </div>
      </form>
    </div>
  )
}
