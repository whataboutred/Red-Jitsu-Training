import 'server-only'
import type { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Elevated client for the cron job only (no user session in a background run).
// Never imported by client code — service role key is server-only.
export function serviceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  return createClient(URL, key, { auth: { persistSession: false } })
}

// For routes the client calls via fetch with an Authorization: Bearer <token>.
export async function getUserFromBearer(
  req: NextRequest
): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const supabase = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return { supabase, userId: user.id }
}

// For OAuth navigations (/connect, /callback) where identity comes from cookies.
export async function getUserFromCookies(): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const cookieStore = cookies()
  const supabase = createServerClient(URL, ANON, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll() { /* no-op: short-lived routes don't refresh the session cookie */ },
    },
  }) as unknown as SupabaseClient
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return { supabase, userId: user.id }
}
