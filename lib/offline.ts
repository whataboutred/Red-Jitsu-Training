'use client'

import localforage from 'localforage'
import { supabase } from './supabaseClient'

localforage.config({ name: 'ironlog' })

export type PendingWorkout = {
  tempId: string
  performed_at: string
  title?: string | null
  note?: string | null
  exercises: Array<{
    exercise_id: string
    name: string
    sets: Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }>
  }>
}

export const pendingKey = 'pending_workouts'

export async function savePendingWorkout(w: PendingWorkout) {
  const items = (await localforage.getItem<PendingWorkout[]>(pendingKey)) || []
  items.push(w)
  await localforage.setItem(pendingKey, items)
}

export async function getPendingWorkouts() {
  return (await localforage.getItem<PendingWorkout[]>(pendingKey)) || []
}

export async function clearPendingWorkouts() {
  await localforage.setItem(pendingKey, [])
}

export async function trySyncPending(userId: string) {
  const items = await getPendingWorkouts()
  if (!items.length) return

  for (const w of items) {
    const { data: workout, error } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        performed_at: w.performed_at,
        title: w.title ?? null,
        note: w.note ?? null,
      })
      .select('id')
      .single()

    if (error || !workout) continue

    for (const ex of w.exercises) {
      const { data: wex, error: wexErr } = await supabase
        .from('workout_exercises')
        .insert({ workout_id: workout.id, exercise_id: ex.exercise_id, display_name: ex.name })
        .select('id')
        .single()
      if (wexErr || !wex) continue

      const rows = ex.sets.map((s, idx) => ({
        workout_exercise_id: wex.id,
        set_index: idx + 1,
        weight: s.weight,
        reps: s.reps,
        set_type: s.set_type,
      }))
      await supabase.from('sets').insert(rows)
    }
  }
  await clearPendingWorkouts()
}
