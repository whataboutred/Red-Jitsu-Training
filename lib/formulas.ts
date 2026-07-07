/**
 * Strength training formulas for PR detection and 1RM estimation.
 */

/**
 * Estimate 1 Rep Max using the Epley formula.
 * Only valid for reps > 1. For 1 rep, the weight IS the 1RM.
 * Reps are capped at 12 — Epley diverges badly past that, and an uncapped
 * burnout set (135×25) would out-score a genuine heavy double.
 */
export function estimated1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + Math.min(reps, 12) / 30))
}

/**
 * Check if a set is a new personal record compared to existing records.
 * Returns the type of PR if it is one, null otherwise.
 */
export function detectPR(
  weight: number,
  reps: number,
  historicalMax: { weight: number; reps: number; estimated1rm: number } | null
): 'weight' | '1rm' | null {
  if (weight <= 0 || reps <= 0) return null
  if (!historicalMax) return 'weight' // First time = PR

  const current1RM = estimated1RM(weight, reps)

  // New weight PR at any rep range
  if (weight > historicalMax.weight) return 'weight'

  // New estimated 1RM PR
  if (current1RM > historicalMax.estimated1rm) return '1rm'

  return null
}

/**
 * Format a 1RM value for display.
 */
export function format1RM(weight: number, reps: number, unit: string): string {
  const e1rm = estimated1RM(weight, reps)
  if (e1rm <= 0) return ''
  return `Est. 1RM: ${e1rm} ${unit}`
}
