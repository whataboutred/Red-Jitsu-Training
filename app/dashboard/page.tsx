'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId } from '@/lib/activeUser'
import { logger, EventType } from '@/lib/splunkLogger'
import {
  Dumbbell,
  Activity,
  Heart,
  TrendingUp,
  Calendar,
  Clock,
  ChevronRight,
  Target,
  Flame,
  Zap,
} from 'lucide-react'
import { AnimatedCard, StatCard } from '@/components/ui/Card'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

type Workout = { id: string; performed_at: string; title: string | null }
type BJJ = {
  id: string
  performed_at: string
  duration_min: number
  kind: 'class' | 'drilling' | 'open_mat'
}
type Cardio = {
  id: string
  performed_at: string
  activity: string
  duration_minutes: number | null
}

function startOfWeekSunday(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  x.setDate(x.getDate() - day)
  return x
}

function weekKey(d: Date) {
  return startOfWeekSunday(d).toISOString().slice(0, 10)
}

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Motivational quotes
const quotes = [
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "The body achieves what the mind believes.", author: "Napoleon Hill" },
  { text: "Don't wish for it. Work for it.", author: "Unknown" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
]

// Progress Ring Component
function ProgressRing({ progress, size = 80, strokeWidth = 6, color = 'stroke-brand-red' }: {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          className="stroke-zinc-800"
          fill="none"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <motion.circle
          className={color}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold">{Math.round(progress)}%</span>
      </div>
    </div>
  )
}

// Goal Card Component
function GoalCard({
  type,
  icon: Icon,
  label,
  current,
  goal,
  streak,
  isOnTrack,
  color,
  href,
}: {
  type: 'strength' | 'bjj' | 'cardio'
  icon: React.ElementType
  label: string
  current: number
  goal: number
  streak: number
  isOnTrack: boolean
  color: string
  href: string
}) {
  const progress = Math.min((current / goal) * 100, 100)
  const colorMap = {
    strength: { ring: 'stroke-red-500', bg: 'from-red-500/10', border: 'border-red-500/20' },
    bjj: { ring: 'stroke-purple-500', bg: 'from-purple-500/10', border: 'border-purple-500/20' },
    cardio: { ring: 'stroke-emerald-500', bg: 'from-emerald-500/10', border: 'border-emerald-500/20' },
  }

  return (
    <AnimatedCard
      className={`bg-gradient-to-br ${colorMap[type].bg} to-transparent ${colorMap[type].border}`}
      delay={type === 'strength' ? 0 : type === 'bjj' ? 0.1 : 0.2}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-zinc-800`}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{label}</h3>
            <p className="text-sm text-zinc-400">Weekly Goal</p>
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 rounded-lg">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">{streak}w</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <ProgressRing progress={progress} color={colorMap[type].ring} />
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold">{current}</span>
            <span className="text-zinc-500">/ {goal}</span>
          </div>
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium ${
            isOnTrack
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}>
            {isOnTrack ? (
              <>
                <TrendingUp className="w-3.5 h-3.5" />
                On Track
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Catch Up
              </>
            )}
          </div>
        </div>
      </div>

      <Link
        href={href}
        className="mt-4 flex items-center justify-between p-3 -mx-1 rounded-xl hover:bg-white/5 transition-colors group"
      >
        <span className="text-sm text-zinc-400">Start {label}</span>
        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </Link>
    </AnimatedCard>
  )
}

// Recent Activity Item
function ActivityItem({
  type,
  title,
  subtitle,
  date,
  id,
}: {
  type: 'workout' | 'bjj' | 'cardio'
  title: string
  subtitle?: string
  date: string
  id: string
}) {
  const icons = {
    workout: { icon: Dumbbell, color: 'text-red-400', bg: 'bg-red-500/10' },
    bjj: { icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    cardio: { icon: Heart, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  }
  const { icon: Icon, color, bg } = icons[type]

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors group"
    >
      <div className={`p-2 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{title}</p>
        {subtitle && <p className="text-sm text-zinc-500 truncate">{subtitle}</p>}
      </div>
      <div className="text-right">
        <p className="text-sm text-zinc-400">{formatRelativeDate(date)}</p>
      </div>
    </motion.div>
  )
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [bjj, setBjj] = useState<BJJ[]>([])
  const [cardio, setCardio] = useState<Cardio[]>([])
  const [weeklyGoal, setWeeklyGoal] = useState<number>(4)
  const [bjjWeeklyGoal, setBjjWeeklyGoal] = useState<number>(2)
  const [cardioWeeklyGoal, setCardioWeeklyGoal] = useState<number>(3)
  const [showStrengthGoal, setShowStrengthGoal] = useState<boolean>(true)
  const [showBjjGoal, setShowBjjGoal] = useState<boolean>(true)
  const [showCardioGoal, setShowCardioGoal] = useState<boolean>(false)

  // Random quote for today
  const todayQuote = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
    return quotes[dayOfYear % quotes.length]
  }, [])

  const loadProfileData = async () => {
    const userId = await getActiveUserId()
    if (!userId) return

    const { data: prof } = await supabase
      .from('profiles')
      .select('weekly_goal,target_weeks,goal_start,bjj_weekly_goal,cardio_weekly_goal,show_strength_goal,show_bjj_goal,show_cardio_goal')
      .eq('id', userId)
      .maybeSingle()
    if (prof) {
      setWeeklyGoal(prof.weekly_goal ?? 4)
      setBjjWeeklyGoal(prof.bjj_weekly_goal ?? 2)
      setCardioWeeklyGoal(prof.cardio_weekly_goal ?? 3)
      setShowStrengthGoal(prof.show_strength_goal ?? true)
      setShowBjjGoal(prof.show_bjj_goal ?? true)
      setShowCardioGoal(prof.show_cardio_goal ?? false)
    }
  }

  useEffect(() => {
    ;(async () => {
      const userId = await getActiveUserId()
      if (!userId) {
        if (!DEMO) {
          window.location.href = '/login'
        }
        setLoading(false)
        return
      }

      await loadProfileData()
      logger.info(EventType.API_REQUEST, 'Dashboard page loaded', { user_id: userId }, userId)

      const [workoutsRes, bjjRes, cardioRes] = await Promise.all([
        supabase
          .from('workouts')
          .select('id,performed_at,title')
          .eq('user_id', userId)
          .order('performed_at', { ascending: false })
          .limit(1000),
        supabase
          .from('bjj_sessions')
          .select('id,performed_at,duration_min,kind')
          .eq('user_id', userId)
          .order('performed_at', { ascending: false })
          .limit(1000),
        supabase
          .from('cardio_sessions')
          .select('id,performed_at,activity,duration_minutes')
          .eq('user_id', userId)
          .order('performed_at', { ascending: false })
          .limit(1000),
      ])

      setWorkouts((workoutsRes.data || []) as Workout[])
      setBjj((bjjRes.data || []) as BJJ[])
      setCardio((cardioRes.data || []) as Cardio[])
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) loadProfileData()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [])

  const now = new Date()
  const thisWeekKey = weekKey(now)
  const dayIndex = now.getDay()

  // Calculate weekly stats
  const wkCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const w of workouts) {
      const k = weekKey(new Date(w.performed_at))
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [workouts])

  const thisWeekCount = wkCounts.get(thisWeekKey) || 0

  const strengthStreak = useMemo(() => {
    const keys: string[] = []
    let cursor = startOfWeekSunday(now)
    for (let i = 0; i < 120; i++) {
      keys.push(cursor.toISOString().slice(0, 10))
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() - 7)
    }
    let streak = 0
    for (const k of keys) {
      const c = wkCounts.get(k) || 0
      if (c >= weeklyGoal) streak++
      else {
        if (k === thisWeekKey && c < weeklyGoal) continue
        break
      }
    }
    return streak
  }, [wkCounts, weeklyGoal, thisWeekKey])

  const expectedByToday = Math.ceil((weeklyGoal * (dayIndex + 1)) / 7)
  const onTrackStrength = thisWeekCount >= expectedByToday

  // BJJ stats
  const bjjWeekCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of bjj) {
      const k = weekKey(new Date(s.performed_at))
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [bjj])

  const bjjThisWeekCount = bjjWeekCounts.get(thisWeekKey) || 0

  const bjjStreak = useMemo(() => {
    const keys: string[] = []
    let cursor = startOfWeekSunday(now)
    for (let i = 0; i < 120; i++) {
      keys.push(cursor.toISOString().slice(0, 10))
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() - 7)
    }
    let streak = 0
    for (const k of keys) {
      const c = bjjWeekCounts.get(k) || 0
      if (c >= bjjWeeklyGoal) streak++
      else {
        if (k === thisWeekKey && c < bjjWeeklyGoal) continue
        break
      }
    }
    return streak
  }, [bjjWeekCounts, bjjWeeklyGoal, thisWeekKey])

  const bjjExpectedByToday = Math.ceil((bjjWeeklyGoal * (dayIndex + 1)) / 7)
  const onTrackBjj = bjjThisWeekCount >= bjjExpectedByToday

  // Cardio stats
  const cardioWeekCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of cardio) {
      const k = weekKey(new Date(s.performed_at))
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [cardio])

  const cardioThisWeekCount = cardioWeekCounts.get(thisWeekKey) || 0

  const cardioStreak = useMemo(() => {
    const keys: string[] = []
    let cursor = startOfWeekSunday(now)
    for (let i = 0; i < 120; i++) {
      keys.push(cursor.toISOString().slice(0, 10))
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() - 7)
    }
    let streak = 0
    for (const k of keys) {
      const c = cardioWeekCounts.get(k) || 0
      if (c >= cardioWeeklyGoal) streak++
      else {
        if (k === thisWeekKey && c < cardioWeeklyGoal) continue
        break
      }
    }
    return streak
  }, [cardioWeekCounts, cardioWeeklyGoal, thisWeekKey])

  const cardioExpectedByToday = Math.ceil((cardioWeeklyGoal * (dayIndex + 1)) / 7)
  const onTrackCardio = cardioThisWeekCount >= cardioExpectedByToday

  // Recent activities
  const recentActivities = useMemo(() => {
    const all = [
      ...workouts.slice(0, 10).map((w) => ({
        type: 'workout' as const,
        id: w.id,
        title: w.title || 'Workout',
        date: w.performed_at,
      })),
      ...bjj.slice(0, 10).map((s) => ({
        type: 'bjj' as const,
        id: s.id,
        title: s.kind.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        subtitle: `${s.duration_min} min`,
        date: s.performed_at,
      })),
      ...cardio.slice(0, 10).map((s) => ({
        type: 'cardio' as const,
        id: s.id,
        title: s.activity,
        subtitle: s.duration_minutes ? `${s.duration_minutes} min` : undefined,
        date: s.performed_at,
      })),
    ]
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)
  }, [workouts, bjj, cardio])

  // Greeting based on time
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="space-y-2">
          <Skeleton width={200} height={32} />
          <Skeleton width={300} height={20} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard className="sm:col-span-2 lg:col-span-1" />
        </div>
      </div>
    )
  }

  const enabledGoals = [
    showStrengthGoal && 'strength',
    showBjjGoal && 'bjj',
    showCardioGoal && 'cardio',
  ].filter(Boolean)

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="text-2xl font-bold text-white">{greeting}</h1>
        <p className="text-zinc-400">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </motion.div>

      {/* Quick Start Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <AnimatedCard className="bg-gradient-to-r from-brand-red/20 to-orange-500/10 border-brand-red/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Ready to train?</h2>
              <p className="text-zinc-400 text-sm">Start your workout and track your progress</p>
            </div>
            <Link
              href="/workouts/new"
              className="flex items-center gap-2 px-5 py-3 bg-brand-red text-white font-semibold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
            >
              <Dumbbell className="w-5 h-5" />
              <span className="hidden sm:inline">Start Workout</span>
            </Link>
          </div>
        </AnimatedCard>
      </motion.div>

      {/* Goal Cards */}
      {enabledGoals.length > 0 ? (
        <div className={`grid gap-4 ${
          enabledGoals.length === 1
            ? 'grid-cols-1'
            : enabledGoals.length === 2
              ? 'sm:grid-cols-2'
              : 'sm:grid-cols-2 lg:grid-cols-3'
        }`}>
          {showStrengthGoal && (
            <GoalCard
              type="strength"
              icon={Dumbbell}
              label="Strength"
              current={thisWeekCount}
              goal={weeklyGoal}
              streak={strengthStreak}
              isOnTrack={onTrackStrength}
              color="#ef4444"
              href="/workouts/new"
            />
          )}
          {showBjjGoal && (
            <GoalCard
              type="bjj"
              icon={Activity}
              label="Jiu-Jitsu"
              current={bjjThisWeekCount}
              goal={bjjWeeklyGoal}
              streak={bjjStreak}
              isOnTrack={onTrackBjj}
              color="#a855f7"
              href="/jiu-jitsu"
            />
          )}
          {showCardioGoal && (
            <GoalCard
              type="cardio"
              icon={Heart}
              label="Cardio"
              current={cardioThisWeekCount}
              goal={cardioWeeklyGoal}
              streak={cardioStreak}
              isOnTrack={onTrackCardio}
              color="#10b981"
              href="/cardio"
            />
          )}
        </div>
      ) : (
        <AnimatedCard className="text-center py-8">
          <Target className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="font-semibold text-zinc-400 mb-2">No goals configured</h3>
          <p className="text-zinc-500 text-sm mb-4">Set up your weekly goals to track your progress</p>
          <Link href="/settings" className="btn btn-sm">
            Configure Goals
          </Link>
        </AnimatedCard>
      )}

      {/* Recent Activity */}
      <AnimatedCard delay={0.3}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            Recent Activity
          </h2>
          <Link href="/history" className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1">
            View all
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-1">
          {recentActivities.length > 0 ? (
            recentActivities.map((activity, i) => (
              <ActivityItem
                key={`${activity.type}-${activity.id}`}
                type={activity.type}
                title={activity.title}
                subtitle={(activity as any).subtitle}
                date={activity.date}
                id={activity.id}
              />
            ))
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No activity yet</p>
              <p className="text-zinc-500 text-sm">Start tracking your workouts!</p>
            </div>
          )}
        </div>
      </AnimatedCard>

      {/* Motivational Quote */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center py-6"
      >
        <p className="text-zinc-400 italic mb-2">"{todayQuote.text}"</p>
        <p className="text-zinc-500 text-sm">— {todayQuote.author}</p>
      </motion.div>
    </div>
  )
}
