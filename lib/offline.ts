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

export async function trySyncPending(): Promise<{ synced: number; failed: number }> {
  const items = await getPendingWorkouts()
  if (!items.length) return { synced: 0, failed: 0 }

  const remaining: PendingWorkout[] = []
  let synced = 0

  for (const item of items) {
    try {
      await saveWorkout(item)
      synced++
    } catch {
      // Keep the whole item for the next attempt — the transactional RPC
      // guarantees nothing partial was written, and client_id makes the
      // retry duplicate-safe.
      remaining.push(item)
    }
  }

  await localforage.setItem(pendingKey, remaining)
  return { synced, failed: remaining.length }
}
