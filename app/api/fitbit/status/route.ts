import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/fitbit/server'
import { loadConnection } from '@/lib/fitbit/sync'

export async function GET(req: NextRequest) {
  const auth = await getUserFromBearer(req)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const conn = await loadConnection(auth.supabase, auth.userId)
  if (!conn || !conn.access_token_enc) {
    return NextResponse.json({ connected: false })
  }

  // Google testing-mode refresh tokens expire ~7 days after authorization. Warn
  // proactively at day 6, and also whenever a sync already failed on auth.
  const RECONNECT_AFTER_DAYS = 6
  const ageDays = conn.connected_at
    ? (Date.now() - new Date(conn.connected_at).getTime()) / 86_400_000
    : 999
  const needsReconnect = conn.needs_reconnect || ageDays >= RECONNECT_AFTER_DAYS

  return NextResponse.json({
    connected: true,
    fitbitUserId: conn.fitbit_user_id,
    lastSyncAt: conn.last_sync_at,
    excludedActivities: conn.excluded_activities ?? [],
    needsReconnect,
  })
}
