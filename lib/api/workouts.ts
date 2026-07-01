import { supabase } from '@/lib/supabaseClient'
import { withRetry } from '@/lib/queryUtils'
import { notifyDataChanged } from '@/lib/dataSync'
import type { Workout } from '@/types/domain'

export type WorkoutSetInput = {
  weight: number
  reps: number
  set_type: 'warmup' | 'working'
  completed: boolean
}

export type WorkoutExerciseInput = {
  exercise_id: string
  display_name: string
  sets: WorkoutSetInput[]
}

export type WorkoutSavePayload = {
  /** Present = replace this workout in place; absent = create. */
  workout_id?: string
  /** Idempotency key for create: replaying the same payload returns the same workout. */
  client_id?: string
  performed_at: string
  title?: string | null
  note?: string | null
  location?: string | null
  exercises: WorkoutExerciseInput[]
}

/**
 * Creates or fully replaces a workout (header + exercises + sets) in a single
 * transaction via the save_workout RPC. Safe to retry: creates carry a
 * client_id and edits are a full replace.
 */
export async function saveWorkout(payload: WorkoutSavePayload): Promise<string> {
  const workoutId = await withRetry(async () => {
    const { data, error } = await supabase.rpc('save_workout', { p_payload: payload })
    if (error) throw error
    if (!data) throw new Error('save_workout returned no id')
    return data as string
  })
  notifyDataChanged()
  return workoutId
}

/** Workouts for a user, newest first, optionally bounded by ISO timestamps. */
export async function getWorkouts(
  userId: string,
  options: { fromISO?: string; toISO?: string; limit?: number } = {}
): Promise<Workout[]> {
  return withRetry(async () => {
    let query = supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('performed_at', { ascending: false })
    if (options.fromISO) query = query.gte('performed_at', options.fromISO)
    if (options.toISO) query = query.lte('performed_at', options.toISO)
    if (options.limit) query = query.limit(options.limit)
    const { data, error } = await query
    if (error) throw error
    return data ?? []
  })
}

/** Deletes a workout; exercises and sets cascade in the database. */
export async function deleteWorkout(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
  notifyDataChanged()
}
