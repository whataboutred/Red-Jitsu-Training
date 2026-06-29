import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/fitbit/server'
import { loadConnection } from '@/lib/fitbit/sync'
import { decryptToken } from '@/lib/fitbit/crypto'
import { revokeToken } from '@/lib/fitbit/client'

export async function POST(req: NextRequest) {
  const auth = await getUserFromBearer(req)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const conn = await loadConnection(auth.supabase, auth.userId)
  if (conn?.access_token_enc) {
    try {
      await revokeToken(decryptToken(conn.access_token_enc))
    } catch {
      /* best effort */
    }
  }

  const { error } = await auth.supabase.from('fitbit_connections').delete().eq('user_id', auth.userId)
  if (error) return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
