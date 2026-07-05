'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCardioSession, deleteCardioSession } from '@/lib/api'
import { getActiveUserId } from '@/lib/activeUser'
import { Edit3, Trash2, Watch } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { BottomSheet, ConfirmDialog } from '@/components/ui/BottomSheet'
import { Skeleton } from '@/components/ui/Skeleton'

type CardioSession = {
  id: string
  activity: string
  duration_minutes: number | null
  distance: number | null
  distance_unit: string | null
  intensity: string | null
  calories: number | null
  notes: string | null
  performed_at: string
  source: string
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

// Fitbit imports stamp their notes with a source prefix; the header pill
// already says Fitbit, so only the useful remainder (HR / zone data) shows.
function cleanNotes(session: CardioSession): string | null {
  const notes = session.notes?.trim()
  if (!notes) return null
  if (session.source === 'fitbit') {
    const stripped = notes.replace(/^Imported from Fitbit(\s*·\s*)?/i, '').trim()
    return stripped || null
  }
  return notes
}

export default function CardioDetail({
  sessionId,
  onClose,
  onUpdate
}: {
  sessionId: string
  onClose: () => void
  onUpdate?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<CardioSession | null>(null)
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
    loadSessionData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function loadSessionData() {
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      setSession(await getCardioSession(sessionId, userId))
    } catch (error) {
      console.error('Error loading cardio session:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      await deleteCardioSession(sessionId, userId)
      toast.success('Cardio session deleted')
      if (onUpdate) {
        onUpdate()
      }
      close()
    } catch (error) {
      toast.error('Failed to delete cardio session')
      console.error('Delete error:', error)
    } finally {
      setDeleting(false)
    }
  }

  function handleEdit() {
    router.push(`/cardio/edit/${sessionId}`)
  }

  const notes = session ? cleanNotes(session) : null

  const header = session ? (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-1">Cardio</p>
          <h2 className="text-2xl font-display uppercase text-white leading-none truncate">{session.activity}</h2>
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
      {session.source === 'fitbit' && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white/[0.06] border border-white/[0.12] px-2 py-0.5 text-[11px] font-medium text-zinc-300">
          <Watch className="w-3 h-3" />
          Imported from Fitbit
        </div>
      )}
    </div>
  ) : undefined

  return (
    <>
      <BottomSheet isOpen={open} onClose={close} snapPoints={[0.62]} header={header}>
        {loading ? (
          <div className="space-y-3 pt-2">
            <Skeleton variant="text" className="w-1/2" />
            <Skeleton variant="rounded" className="h-20 w-full" />
            <Skeleton variant="rounded" className="h-20 w-full" />
          </div>
        ) : !session ? (
          <p className="text-zinc-400 pt-2">Session not found or access denied.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {session.duration_minutes != null && (
                <div className="bg-surface-elevated rounded-xl p-3.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Duration</div>
                  <div className="font-display text-3xl text-emerald-400 leading-none">
                    {session.duration_minutes}
                    <span className="text-sm text-zinc-500 ml-1.5 font-sans font-normal">min</span>
                  </div>
                </div>
              )}

              {session.distance != null && session.distance > 0 && session.distance_unit && (
                <div className="bg-surface-elevated rounded-xl p-3.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Distance</div>
                  <div className="font-display text-3xl text-white leading-none">
                    {session.distance}
                    <span className="text-sm text-zinc-500 ml-1.5 font-sans font-normal">{session.distance_unit}</span>
                  </div>
                </div>
              )}

              {session.calories != null && (
                <div className="bg-surface-elevated rounded-xl p-3.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Calories</div>
                  <div className="font-display text-3xl text-white leading-none">
                    {session.calories}
                    <span className="text-sm text-zinc-500 ml-1.5 font-sans font-normal">cal</span>
                  </div>
                </div>
              )}

              {session.intensity && (
                <div className="bg-surface-elevated rounded-xl p-3.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Intensity</div>
                  <div className="font-display text-3xl text-white leading-none capitalize">{session.intensity}</div>
                </div>
              )}
            </div>

            {notes && (
              <div className="bg-surface-elevated rounded-xl p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Notes</div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{notes}</p>
              </div>
            )}

            {!session.duration_minutes && !session.distance && !session.calories && !notes && (
              <p className="text-center text-zinc-500 py-6">No additional details recorded for this session.</p>
            )}
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete cardio session?"
        message="This session will be permanently deleted. This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </>
  )
}
