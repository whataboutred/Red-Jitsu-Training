import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/fitbit/server'
import { FITBIT_ACTIVITY_OPTIONS } from '@/lib/fitbit/constants'

// Update which Fitbit activity types are imported (the allowlist).
export async function POST(req: NextRequest) {
  const auth = await getUserFromBearer(req)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const allowed = Array.isArray(body?.allowed_activities) ? body.allowed_activities : null
  if (!allowed) return NextResponse.json({ error: 'allowed_activities required' }, { status: 400 })

  // Only accept known options (defensive; caps list size)
  const valid = allowed
    .filter((a: unknown): a is string => typeof a === 'string')
    .filter((a: string) => (FITBIT_ACTIVITY_OPTIONS as readonly string[]).includes(a))
    .slice(0, 50)

  const { error } = await auth.supabase
    .from('fitbit_connections')
    .update({ allowed_activities: valid, updated_at: new Date().toISOString() })
    .eq('user_id', auth.userId)
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  return NextResponse.json({ ok: true, allowed_activities: valid })
}
