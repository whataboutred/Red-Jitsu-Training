// Pure mapping helpers: Google Health "exercise" dataPoint -> cardio_sessions row.
// Field paths verified against real Fitbit-via-Google-Health data.

// A Duration in REST JSON is a string like "2775s" (may be fractional). We also
// tolerate a number (seconds) or { seconds } object defensively.
function durationSeconds(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(/s$/, '')) || 0
  if (typeof v === 'object' && v !== null && 'seconds' in (v as any)) return Number((v as any).seconds) || 0
  return 0
}

type HeartRateZoneDurations = {
  lightTime?: unknown
  moderateTime?: unknown
  vigorousTime?: unknown
  peakTime?: unknown
}

export type GoogleExercise = {
  interval?: { startTime?: string; endTime?: string }
  exerciseType?: string
  displayName?: string
  activeDuration?: unknown // Duration, at the exercise level
  metricsSummary?: {
    caloriesKcal?: number
    distanceMillimeters?: number
    averageHeartRateBeatsPerMinute?: string | number
    activeDuration?: unknown // sometimes here too — checked as a fallback
    heartRateZoneDurations?: HeartRateZoneDurations
  }
}

export type GoogleExerciseDataPoint = {
  name?: string
  dataPointId?: string
  exercise?: GoogleExercise
} & Partial<GoogleExercise>

export type Intensity = 'low' | 'medium' | 'high'

// Google reports time in light / moderate / vigorous / peak zones. Collapse to
// our three levels (light=low, moderate=medium, vigorous+peak=high), dominant
// bucket wins; ties round up. No zone data -> medium.
export function deriveIntensity(zones: HeartRateZoneDurations | undefined): Intensity {
  if (!zones) return 'medium'
  const low = durationSeconds(zones.lightTime)
  const medium = durationSeconds(zones.moderateTime)
  const high = durationSeconds(zones.vigorousTime) + durationSeconds(zones.peakTime)
  if (low === 0 && medium === 0 && high === 0) return 'medium'
  if (high >= medium && high >= low) return 'high'
  if (medium >= low) return 'medium'
  return 'low'
}

function exerciseMinutes(ex: GoogleExercise): number {
  let secs = durationSeconds(ex.activeDuration ?? ex.metricsSummary?.activeDuration)
  if (secs < 1 && ex.interval?.startTime && ex.interval?.endTime) {
    secs = (new Date(ex.interval.endTime).getTime() - new Date(ex.interval.startTime).getTime()) / 1000
  }
  return Math.round(secs / 60)
}

function buildNote(ex: GoogleExercise, intensity: Intensity): string {
  const parts: string[] = ['Imported from Fitbit']
  const avg = Number(ex.metricsSummary?.averageHeartRateBeatsPerMinute)
  if (avg > 0) parts.push(`avg HR ${Math.round(avg)}`)
  const z = ex.metricsSummary?.heartRateZoneDurations
  if (z) {
    const vigorous = Math.round((durationSeconds(z.vigorousTime) + durationSeconds(z.peakTime)) / 60)
    const moderate = Math.round(durationSeconds(z.moderateTime) / 60)
    const summary: string[] = []
    if (vigorous > 0) summary.push(`${vigorous}m vigorous`)
    if (moderate > 0) summary.push(`${moderate}m moderate`)
    if (summary.length) parts.push(summary.join(' / '))
  }
  return parts.join(' · ')
}

function prettyType(ex: GoogleExercise): string {
  if (ex.displayName) return ex.displayName
  if (ex.exerciseType) {
    return ex.exerciseType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return 'Workout'
}

function matchesAllowed(ex: GoogleExercise, allowed: string[]): boolean {
  if (allowed.length === 0) return false
  const hay = `${ex.displayName ?? ''} ${ex.exerciseType ?? ''}`.toLowerCase().replace(/_/g, ' ')
  const words = hay.split(/\s+/).filter(Boolean)
  return allowed.some((a) => {
    const al = a.toLowerCase()
    if (hay.includes(al)) return true
    // Stem overlap so "Biking" matches "BIKE", "Running" matches "RUN", etc.
    return words.some((w) => w.length >= 3 && al.length >= 3 && w.slice(0, 3) === al.slice(0, 3))
  })
}

export type MappedCardio = {
  external_id: string
  source: 'fitbit'
  activity: string
  duration_minutes: number
  distance: number | null
  distance_unit: 'miles'
  intensity: Intensity
  calories: number | null
  notes: string
  performed_at: string
}

export function mapExerciseToCardio(
  dp: GoogleExerciseDataPoint,
  allowed: string[]
): MappedCardio | null {
  const ex: GoogleExercise = dp.exercise ?? (dp as GoogleExercise)
  const start = ex.interval?.startTime
  if (!start) return null
  if (!matchesAllowed(ex, allowed)) return null

  const minutes = exerciseMinutes(ex)
  if (minutes < 1) return null

  const mm = ex.metricsSummary?.distanceMillimeters
  const miles = typeof mm === 'number' && mm > 0 ? Number((mm / 1_609_344).toFixed(2)) : null

  const cal = ex.metricsSummary?.caloriesKcal
  const intensity = deriveIntensity(ex.metricsSummary?.heartRateZoneDurations)

  const externalId = dp.name || dp.dataPointId || `${start}|${ex.exerciseType ?? ex.displayName ?? 'ex'}`

  return {
    external_id: String(externalId),
    source: 'fitbit',
    activity: prettyType(ex),
    duration_minutes: minutes,
    distance: miles,
    distance_unit: 'miles',
    intensity,
    calories: typeof cal === 'number' && cal > 0 ? Math.round(cal) : null,
    notes: buildNote(ex, intensity),
    performed_at: new Date(start).toISOString(),
  }
}
