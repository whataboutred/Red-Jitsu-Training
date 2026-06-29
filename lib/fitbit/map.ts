// Pure mapping helpers: Fitbit activity log entry -> our cardio_sessions row.
// No I/O here so it's trivially testable.

export type FitbitHeartRateZone = { name: string; minutes?: number }

export type FitbitActivity = {
  logId: number
  activityName?: string
  activityParentName?: string
  duration?: number // ms
  activeDuration?: number // ms
  calories?: number
  distance?: number // in miles when requested with en_US locale
  startTime?: string // ISO
  averageHeartRate?: number
  heartRateZones?: FitbitHeartRateZone[]
}

export type Intensity = 'low' | 'medium' | 'high'

// Fitbit's four HR zones collapse into our three levels:
//   Out of Range -> low (light) | Fat Burn -> medium | Cardio + Peak -> high
// Intensity = the bucket with the most minutes; ties round up. No HR data -> medium.
export function deriveIntensity(zones: FitbitHeartRateZone[] | undefined): Intensity {
  if (!zones || zones.length === 0) return 'medium'
  let low = 0, medium = 0, high = 0
  for (const z of zones) {
    const m = z.minutes ?? 0
    switch (z.name) {
      case 'Out of Range': low += m; break
      case 'Fat Burn': medium += m; break
      case 'Cardio':
      case 'Peak': high += m; break
    }
  }
  if (low === 0 && medium === 0 && high === 0) return 'medium'
  // ties round up: high wins over medium wins over low
  if (high >= medium && high >= low) return 'high'
  if (medium >= low) return 'medium'
  return 'low'
}

function buildNote(a: FitbitActivity, intensity: Intensity): string {
  const parts: string[] = ['Imported from Fitbit']
  if (a.averageHeartRate) parts.push(`avg HR ${a.averageHeartRate}`)
  const zoneMin = (name: string) => a.heartRateZones?.find((z) => z.name === name)?.minutes ?? 0
  const vigorous = zoneMin('Cardio') + zoneMin('Peak')
  const moderate = zoneMin('Fat Burn')
  const summary: string[] = []
  if (vigorous > 0) summary.push(`${Math.round(vigorous)}m vigorous`)
  if (moderate > 0) summary.push(`${Math.round(moderate)}m moderate`)
  if (summary.length > 0) parts.push(summary.join(' / '))
  return parts.join(' · ')
}

function matchesAllowed(activityName: string | undefined, allowed: string[]): boolean {
  if (!activityName) return false
  if (allowed.length === 0) return false
  const lower = activityName.toLowerCase()
  return allowed.some((a) => lower === a.toLowerCase() || lower.includes(a.toLowerCase()))
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

// Returns null when the activity isn't in the user's allowlist, lacks a start
// time, or is too short to be a real session.
export function mapActivityToCardio(
  a: FitbitActivity,
  allowed: string[]
): MappedCardio | null {
  if (!a.startTime) return null
  if (!matchesAllowed(a.activityName, allowed)) return null

  const ms = a.activeDuration ?? a.duration ?? 0
  const duration_minutes = Math.round(ms / 60000)
  if (duration_minutes < 1) return null

  const intensity = deriveIntensity(a.heartRateZones)

  return {
    external_id: String(a.logId),
    source: 'fitbit',
    activity: a.activityName || 'Workout',
    duration_minutes,
    distance: typeof a.distance === 'number' && a.distance > 0 ? Number(a.distance.toFixed(2)) : null,
    distance_unit: 'miles',
    intensity,
    calories: typeof a.calories === 'number' && a.calories > 0 ? Math.round(a.calories) : null,
    notes: buildNote(a, intensity),
    performed_at: new Date(a.startTime).toISOString(),
  }
}
