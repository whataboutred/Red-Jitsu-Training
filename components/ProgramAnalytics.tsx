'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'

type ProgramUsageStats = {
  programId: string
  programName: string
  totalWorkouts: number
  lastUsed: string
  avgWorkoutsPerWeek: number
  topExercises: Array<{
    name: string
    count: number
    avgWeight?: number
    avgReps?: number
  }>
  consistencyScore: number // 0-100
  strengthProgression: Array<{
    exercise: string
    startWeight: number
    currentWeight: number
    improvement: number
  }>
}

type ProgramAnalyticsProps = {
  showDetailed?: boolean
  programId?: string
}

export default function ProgramAnalytics({ showDetailed = false, programId }: ProgramAnalyticsProps) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ProgramUsageStats[]>([])
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30d' | '90d' | '1y'>('90d')

  useEffect(() => {
    loadAnalytics()
  }, [selectedTimeframe, programId])

  async function loadAnalytics() {
    setLoading(true)
    const userId = await getActiveUserId()
    if (!userId) return

    const timeframeDays = selectedTimeframe === '30d' ? 30 : selectedTimeframe === '90d' ? 90 : 365
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - timeframeDays)
    const startDateStr = startDate.toISOString().split('T')[0]

    try {
      // Get workouts with program data
      const { data: workouts } = await supabase
        .from('workouts')
        .select(`
          id,
          created_at,
          program_id,
          programs!inner(name),
          exercises!inner(
            id,
            name,
            category,
            sets!inner(
              weight,
              reps,
              completed
            )
          )
        `)
        .eq('user_id', userId)
        .gte('created_at', startDateStr)
        .not('program_id', 'is', null)
        .eq('exercises.sets.completed', true)

      if (programId) {
        // Filter to specific program if provided
      }

      const programStats: ProgramUsageStats[] = []
      const programGroups = groupWorkoutsByProgram(workouts || [])

      for (const [pId, workoutData] of Object.entries(programGroups)) {
        const totalWorkouts = workoutData.workouts.length
        const programName = workoutData.programName
        const lastUsed = workoutData.workouts[0]?.created_at || ''
        
        // Calculate weekly average
        const weeksInPeriod = timeframeDays / 7
        const avgWorkoutsPerWeek = Math.round((totalWorkouts / weeksInPeriod) * 10) / 10

        // Calculate top exercises
        const exerciseStats = calculateExerciseStats(workoutData.workouts)
        const topExercises = exerciseStats
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        // Calculate consistency score (based on regularity of workouts)
        const consistencyScore = calculateConsistencyScore(workoutData.workouts, timeframeDays)

        // Calculate strength progression for key exercises
        const strengthProgression = calculateStrengthProgression(workoutData.workouts)

        programStats.push({
          programId: pId,
          programName,
          totalWorkouts,
          lastUsed,
          avgWorkoutsPerWeek,
          topExercises,
          consistencyScore,
          strengthProgression
        })
      }

      setStats(programStats.sort((a, b) => b.totalWorkouts - a.totalWorkouts))
    } catch (error) {
      console.error('Error loading program analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  function groupWorkoutsByProgram(workouts: any[]) {
    const groups: Record<string, { programName: string; workouts: any[] }> = {}
    
    for (const workout of workouts) {
      const programId = workout.program_id
      if (!groups[programId]) {
        groups[programId] = {
          programName: workout.programs.name,
          workouts: []
        }
      }
      groups[programId].workouts.push(workout)
    }
    
    return groups
  }

  function calculateExerciseStats(workouts: any[]) {
    const exerciseMap: Record<string, {
      name: string
      count: number
      totalWeight: number
      totalReps: number
      setCount: number
    }> = {}

    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        if (!exerciseMap[exercise.id]) {
          exerciseMap[exercise.id] = {
            name: exercise.name,
            count: 0,
            totalWeight: 0,
            totalReps: 0,
            setCount: 0
          }
        }
        
        exerciseMap[exercise.id].count++
        
        for (const set of exercise.sets) {
          if (set.completed && set.weight && set.reps) {
            exerciseMap[exercise.id].totalWeight += set.weight
            exerciseMap[exercise.id].totalReps += set.reps
            exerciseMap[exercise.id].setCount++
          }
        }
      }
    }

    return Object.values(exerciseMap).map(ex => ({
      name: ex.name,
      count: ex.count,
      avgWeight: ex.setCount > 0 ? Math.round(ex.totalWeight / ex.setCount) : undefined,
      avgReps: ex.setCount > 0 ? Math.round(ex.totalReps / ex.setCount) : undefined
    }))
  }

  function calculateConsistencyScore(workouts: any[], timeframeDays: number): number {
    if (workouts.length === 0) return 0
    
    const workoutDates = workouts.map(w => new Date(w.created_at).getTime())
    workoutDates.sort((a, b) => a - b)
    
    // Calculate ideal frequency (should be evenly spaced)
    const idealGapDays = timeframeDays / workouts.length
    const idealGapMs = idealGapDays * 24 * 60 * 60 * 1000
    
    let totalDeviation = 0
    for (let i = 1; i < workoutDates.length; i++) {
      const actualGap = workoutDates[i] - workoutDates[i - 1]
      const deviation = Math.abs(actualGap - idealGapMs) / idealGapMs
      totalDeviation += deviation
    }
    
    const avgDeviation = workoutDates.length > 1 ? totalDeviation / (workoutDates.length - 1) : 0
    const consistencyScore = Math.max(0, Math.min(100, (1 - avgDeviation) * 100))
    
    return Math.round(consistencyScore)
  }

  function calculateStrengthProgression(workouts: any[]) {
    const exerciseProgression: Record<string, {
      name: string
      weights: Array<{ date: string; weight: number }>
    }> = {}

    // Collect weight data for each exercise
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        if (!exerciseProgression[exercise.name]) {
          exerciseProgression[exercise.name] = {
            name: exercise.name,
            weights: []
          }
        }

        const maxWeight = exercise.sets
          .filter((s: any) => s.completed && s.weight)
          .reduce((max: number, s: any) => Math.max(max, s.weight), 0)

        if (maxWeight > 0) {
          exerciseProgression[exercise.name].weights.push({
            date: workout.created_at,
            weight: maxWeight
          })
        }
      }
    }

    // Calculate progression for exercises with sufficient data
    const progressions = []
    for (const [_, data] of Object.entries(exerciseProgression)) {
      if (data.weights.length >= 3) {
        data.weights.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        
        const startWeight = data.weights[0].weight
        const currentWeight = data.weights[data.weights.length - 1].weight
        const improvement = ((currentWeight - startWeight) / startWeight) * 100

        if (Math.abs(improvement) > 1) { // Only show meaningful changes
          progressions.push({
            exercise: data.name,
            startWeight,
            currentWeight,
            improvement: Math.round(improvement * 10) / 10
          })
        }
      }
    }

    return progressions.sort((a, b) => Math.abs(b.improvement) - Math.abs(a.improvement)).slice(0, 5)
  }

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3"></div>
          <div className="h-4 bg-white/10 rounded w-2/3"></div>
          <div className="h-20 bg-white/10 rounded"></div>
        </div>
      </div>
    )
  }

  if (stats.length === 0) {
    return (
      <div className="card text-center py-8">
        <div className="text-4xl mb-3">📊</div>
        <div className="font-medium mb-2">No Program Data Yet</div>
        <div className="text-white/70 text-sm">
          Complete workouts using programs to see analytics here
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="font-medium">📊 Program Analytics</div>
          <div className="flex gap-2">
            {(['30d', '90d', '1y'] as const).map(timeframe => (
              <button
                key={timeframe}
                className={`px-3 py-1 rounded-lg text-sm transition-all duration-200 ${
                  selectedTimeframe === timeframe 
                    ? 'bg-brand-red/20 border-brand-red text-white border' 
                    : 'bg-black/30 border border-white/10 text-white/70 hover:bg-black/50'
                }`}
                onClick={() => setSelectedTimeframe(timeframe)}
              >
                {timeframe === '30d' ? '30 days' : timeframe === '90d' ? '3 months' : '1 year'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {stats.map(stat => (
            <div key={stat.programId} className="bg-black/30 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg text-white/90">{stat.programName}</div>
                  <div className="text-sm text-white/70">
                    {stat.totalWorkouts} workouts • {stat.avgWorkoutsPerWeek}/week average
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white/70">Consistency</div>
                  <div className={`text-2xl font-bold ${
                    stat.consistencyScore >= 80 ? 'text-green-400' :
                    stat.consistencyScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {stat.consistencyScore}%
                  </div>
                </div>
              </div>

              {showDetailed && (
                <>
                  {/* Top Exercises */}
                  <div>
                    <div className="font-medium mb-3">Most Frequent Exercises</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {stat.topExercises.slice(0, 6).map(exercise => (
                        <div key={exercise.name} className="bg-black/30 rounded-lg p-3">
                          <div className="font-medium text-sm text-white/90">{exercise.name}</div>
                          <div className="text-xs text-white/70 mt-1">
                            {exercise.count} sessions
                            {exercise.avgWeight && exercise.avgReps && (
                              <span> • {exercise.avgWeight}lb × {exercise.avgReps}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strength Progression */}
                  {stat.strengthProgression.length > 0 && (
                    <div>
                      <div className="font-medium mb-3">Strength Progression</div>
                      <div className="space-y-2">
                        {stat.strengthProgression.map(prog => (
                          <div key={prog.exercise} className="flex items-center justify-between bg-black/30 rounded-lg p-3">
                            <div className="font-medium text-sm">{prog.exercise}</div>
                            <div className="text-right">
                              <div className="text-sm">
                                {prog.startWeight}lb → {prog.currentWeight}lb
                              </div>
                              <div className={`text-xs font-medium ${
                                prog.improvement > 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {prog.improvement > 0 ? '+' : ''}{prog.improvement}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {!showDetailed && stat.strengthProgression.length > 0 && (
                <div className="text-sm text-white/70">
                  💪 {stat.strengthProgression.filter(p => p.improvement > 0).length} exercises showing improvement
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-xs text-white/60 text-center mt-6 bg-black/20 rounded-lg p-3">
          💡 Analytics help you understand program effectiveness and track long-term progress
        </div>
      </div>
    </div>
  )
}