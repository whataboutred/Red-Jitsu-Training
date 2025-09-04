'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'

type RecentExercise = {
  id: string
  name: string
  category: string
  lastUsed: string
  avgWeight: number
  avgReps: number
  useCount: number
}

type QuickStartSectionProps = {
  onAddExercise: (exercise: { id: string; name: string; avgWeight?: number; avgReps?: number }) => void
  unit: 'lb' | 'kg'
}

export default function QuickStartSection({ onAddExercise, unit }: QuickStartSectionProps) {
  const [recentExercises, setRecentExercises] = useState<RecentExercise[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecentExercises()
  }, [])

  async function loadRecentExercises() {
    const userId = await getActiveUserId()
    if (!userId) return

    try {
      // Get recent exercises with their most recent working set from last 30 days
      const { data: recentData } = await supabase
        .from('workout_exercises')
        .select(`
          exercise_id,
          display_name,
          workouts!inner(performed_at, user_id),
          sets(weight, reps, set_type, set_index)
        `)
        .eq('workouts.user_id', userId)
        .gte('workouts.performed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('workouts.performed_at', { ascending: false })

      if (recentData) {
        // Group by exercise and track most recent workout for each
        const exerciseMap = new Map<string, {
          id: string
          name: string
          lastUsed: string
          lastWorkingWeight: number
          lastWorkingReps: number
          useCount: number
        }>()

        recentData.forEach((item: any) => {
          const exerciseId = item.exercise_id
          const workoutDate = item.workouts.performed_at
          
          const existing = exerciseMap.get(exerciseId)
          
          // Only process if this is the most recent workout for this exercise or first time seeing it
          if (!existing || new Date(workoutDate) > new Date(existing.lastUsed)) {
            // Find the last working set from this workout
            const workingSets = item.sets
              ?.filter((set: any) => set.set_type === 'working' && set.weight > 0)
              ?.sort((a: any, b: any) => b.set_index - a.set_index) // Most recent set first

            const lastWorkingSet = workingSets?.[0]

            exerciseMap.set(exerciseId, {
              id: exerciseId,
              name: item.display_name,
              lastUsed: workoutDate,
              lastWorkingWeight: lastWorkingSet ? Number(lastWorkingSet.weight) : 0,
              lastWorkingReps: lastWorkingSet ? Number(lastWorkingSet.reps) : 0,
              useCount: (existing?.useCount || 0) + 1
            })
          } else if (existing) {
            // Just increment count for older workouts
            existing.useCount++
          }
        })

        // Convert to RecentExercise format
        const exercises: RecentExercise[] = Array.from(exerciseMap.values())
          .map(ex => ({
            id: ex.id,
            name: ex.name,
            category: 'recent',
            lastUsed: ex.lastUsed,
            avgWeight: ex.lastWorkingWeight, // Now shows last working weight instead of average
            avgReps: ex.lastWorkingReps, // Now shows last working reps instead of average
            useCount: ex.useCount
          }))
          .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
          .slice(0, 6) // Top 6 recent exercises

        setRecentExercises(exercises)
      }
    } catch (error) {
      console.error('Error loading recent exercises:', error)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="card">
        <div className="font-medium mb-3">🚀 Quick Start</div>
        <div className="text-white/60 text-sm">Loading recent exercises...</div>
      </div>
    )
  }

  if (recentExercises.length === 0) {
    return (
      <div className="card">
        <div className="font-medium mb-3">🚀 Quick Start</div>
        <div className="text-white/60 text-sm">Start your first workout to see recent exercises here!</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="font-medium mb-3">🚀 Quick Start - Recent Exercises</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {recentExercises.map((ex) => (
          <button
            key={ex.id}
            className="text-left bg-black/30 hover:bg-black/50 rounded-xl p-3 transition-all duration-200 border border-transparent hover:border-brand-red/30"
            onClick={() => onAddExercise({ 
              id: ex.id, 
              name: ex.name, 
              avgWeight: ex.avgWeight, 
              avgReps: ex.avgReps 
            })}
          >
            <div className="font-medium text-white/90">{ex.name}</div>
            <div className="text-sm text-white/60 mt-1 flex items-center gap-2">
              {ex.avgWeight > 0 && (
                <span className="bg-brand-red/20 text-brand-red px-2 py-1 rounded text-xs">
                  Last: {ex.avgWeight} {unit}
                </span>
              )}
              {ex.avgReps > 0 && (
                <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">
                  {ex.avgReps} reps
                </span>
              )}
              <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">
                {ex.useCount}x used
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}