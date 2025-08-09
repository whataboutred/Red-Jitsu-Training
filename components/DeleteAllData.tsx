'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DeleteAllData() {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string>('')

  const onDelete = async () => {
    if (!confirm('This will permanently delete ALL your data. Continue?')) return
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('delete_my_data')
    if (error) {
      setError(error.message)
    } else {
      setDone(true)
    }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="rounded-xl border border-white/10 p-4 bg-black/40">
        <div className="font-semibold mb-1">All data deleted</div>
        <div className="text-white/70 text-sm">
          Your logs and programs have been removed from our database.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 p-4 bg-black/40">
      <div className="font-semibold mb-2 text-red-400">Danger zone</div>
      <p className="text-white/70 text-sm mb-3">
        Permanently delete all your workouts, sets, programs, and Jiu Jitsu sessions.
        This cannot be undone.
      </p>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      <button
        onClick={onDelete}
        disabled={busy}
        className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5 disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Delete all my data'}
      </button>
    </div>
  )
}
