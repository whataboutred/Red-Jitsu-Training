import { describe, it, expect } from 'vitest'
import { suggestOverload, parseRepRange, weightIncrement, DEFAULT_REP_RANGE } from '@/lib/overload'

describe('parseRepRange', () => {
  it('parses ranges and single numbers', () => {
    expect(parseRepRange('8-12')).toEqual({ min: 8, max: 12 })
    expect(parseRepRange('6–8')).toEqual({ min: 6, max: 8 }) // en dash
    expect(parseRepRange('10')).toEqual({ min: 10, max: 10 })
    expect(parseRepRange(10)).toEqual({ min: 10, max: 10 })
  })

  it('rejects time-based and invalid schemes', () => {
    expect(parseRepRange('45-60s')).toBeNull()
    expect(parseRepRange('12-8')).toBeNull()
    expect(parseRepRange('')).toBeNull()
    expect(parseRepRange(null)).toBeNull()
  })
})

describe('weightIncrement', () => {
  it('steps by equipment and unit', () => {
    expect(weightIncrement('barbell', 'lb')).toBe(5)
    expect(weightIncrement('cable', 'lb')).toBe(2.5)
    expect(weightIncrement('barbell', 'kg')).toBe(2.5)
    expect(weightIncrement('dumbbell', 'kg')).toBe(2)
    expect(weightIncrement('machine', 'kg')).toBe(1.25)
    expect(weightIncrement(undefined, 'lb')).toBe(2.5)
  })
})

describe('suggestOverload', () => {
  const opts = { category: 'barbell', unit: 'lb' as const }

  it('adds a rep at the same weight when below the range max', () => {
    const t = suggestOverload(
      [{ weight: 180, reps: 10 }, { weight: 180, reps: 8 }],
      opts
    )
    expect(t).toMatchObject({ kind: 'add-reps', weight: 180, reps: 9 })
  })

  it('targets the WEAKEST top-weight set, ignoring lighter back-offs', () => {
    const t = suggestOverload(
      [{ weight: 185, reps: 12 }, { weight: 185, reps: 9 }, { weight: 155, reps: 15 }],
      opts
    )
    expect(t).toMatchObject({ kind: 'add-reps', weight: 185, reps: 10 })
  })

  it('adds weight and resets reps once every top set hits the range max', () => {
    const t = suggestOverload(
      [{ weight: 180, reps: 12 }, { weight: 180, reps: 12 }],
      opts
    )
    expect(t).toMatchObject({ kind: 'add-weight', weight: 185, reps: DEFAULT_REP_RANGE.min })
  })

  it('respects a custom rep range', () => {
    const t = suggestOverload(
      [{ weight: 225, reps: 6 }, { weight: 225, reps: 6 }],
      { ...opts, repRange: { min: 4, max: 6 } }
    )
    expect(t).toMatchObject({ kind: 'add-weight', weight: 230, reps: 4 })
  })

  it('progresses bodyweight work by reps', () => {
    const t = suggestOverload([{ weight: 0, reps: 12 }, { weight: 0, reps: 10 }], opts)
    expect(t).toMatchObject({ kind: 'bodyweight-reps', weight: 0, reps: 13 })
  })

  it('suggests a deload after three sessions without a new best', () => {
    const t = suggestOverload(
      [{ weight: 200, reps: 8 }],
      { ...opts, recentBestE1rms: [250, 252, 251] } // newest first, no progress
    )
    expect(t?.kind).toBe('deload')
    expect(t?.weight).toBe(180) // 200 * 0.9, on the 5 lb grid
    expect(t?.reps).toBe(DEFAULT_REP_RANGE.max)
  })

  it('does NOT deload when the newest session set a best', () => {
    const t = suggestOverload(
      [{ weight: 200, reps: 8 }],
      { ...opts, recentBestE1rms: [260, 252, 251] }
    )
    expect(t?.kind).toBe('add-reps')
  })

  it('returns null with no usable history', () => {
    expect(suggestOverload([], opts)).toBeNull()
    expect(suggestOverload([{ weight: 100, reps: 0 }], opts)).toBeNull()
  })
})
