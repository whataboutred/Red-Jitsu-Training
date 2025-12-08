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
 *
 * Uses getSession() first which can auto-refresh expired tokens,
 * then falls back to getUser() for validation.
 */
export async function getActiveUserId(): Promise<string | null> {
  try {
    // First try getSession which can auto-refresh expired tokens
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionData?.session?.user?.id) {
      return sessionData.session.user.id
    }

    // If session failed or expired, try refreshing explicitly
    if (sessionError || !sessionData?.session) {
      const { data: refreshData } = await supabase.auth.refreshSession()
      if (refreshData?.session?.user?.id) {
        return refreshData.session.user.id
      }
    }

    // Fall back to demo mode if enabled
    if (DEMO && DEMO_USER_ID) return DEMO_USER_ID
    return null
  } catch {
    return DEMO && DEMO_USER_ID ? DEMO_USER_ID : null
  }
}


