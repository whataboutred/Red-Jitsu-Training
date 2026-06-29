import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/fitbit/server'
import { runSync } from '@/lib/fitbit/sync'

// Daily background sync. Triggered by Vercel Cron, which sends
// Authorization: Bearer <CRON_SECRET> when a CRON_SECRET env var is set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = serviceClient()
  const { data: conns, error } = await admin
    .from('fitbit_connections')
    .select('user_id')
    .not('access_token_enc', 'is', null)
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  const results: { userId: string; imported?: number; error?: string }[] = []
  for (const c of conns ?? []) {
    const userId = (c as { user_id: string }).user_id
    try {
      const r = await runSync(admin, userId)
      results.push({ userId, imported: r.imported })
    } catch (err: any) {
      results.push({ userId, error: String(err?.message ?? err).slice(0, 200) })
    }
  }

  return NextResponse.json({ ok: true, synced: results.length, results })
}
