'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import Link from 'next/link'
import { Suspense, useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId } from '@/lib/activeUser'
import { useSearchParams, useRouter } from 'next/navigation'
import WorkoutDetail from '@/components/WorkoutDetail'
import BJJDetail from '@/components/BJJDetail'
import CardioDetail from '@/components/CardioDetail'

type Workout = { id:string; performed_at:string; title:string|null }
type BJJ = { id:string; performed_at:string; duration_min:number; kind:'class'|'drilling'|'open_mat'; intensity:string|null; notes:string|null }
type Cardio = { id:string; performed_at:string; activity:string; duration_minutes:number|null; distance:number|null; distance_unit:string|null; intensity:string|null; notes:string|null }

type ProgressionData = {
  exerciseId: string
  exerciseName: string
  data: Array<{
    date: string
    maxWeight: number
    totalVolume: number
    oneRepMax: number
  }>
}

type VolumeData = {
  date: string
  upperVolume: number
  lowerVolume: number
  totalSets: number
}

export const dynamic = 'force-dynamic' // don’t prerender this page

export default function HistoryPage() {
  return (
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <Nav />
      <Suspense fallback={<main className="relative z-10 max-w-4xl mx-auto p-4">Loading…</main>}>
        <HistoryClient />
      </Suspense>
    </div>
  )
}

function HistoryClient(){
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [bjj, setBjj] = useState<BJJ[]>([])
  const [cardio, setCardio] = useState<Cardio[]>([])
  const [progressionData, setProgressionData] = useState<ProgressionData[]>([])
  const [volumeData, setVolumeData] = useState<VolumeData[]>([])
  const [selectedView, setSelectedView] = useState<'analytics' | 'workouts'>('analytics')
  const [workoutFilter, setWorkoutFilter] = useState<'all' | 'week' | 'month'>('month')
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  
  const params = useSearchParams()
  const router = useRouter()
  const highlightId = params.get('highlight')
  const highlightType = params.get('type') || 'workout'

  const closeModal = () => {
    router.push('/history')
  }

  // Filter workouts based on selected time period
  const filteredWorkouts = useMemo(() => {
    const now = new Date()
    const cutoff = new Date()
    
    switch (workoutFilter) {
      case 'week':
        cutoff.setDate(now.getDate() - 7)
        break
      case 'month':
        cutoff.setMonth(now.getMonth() - 1)
        break
      default:
        cutoff.setFullYear(now.getFullYear() - 1) // Show last year for 'all'
    }
    
    return workouts.filter(w => new Date(w.performed_at) >= cutoff)
  }, [workouts, workoutFilter])

  // Calculate workout frequency stats
  const workoutStats = useMemo(() => {
    const now = new Date()
    const thisWeek = workouts.filter(w => {
      const date = new Date(w.performed_at)
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      return date >= weekStart
    }).length

    const thisMonth = workouts.filter(w => {
      const date = new Date(w.performed_at)
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length

    const avgPerWeek = workouts.length > 0 ? 
      Math.round((workouts.length / Math.max(1, (Date.now() - new Date(workouts[workouts.length - 1].performed_at).getTime()) / (1000 * 60 * 60 * 24 * 7))) * 10) / 10 : 0

    return { thisWeek, thisMonth, avgPerWeek, total: workouts.length }
  }, [workouts])

  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 50

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user && !DEMO) { window.location.href = '/login'; return }

      const userId = await getActiveUserId()
      if (!userId) return

      // Load initial page of workout data
      const { data: w } = await supabase
        .from('workouts')
        .select('id,performed_at,title')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(PAGE_SIZE)
      const initialWorkouts = (w || []) as Workout[]
      setWorkouts(initialWorkouts)
      setHasMore(initialWorkouts.length === PAGE_SIZE)

      // Load initial BJJ and Cardio data
      const { data: bj } = await supabase
        .from('bjj_sessions')
        .select('id,performed_at,duration_min,kind,intensity,notes')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(PAGE_SIZE)
      setBjj((bj || []) as BJJ[])

      const { data: cardioData } = await supabase
        .from('cardio_sessions')
        .select('id,performed_at,activity,duration_minutes,distance,distance_unit,intensity,notes')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(PAGE_SIZE)
      setCardio((cardioData || []) as Cardio[])

      // Load progression analytics
      await loadProgressionData(userId)
      await loadVolumeData(userId)

      setLoading(false)
    })()
  }, [])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      const nextPage = page + 1
      const offset = nextPage * PAGE_SIZE

      const { data: w } = await supabase
        .from('workouts')
        .select('id,performed_at,title')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      const newWorkouts = (w || []) as Workout[]
      setWorkouts(prev => [...prev, ...newWorkouts])
      setPage(nextPage)
      setHasMore(newWorkouts.length === PAGE_SIZE)
    } catch (error) {
      console.error('Error loading more workouts:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  async function loadProgressionData(userId: string) {
    // Get top exercises with progression data over last 90 days
    const { data: exerciseData } = await supabase
      .from('workout_exercises')
      .select(`
        exercise_id,
        display_name,
        workouts!inner(performed_at, user_id),
        sets(weight, reps, set_type)
      `)
      .eq('workouts.user_id', userId)
      .gte('workouts.performed_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('workouts.performed_at', { ascending: true })

    if (exerciseData) {
      // Group by exercise and calculate progression
      const exerciseMap = new Map<string, {
        name: string
        sessions: Array<{ date: string; maxWeight: number; totalVolume: number }>
      }>()

      exerciseData.forEach((item: any) => {
        const exerciseId = item.exercise_id
        const date = new Date(item.workouts.performed_at).toISOString().split('T')[0]
        
        const workingSets = item.sets?.filter((s: any) => s.set_type === 'working' && s.weight > 0) || []
        const maxWeight = workingSets.length > 0 ? Math.max(...workingSets.map((s: any) => s.weight)) : 0
        const totalVolume = workingSets.reduce((sum: number, s: any) => sum + (s.weight * s.reps), 0)

        if (maxWeight > 0) {
          if (!exerciseMap.has(exerciseId)) {
            exerciseMap.set(exerciseId, {
              name: item.display_name,
              sessions: []
            })
          }
          
          const existing = exerciseMap.get(exerciseId)!
          // Only keep the highest weight/volume for each date
          const existingSession = existing.sessions.find(s => s.date === date)
          if (existingSession) {
            existingSession.maxWeight = Math.max(existingSession.maxWeight, maxWeight)
            existingSession.totalVolume = Math.max(existingSession.totalVolume, totalVolume)
          } else {
            existing.sessions.push({ date, maxWeight, totalVolume })
          }
        }
      })

      // Convert to progression data
      const progression: ProgressionData[] = Array.from(exerciseMap.entries())
        .filter(([_, data]) => data.sessions.length >= 2) // Only exercises with multiple sessions
        .map(([exerciseId, data]) => ({
          exerciseId,
          exerciseName: data.name,
          data: data.sessions.map(session => ({
            date: session.date,
            maxWeight: session.maxWeight,
            totalVolume: session.totalVolume,
            oneRepMax: Math.round(session.maxWeight * (1 + 0.0333 * 10)) // Rough 1RM estimate
          }))
        }))
        .sort((a, b) => b.data.length - a.data.length) // Sort by most data points
        .slice(0, 8) // Top 8 exercises

      setProgressionData(progression)
    }
  }

  async function loadVolumeData(userId: string) {
    // Get volume data by workout type over last 60 days
    const { data: workoutData } = await supabase
      .from('workouts')
      .select(`
        id,
        performed_at,
        title,
        workout_exercises!inner(
          display_name,
          sets(weight, reps, set_type)
        )
      `)
      .eq('user_id', userId)
      .gte('performed_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      .order('performed_at', { ascending: true })

    if (workoutData) {
      const volumeByDate = new Map<string, { upperVolume: number; lowerVolume: number; totalSets: number }>()

      workoutData.forEach((workout: any) => {
        const date = new Date(workout.performed_at).toISOString().split('T')[0]
        const title = workout.title?.toLowerCase() || ''
        
        const isUpper = title.includes('upper') || title.includes('push') || title.includes('pull')
        const isLower = title.includes('lower') || title.includes('legs') || title.includes('squat') || title.includes('deadlift')
        
        let totalVolume = 0
        let totalSets = 0
        
        workout.workout_exercises.forEach((exercise: any) => {
          const workingSets = exercise.sets?.filter((s: any) => s.set_type === 'working') || []
          totalSets += workingSets.length
          totalVolume += workingSets.reduce((sum: number, s: any) => sum + (s.weight * s.reps), 0)
        })

        if (!volumeByDate.has(date)) {
          volumeByDate.set(date, { upperVolume: 0, lowerVolume: 0, totalSets: 0 })
        }
        
        const existing = volumeByDate.get(date)!
        existing.totalSets += totalSets
        
        if (isUpper) {
          existing.upperVolume += totalVolume
        } else if (isLower) {
          existing.lowerVolume += totalVolume
        } else {
          // If we can't categorize, split evenly
          existing.upperVolume += totalVolume / 2
          existing.lowerVolume += totalVolume / 2
        }
      })

      const volumeArray: VolumeData[] = Array.from(volumeByDate.entries()).map(([date, data]) => ({
        date,
        upperVolume: Math.round(data.upperVolume),
        lowerVolume: Math.round(data.lowerVolume),
        totalSets: data.totalSets
      }))

      setVolumeData(volumeArray)
    }
  }

  if (loading) return (<main className="max-w-6xl mx-auto p-4">Loading analytics...</main>)

  return (
    <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">🏋️ Training Analytics</h1>
        <div className="flex gap-2">
          <button
            className={`toggle ${selectedView === 'analytics' ? 'bg-brand-red/20 border-brand-red' : ''}`}
            onClick={() => setSelectedView('analytics')}
          >
            📊 Analytics
          </button>
          <button
            className={`toggle ${selectedView === 'workouts' ? 'bg-brand-red/20 border-brand-red' : ''}`}
            onClick={() => setSelectedView('workouts')}
          >
            📋 Workouts
          </button>
        </div>
      </div>
      
      {highlightId && highlightType === 'workout' && (
        <WorkoutDetail workoutId={highlightId} onClose={closeModal} />
      )}
      {highlightId && highlightType === 'bjj' && (
        <BJJDetail sessionId={highlightId} onClose={closeModal} />
      )}
      {highlightId && highlightType === 'cardio' && (
        <CardioDetail sessionId={highlightId} onClose={closeModal} onUpdate={() => window.location.reload()} />
      )}

      {selectedView === 'analytics' ? (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <div className="text-3xl font-bold text-brand-red">{workoutStats.thisWeek}</div>
              <div className="text-sm text-white/70">This Week</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-blue-400">{workoutStats.thisMonth}</div>
              <div className="text-sm text-white/70">This Month</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-green-400">{workoutStats.avgPerWeek}</div>
              <div className="text-sm text-white/70">Avg/Week</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-purple-400">{workoutStats.total}</div>
              <div className="text-sm text-white/70">Total Workouts</div>
            </div>
          </div>

          {/* Volume Trends */}
          {volumeData.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-bold mb-4">📈 Volume Trends (60 Days)</h2>
              <div className="space-y-3">
                {volumeData.slice(-10).map((day, index) => (
                  <div key={day.date} className="flex items-center gap-4">
                    <div className="w-20 text-sm text-white/70">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1">
                      <div className="flex h-6 bg-black/30 rounded-full overflow-hidden">
                        <div 
                          className="bg-red-500/70 flex items-center justify-center text-xs text-white/80"
                          style={{ width: `${Math.max(10, (day.upperVolume / (day.upperVolume + day.lowerVolume)) * 100)}%` }}
                        >
                          {day.upperVolume > 0 ? 'U' : ''}
                        </div>
                        <div 
                          className="bg-blue-500/70 flex items-center justify-center text-xs text-white/80"
                          style={{ width: `${Math.max(10, (day.lowerVolume / (day.upperVolume + day.lowerVolume)) * 100)}%` }}
                        >
                          {day.lowerVolume > 0 ? 'L' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-white/60 w-16 text-right">
                      {day.totalSets} sets
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 text-sm text-white/60 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500/70 rounded"></div>
                  Upper Body
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500/70 rounded"></div>
                  Lower Body
                </div>
              </div>
            </div>
          )}

          {/* Exercise Progression */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">💪 Exercise Progression</h2>
              {progressionData.length > 0 && (
                <select
                  className="input text-sm"
                  value={selectedExercise}
                  onChange={(e) => setSelectedExercise(e.target.value)}
                >
                  <option value="">All Exercises</option>
                  {progressionData.map((ex) => (
                    <option key={ex.exerciseId} value={ex.exerciseId}>
                      {ex.exerciseName}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {progressionData.length === 0 ? (
              <div className="text-center text-white/60 py-8">
                <div className="text-4xl mb-2">📊</div>
                <div>No progression data yet. Complete a few workouts to see your progress!</div>
              </div>
            ) : (
              <div className="space-y-6">
                {(selectedExercise ? 
                  progressionData.filter(ex => ex.exerciseId === selectedExercise) : 
                  progressionData.slice(0, 3)
                ).map((exercise) => (
                  <div key={exercise.exerciseId} className="bg-black/20 rounded-xl p-4">
                    <h3 className="font-medium mb-3">{exercise.exerciseName}</h3>
                    <div className="space-y-2">
                      {exercise.data.slice(-8).map((session, index) => (
                        <div key={session.date} className="flex items-center justify-between text-sm">
                          <div className="text-white/70">
                            {new Date(session.date).toLocaleDateString()}
                          </div>
                          <div className="flex gap-4">
                            <span className="text-brand-red font-medium">{session.maxWeight} lb</span>
                            <span className="text-blue-400">{(session.totalVolume / 1000).toFixed(1)}k vol</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {exercise.data.length >= 2 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex justify-between text-xs text-white/60">
                          <span>Latest: {exercise.data[exercise.data.length - 1].maxWeight} lb</span>
                          <span className={`${
                            exercise.data[exercise.data.length - 1].maxWeight > exercise.data[exercise.data.length - 2].maxWeight
                              ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {exercise.data[exercise.data.length - 1].maxWeight > exercise.data[exercise.data.length - 2].maxWeight ? '📈' : '📉'}
                            {exercise.data[exercise.data.length - 1].maxWeight - exercise.data[exercise.data.length - 2].maxWeight > 0 ? '+' : ''}
                            {exercise.data[exercise.data.length - 1].maxWeight - exercise.data[exercise.data.length - 2].maxWeight} lb
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Workout History View */
        <>
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl font-bold">Workout History</h2>
            <div className="flex gap-2">
              <button
                className={`toggle text-sm ${workoutFilter === 'week' ? 'bg-brand-red/20 border-brand-red' : ''}`}
                onClick={() => setWorkoutFilter('week')}
              >
                This Week
              </button>
              <button
                className={`toggle text-sm ${workoutFilter === 'month' ? 'bg-brand-red/20 border-brand-red' : ''}`}
                onClick={() => setWorkoutFilter('month')}
              >
                This Month
              </button>
              <button
                className={`toggle text-sm ${workoutFilter === 'all' ? 'bg-brand-red/20 border-brand-red' : ''}`}
                onClick={() => setWorkoutFilter('all')}
              >
                All Time
              </button>
            </div>
          </div>

          {/* Strength Training */}
          <div className="card">
            <div className="font-medium mb-3">💪 Strength Training ({filteredWorkouts.length})</div>
            <div className="grid gap-2 max-h-96 overflow-y-auto">
              {filteredWorkouts.map(w => (
                <div
                  key={w.id}
                  className={`flex items-start justify-between rounded-xl p-3 ${highlightId === w.id ? 'border border-brand-red bg-brand-red/10' : 'bg-black/30'}`}
                >
                  <div>
                    <div className="text-white/90">{new Date(w.performed_at).toLocaleDateString()} at {new Date(w.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="text-white/70 text-sm">{w.title ?? 'Untitled'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => router.push(`/history?highlight=${w.id}`)} className="toggle text-sm px-3 py-1">Open</button>
                    <button onClick={() => router.push(`/workouts/edit/${w.id}`)} className="toggle text-sm px-3 py-1 bg-blue-500/20 border-blue-400/50 hover:bg-blue-500/30">Edit</button>
                  </div>
                </div>
              ))}
              {!filteredWorkouts.length && <div className="text-white/60">No workouts in selected time period.</div>}
            </div>
            {hasMore && workoutFilter === 'all' && (
              <div className="mt-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>

          {/* Other Activities */}
          {(bjj.length > 0 || cardio.length > 0) && (
            <>
              {bjj.length > 0 && (
                <div className="card">
                  <div className="font-medium mb-3">🥋 Jiu Jitsu ({bjj.length})</div>
                  <div className="grid gap-2 max-h-64 overflow-y-auto">
                    {bjj.slice(0, 10).map(s => (
                      <div key={s.id} className={`flex items-start justify-between rounded-xl p-3 ${highlightId === s.id && highlightType === 'bjj' ? 'border border-brand-red bg-brand-red/10' : 'bg-black/30'}`}>
                        <div>
                          <div className="text-white/90">{new Date(s.performed_at).toLocaleDateString()}</div>
                          <div className="text-white/80">{s.kind.replace('_', ' ')} • {s.duration_min} min {s.intensity ? `• ${s.intensity}` : ''}</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => router.push(`/history?highlight=${s.id}&type=bjj`)} className="toggle text-sm px-3 py-1">Open</button>
                          <button onClick={() => router.push(`/jiu-jitsu/edit/${s.id}`)} className="toggle text-sm px-3 py-1 bg-blue-500/20 border-blue-400/50 hover:bg-blue-500/30">Edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cardio.length > 0 && (
                <div className="card">
                  <div className="font-medium mb-3">🏃 Cardio ({cardio.length})</div>
                  <div className="grid gap-2 max-h-64 overflow-y-auto">
                    {cardio.slice(0, 10).map(c => (
                      <div key={c.id} className={`flex items-start justify-between rounded-xl p-3 ${highlightId === c.id && highlightType === 'cardio' ? 'border border-brand-red bg-brand-red/10' : 'bg-black/30'}`}>
                        <div>
                          <div className="text-white/90">{new Date(c.performed_at).toLocaleDateString()}</div>
                          <div className="text-white/80">
                            {c.activity}
                            {c.duration_minutes && ` • ${c.duration_minutes} min`}
                            {c.distance && c.distance_unit && ` • ${c.distance} ${c.distance_unit}`}
                            {c.intensity && ` • ${c.intensity}`}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => router.push(`/history?highlight=${c.id}&type=cardio`)} className="toggle text-sm px-3 py-1">Open</button>
                          <button onClick={() => router.push(`/cardio/edit/${c.id}`)} className="toggle text-sm px-3 py-1 bg-pink-500/20 border-pink-400/50 hover:bg-pink-500/30">Edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  )
}
