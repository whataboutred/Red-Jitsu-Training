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
 * Uses a query starting from workouts table to ensure proper ordering
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
    console.log('[workoutSuggestions] Querying for exercises:', exerciseIds, 'userId:', userId, 'location:', location)

    // Query from workouts table to ensure proper date ordering
    // The key fix: ordering by performed_at works correctly when querying from workouts table
    let data: any[] = []

    try {
      // Query workouts with nested workout_exercises and sets
      let query = supabase
        .from('workouts')
        .select(`
          id,
          performed_at,
          location,
          workout_exercises!inner(
            exercise_id,
            sets(weight, reps, set_type, set_index)
          )
        `)
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(50)

      data = await querySupabase<any>(query, { timeout: 8000, maxRetries: 2 })
      console.log('[workoutSuggestions] Query returned:', data.length, 'workouts')
    } catch (queryError: any) {
      console.error('[workoutSuggestions] Query error:', queryError?.message || queryError)
      // Try simpler fallback query without location
      try {
        let fallbackQuery = supabase
          .from('workouts')
          .select(`
            id,
            performed_at,
            workout_exercises!inner(
              exercise_id,
              sets(weight, reps, set_type, set_index)
            )
          `)
          .eq('user_id', userId)
          .order('performed_at', { ascending: false })
          .limit(50)

        data = await querySupabase<any>(fallbackQuery, { timeout: 8000, maxRetries: 2 })
        console.log('[workoutSuggestions] Fallback query returned:', data.length, 'workouts')
      } catch (fallbackError) {
        console.error('[workoutSuggestions] Fallback query also failed:', fallbackError)
        throw fallbackError
      }
    }

    // Group by exercise and find the most recent workout for each
    // Two-pass approach: first try to match location, then fall back to any location
    const exerciseMap = new Map<string, { date: string; sets: WorkoutSet[] }>()
    const exerciseMapAnyLocation = new Map<string, { date: string; sets: WorkoutSet[] }>()

    for (const workout of data) {
      const workoutDate = workout.performed_at
      const workoutLocation = workout.location // May be null
      const workoutExercises = workout.workout_exercises || []

      const locationMatches = !location || !workoutLocation || workoutLocation === location

      for (const wex of workoutExercises) {
        const exerciseId = wex.exercise_id
        const sets = wex.sets || []

        // Only process exercises we're interested in
        if (!exerciseIds.includes(exerciseId)) {
          continue
        }

        // Store this workout's sets if we have any
        if (sets.length > 0) {
          const formattedSets = sets
            .sort((a: any, b: any) => (a.set_index || 0) - (b.set_index || 0))
            .map((s: any) => ({
              weight: Number(s.weight),
              reps: Number(s.reps),
              set_type: s.set_type as 'warmup' | 'working',
              set_index: s.set_index,
            }))

          // Track most recent for matching location (or when no location filter)
          if (locationMatches && !exerciseMap.has(exerciseId)) {
            exerciseMap.set(exerciseId, {
              date: workoutDate,
              sets: formattedSets,
            })
            console.log('[workoutSuggestions] Found previous data for exercise:', exerciseId, '- sets:', formattedSets.length, '(location match)')
          }

          // Also track most recent regardless of location for fallback
          if (!exerciseMapAnyLocation.has(exerciseId)) {
            exerciseMapAnyLocation.set(exerciseId, {
              date: workoutDate,
              sets: formattedSets,
            })
          }
        }
      }
    }

    // Merge: use location-matched data when available, otherwise fall back to any location
    for (const exerciseId of exerciseIds) {
      if (!exerciseMap.has(exerciseId) && exerciseMapAnyLocation.has(exerciseId)) {
        const fallbackData = exerciseMapAnyLocation.get(exerciseId)!
        exerciseMap.set(exerciseId, fallbackData)
        console.log('[workoutSuggestions] Using fallback data from different location for exercise:', exerciseId)
      }
    }

    // Convert to Map<exerciseId, sets[]>
    const result = new Map<string, WorkoutSet[]>()
    exerciseMap.forEach((value, key) => {
      result.set(key, value.sets)
    })

    console.log('[workoutSuggestions] Returning data for', result.size, 'exercises out of', exerciseIds.length, 'requested')
    return result
  } catch (error) {
    console.error('[workoutSuggestions] Error fetching workout suggestions:', error)
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
    // Query from workouts table to ensure proper ordering
    let data: any[] = []

    try {
      // First get workout_exercises for this exercise
      const { data: wexData } = await supabase
        .from('workout_exercises')
        .select('id, workout_id')
        .eq('exercise_id', exerciseId)

      if (!wexData || wexData.length === 0) {
        return []
      }

      const workoutIds = [...new Set(wexData.map(we => we.workout_id))]

      // Then get the workouts with all their data
      let query = supabase
        .from('workouts')
        .select(`
          id,
          performed_at,
          location,
          workout_exercises(
            exercise_id,
            sets(weight, reps, set_type, set_index)
          )
        `)
        .eq('user_id', userId)
        .in('id', workoutIds)
        .order('performed_at', { ascending: false })
        .limit(10)

      data = await querySupabase<any>(query, { timeout: 8000, maxRetries: 2 })
    } catch (queryError) {
      // Fallback: try simpler query
      try {
        const { data: wexData } = await supabase
          .from('workout_exercises')
          .select('id, workout_id')
          .eq('exercise_id', exerciseId)

        if (!wexData || wexData.length === 0) {
          return []
        }

        const workoutIds = [...new Set(wexData.map(we => we.workout_id))]

        let fallbackQuery = supabase
          .from('workouts')
          .select(`
            id,
            performed_at,
            workout_exercises(
              exercise_id,
              sets(weight, reps, set_type, set_index)
            )
          `)
          .eq('user_id', userId)
          .in('id', workoutIds)
          .order('performed_at', { ascending: false })
          .limit(10)

        data = await querySupabase<any>(fallbackQuery, { timeout: 8000, maxRetries: 2 })
      } catch (fallbackError) {
        console.error('[getLastThreeWorkouts] Fallback query also failed:', fallbackError)
        return []
      }
    }

    // Two-pass approach: prefer matching location, fall back to any location
    const locationMatchedResults: ExerciseSuggestion[] = []
    const anyLocationResults: ExerciseSuggestion[] = []

    for (const workout of data) {
      const workoutDate = workout.performed_at
      const workoutLocation = workout.location
      const workoutExercises = workout.workout_exercises || []

      const locationMatches = !location || !workoutLocation || workoutLocation === location

      // Find the exercise in this workout
      const wex = workoutExercises.find((w: any) => w.exercise_id === exerciseId)
      if (!wex) continue

      const sets = wex.sets || []

      if (sets.length > 0) {
        const formattedSets = sets
          .sort((a: any, b: any) => (a.set_index || 0) - (b.set_index || 0))
          .map((s: any) => ({
            weight: Number(s.weight),
            reps: Number(s.reps),
            set_type: s.set_type as 'warmup' | 'working',
            set_index: s.set_index,
          }))

        const suggestion = {
          exerciseId: exerciseId,
          sets: formattedSets,
          workoutDate,
        }

        // Track location-matched results
        if (locationMatches && locationMatchedResults.length < 3) {
          locationMatchedResults.push(suggestion)
        }

        // Also track all results for fallback
        if (anyLocationResults.length < 3) {
          anyLocationResults.push(suggestion)
        }
      }
    }

    // Return location-matched if we have any, otherwise fall back to any location
    return locationMatchedResults.length > 0 ? locationMatchedResults : anyLocationResults
  } catch (error) {
    console.error('Error fetching last three workouts:', error)
    return []
  }
}
