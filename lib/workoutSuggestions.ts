import { supabase } from './supabaseClient'
import { querySupabase, QueryRateLimiter } from './queryUtils'

export interface WorkoutSet {
  weight: number
  reps: number
  set_type: 'warmup' | 'working'
  set_index?: number
}

export interface ExerciseSuggestion {
  exerciseId: string
  sets: WorkoutSet[]
  workoutDate: string
}

const rateLimiter = new QueryRateLimiter(3) // Max 3 concurrent queries

/**
 * Optimized function to get last workout sets for multiple exercises
 * Uses a single query with joins instead of N+1 queries
 */
export async function getLastWorkoutSetsForExercises(
  userId: string,
  exerciseIds: string[],
  location?: string
): Promise<Map<string, WorkoutSet[]>> {
  if (exerciseIds.length === 0) {
    return new Map()
  }

  try {
    // Single optimized query with joins
    let query = supabase
      .from('workout_exercises')
      .select(`
        exercise_id,
        workouts!inner(performed_at, user_id, location),
        sets(weight, reps, set_type, set_index)
      `)
      .eq('workouts.user_id', userId)
      .in('exercise_id', exerciseIds)
      .order('workouts.performed_at', { ascending: false })
      .limit(100) // Get recent workout exercises

    // Execute with timeout and retry
    const data = await querySupabase<any>(query, { timeout: 5000, maxRetries: 2 })

    // Group by exercise and find the most recent workout for each
    const exerciseMap = new Map<string, { date: string; sets: WorkoutSet[] }>()

    for (const item of data) {
      const exerciseId = item.exercise_id
      const workoutDate = item.workouts.performed_at
      const workoutLocation = item.workouts.location
      const sets = item.sets || []

      // Skip if location filter is active and doesn't match
      if (location && workoutLocation !== location) {
        continue
      }

      // Check if we already have a more recent workout for this exercise
      const existing = exerciseMap.get(exerciseId)
      if (existing && existing.date > workoutDate) {
        continue
      }

      // Store this workout's sets
      if (sets.length > 0) {
        const formattedSets = sets
          .sort((a: any, b: any) => (a.set_index || 0) - (b.set_index || 0))
          .map((s: any) => ({
            weight: Number(s.weight),
            reps: Number(s.reps),
            set_type: s.set_type as 'warmup' | 'working',
            set_index: s.set_index,
          }))

        exerciseMap.set(exerciseId, {
          date: workoutDate,
          sets: formattedSets,
        })
      }
    }

    // Convert to Map<exerciseId, sets[]>
    const result = new Map<string, WorkoutSet[]>()
    exerciseMap.forEach((value, key) => {
      result.set(key, value.sets)
    })

    return result
  } catch (error) {
    console.error('Error fetching workout suggestions:', error)
    // Return empty map on error instead of throwing
    return new Map()
  }
}

/**
 * Get last workout sets for a single exercise
 * Optimized with rate limiting and caching
 */
export async function getLastWorkoutSets(
  userId: string,
  exerciseId: string,
  location?: string
): Promise<WorkoutSet[] | null> {
  return rateLimiter.execute(async () => {
    const results = await getLastWorkoutSetsForExercises(userId, [exerciseId], location)
    return results.get(exerciseId) || null
  })
}

/**
 * Get last 3 workouts for an exercise to show progression
 */
export async function getLastThreeWorkouts(
  userId: string,
  exerciseId: string,
  location?: string
): Promise<ExerciseSuggestion[]> {
  try {
    let query = supabase
      .from('workout_exercises')
      .select(`
        exercise_id,
        workouts!inner(id, performed_at, user_id, location),
        sets(weight, reps, set_type, set_index)
      `)
      .eq('workouts.user_id', userId)
      .eq('exercise_id', exerciseId)
      .order('workouts.performed_at', { ascending: false })
      .limit(3)

    const data = await querySupabase<any>(query, { timeout: 5000, maxRetries: 2 })

    const results: ExerciseSuggestion[] = []

    for (const item of data) {
      const workoutDate = item.workouts.performed_at
      const workoutLocation = item.workouts.location
      const sets = item.sets || []

      // Skip if location filter is active and doesn't match
      if (location && workoutLocation !== location) {
        continue
      }

      if (sets.length > 0) {
        const formattedSets = sets
          .sort((a: any, b: any) => (a.set_index || 0) - (b.set_index || 0))
          .map((s: any) => ({
            weight: Number(s.weight),
            reps: Number(s.reps),
            set_type: s.set_type as 'warmup' | 'working',
            set_index: s.set_index,
          }))

        results.push({
          exerciseId: item.exercise_id,
          sets: formattedSets,
          workoutDate,
        })
      }
    }

    return results
  } catch (error) {
    console.error('Error fetching last three workouts:', error)
    return []
  }
}
