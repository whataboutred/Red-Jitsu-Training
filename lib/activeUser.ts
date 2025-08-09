// lib/activeUser.ts
import { supabase } from '@/lib/supabaseClient'

export const DEMO =
  (process.env.NEXT_PUBLIC_DEMO_MODE || '').toLowerCase() === 'true'
export const DEMO_USER_ID = process.env.NEXT_PUBLIC_DEMO_USER_ID || ''

/**
 * Checks if the current visitor is in demo mode (no auth, but demo enabled)
 */
export async function isDemoVisitor(): Promise<boolean> {
  const { data } = await supabase.auth.getUser()
  return !data?.user && DEMO
}

/**
 * Returns the real session user id if logged in,
 * otherwise returns the demo user's id when demo mode is ON.
 */
export async function getActiveUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser()
    if (data?.user?.id) return data.user.id
    if (DEMO && DEMO_USER_ID) return DEMO_USER_ID
    return null
  } catch {
    return DEMO && DEMO_USER_ID ? DEMO_USER_ID : null
  }
}

/** True if the current visitor is in demo mode without a session (read-only). */
export async function isDemoVisitor(): Promise<boolean> {
  const { data } = await supabase.auth.getUser()
  return !data?.user?.id && DEMO
}
