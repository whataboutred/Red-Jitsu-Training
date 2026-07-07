'use client'

import localforage from 'localforage'
import { saveWorkout, type WorkoutSavePayload } from '@/lib/api/workouts'

localforage.config({ name: 'redjitsu' })

/**
 * Offline workout queue. Items are full save_workout payloads whose client_id
 * makes replays idempotent: if a save reached the server but the response was
 * lost, retrying returns the existing workout instead of duplicating it. An
 * item either syncs completely (the RPC is transactional) or stays queued.
 */
export type PendingWorkout = WorkoutSavePayload & {
  client_id: string
  queued_at: string
  // Who queued it. The RPC writes to auth.uid(), so items queued by a
  // different account on this device must not drain into the current one.
  user_id?: string
}

export const pendingKey = 'pending_workouts_v2'

export async function enqueueWorkout(payload: PendingWorkout): Promise<void> {
  const items = (await localforage.getItem<PendingWorkout[]>(pendingKey)) || []
  // Re-queuing the same save (same client_id) replaces the older copy
  const rest = items.filter((i) => i.client_id !== payload.client_id)
  rest.push(payload)
  await localforage.setItem(pendingKey, rest)
}

export async function getPendingWorkouts(): Promise<PendingWorkout[]> {
  return (await localforage.getItem<PendingWorkout[]>(pendingKey)) || []
}

// Serialize drains: mount + 'online' can fire together, and two concurrent
// drains would race the final queue write.
let syncInFlight: Promise<{ synced: number; failed: number }> | null = null

export async function trySyncPending(): Promise<{ synced: number; failed: number }> {
  if (syncInFlight) return syncInFlight
  syncInFlight = (async () => {
    try {
      const items = await getPendingWorkouts()
      if (!items.length) return { synced: 0, failed: 0 }

      const { getActiveUserId } = await import('@/lib/activeUser')
      const currentUser = await getActiveUserId()

      const syncedIds = new Set<string>()
      for (const item of items) {
        // Never drain another account's queued workout into this session.
        if (item.user_id && currentUser && item.user_id !== currentUser) continue
        try {
          await saveWorkout(item)
          syncedIds.add(item.client_id)
        } catch {
          // Keep the whole item for the next attempt — the transactional RPC
          // guarantees nothing partial was written, and client_id makes the
          // retry duplicate-safe.
        }
      }

      // Re-read before writing: anything enqueued while the network calls were
      // in flight must survive. Only remove what actually synced.
      const current = await getPendingWorkouts()
      const remaining = current.filter((i) => !syncedIds.has(i.client_id))
      await localforage.setItem(pendingKey, remaining)
      return { synced: syncedIds.size, failed: remaining.length }
    } finally {
      syncInFlight = null
    }
  })()
  return syncInFlight
}
