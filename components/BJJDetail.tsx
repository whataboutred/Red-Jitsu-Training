'use client'

import { useState, useEffect, useCallback } from 'react'
import { getBjjSession, deleteBjjSession } from '@/lib/api'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'
import { Edit3, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { BottomSheet, ConfirmDialog } from '@/components/ui/BottomSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { beltVars } from '@/lib/belt'

type BJJSession = {
  id: string
  performed_at: string
  kind: string
  duration_min: number
  intensity: string | null
  notes: string | null
  rounds: number | null
  subs_for: number | null
  subs_against: number | null
  techniques: string[] | null
  partners: string[] | null
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

export default function BJJDetail({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<BJJSession | null>(null)
  const [belt, setBelt] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [open, setOpen] = useState(true)
  const router = useRouter()
  const toast = useToast()

  // Play the sheet's slide-down exit before unmounting.
  const close = useCallback(() => {
    setOpen(false)
    setTimeout(onClose, 250)
  }, [onClose])

  useEffect(() => {
    (async () => {
      const userId = await getActiveUserId()
      if (!userId) return

      try {
        const [sessionData, profileRes] = await Promise.all([
          getBjjSession(sessionId, userId),
          supabase.from('profiles').select('bjj_belt').eq('id', userId).maybeSingle(),
        ])
        setSession(sessionData)
        setBelt(profileRes.data?.bjj_belt ?? null)
      } catch (error) {
        console.error('Error loading BJJ session:', error)
      } finally {
        setLoading(false)
      }
    })()
  }, [sessionId])

  async function handleDelete() {
    setDeleting(true)
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      await deleteBjjSession(sessionId, userId)

      // lib/api notifies the open pages, which refetch — no reload needed
      close()
    } catch (error) {
      toast.error('Failed to delete session')
      console.error('Delete error:', error)
    } finally {
      setDeleting(false)
    }
  }

  function handleEdit() {
    router.push(`/jiu-jitsu/edit/${sessionId}`)
  }

  function formatKind(kind: string) {
    return kind.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const vars = beltVars(belt) as React.CSSProperties

  const header = session ? (
    <div style={vars}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-[var(--belt)]">Jiu-Jitsu</p>
          <h2 className="text-2xl font-display uppercase text-white leading-none truncate">{formatKind(session.kind)}</h2>
          <p className="text-sm text-zinc-500 mt-1.5">{formatWhen(session.performed_at)}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 -mr-1">
          <button
            onClick={handleEdit}
            className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Edit session"
          >
            <Edit3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="p-2.5 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-50"
            aria-label="Delete session"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  ) : undefined

  return (
    <>
      <BottomSheet isOpen={open} onClose={close} snapPoints={[0.72]} header={header}>
        {loading ? (
          <div className="space-y-3 pt-2">
            <Skeleton variant="text" className="w-1/2" />
            <Skeleton variant="rounded" className="h-20 w-full" />
            <Skeleton variant="rounded" className="h-20 w-full" />
          </div>
        ) : !session ? (
          <p className="text-zinc-400 pt-2">Session not found or access denied.</p>
        ) : (
          <div className="space-y-3" style={vars}>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-elevated rounded-xl p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Duration</div>
                <div className="font-display text-3xl leading-none text-[var(--belt)]">
                  {session.duration_min}
                  <span className="text-sm text-zinc-500 ml-1.5 font-sans font-normal">min</span>
                </div>
              </div>

              {session.intensity && (
                <div className="bg-surface-elevated rounded-xl p-3.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Intensity</div>
                  <div className="font-display text-3xl text-white leading-none capitalize">{session.intensity}</div>
                </div>
              )}

              {typeof session.rounds === 'number' && session.rounds > 0 && (
                <div className="bg-surface-elevated rounded-xl p-3.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Rounds</div>
                  <div className="font-display text-3xl text-white leading-none">{session.rounds}</div>
                </div>
              )}

              {((session.subs_for ?? 0) > 0 || (session.subs_against ?? 0) > 0) && (
                <div className="bg-surface-elevated rounded-xl p-3.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Subs for / against</div>
                  <div className="font-display text-3xl leading-none">
                    <span className="text-emerald-400">{session.subs_for ?? 0}</span>
                    <span className="text-zinc-600 mx-1.5">/</span>
                    <span className="text-red-400">{session.subs_against ?? 0}</span>
                  </div>
                </div>
              )}
            </div>

            {session.techniques && session.techniques.length > 0 && (
              <div className="bg-surface-elevated rounded-xl p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Techniques</div>
                <div className="flex flex-wrap gap-2">
                  {session.techniques.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-lg text-xs bg-[var(--belt-15)] border border-[var(--belt-30)] text-[var(--belt)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {session.partners && session.partners.length > 0 && (
              <div className="bg-surface-elevated rounded-xl p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Partners</div>
                <div className="flex flex-wrap gap-2">
                  {session.partners.map((p) => (
                    <span
                      key={p}
                      className="px-2.5 py-1 rounded-lg text-xs bg-white/[0.05] border border-white/[0.08] text-zinc-300"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {session.notes && (
              <div className="bg-surface-elevated rounded-xl p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Notes</div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{session.notes}</p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Jiu Jitsu session?"
        message="This session will be permanently deleted. This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </>
  )
}
