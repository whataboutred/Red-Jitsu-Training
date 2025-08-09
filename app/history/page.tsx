'use client'

import Nav from '@/components/Nav'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSearchParams } from 'next/navigation'

type Workout = { id:string; performed_at:string; title:string|null }
type BJJ = { id:string; performed_at:string; duration_min:number; kind:'class'|'drilling'|'open_mat'; intensity:string|null; notes:string|null }

export default function HistoryPage(){
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [bjj, setBjj] = useState<BJJ[]>([])
  const params = useSearchParams()
  const highlightId = params.get('highlight')

  useEffect(()=>{(async()=>{
    const { data:{ user } } = await supabase.auth.getUser()
    if(!user){ window.location.href='/login'; return }

    const { data: w } = await supabase
      .from('workouts')
      .select('id,performed_at,title')
      .order('performed_at',{ascending:false})
      .limit(500)
    setWorkouts((w||[]) as Workout[])

    const { data: bj } = await supabase
      .from('bjj_sessions')
      .select('id,performed_at,duration_min,kind,intensity,notes')
      .order('performed_at',{ascending:false})
      .limit(500)
    setBjj((bj||[]) as BJJ[])

    setLoading(false)
  })()},[])

  const byDateWorkout = workouts
  const byDateBJJ = bjj

  if (loading) return (<div><Nav/><main className="max-w-4xl mx-auto p-4">Loading…</main></div>)

  return (
    <div>
      <Nav/>
      <main className="max-w-4xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl">History</h1>

        {/* Strength Training */}
        <div className="card">
          <div className="font-medium mb-2">Strength Training</div>
          <div className="grid gap-2">
            {byDateWorkout.map(w=>(
              <div
                key={w.id}
                className={`flex items-start justify-between rounded-xl p-3 ${highlightId===w.id ? 'border border-brand-red bg-brand-red/10' : 'bg-black/30'}`}
              >
                <div>
                  <div className="text-white/90">{new Date(w.performed_at).toLocaleString()}</div>
                  <div className="text-white/70 text-sm">{w.title ?? 'Untitled'}</div>
                </div>
                <Link href={`/history?highlight=${w.id}`} className="toggle self-center">Open</Link>
              </div>
            ))}
            {!byDateWorkout.length && <div className="text-white/60">No workouts yet.</div>}
          </div>
        </div>

        {/* Jiu Jitsu */}
        <div className="card">
          <div className="font-medium mb-2">Jiu Jitsu</div>
          <div className="grid gap-2">
            {byDateBJJ.map(s=>(
              <div key={s.id} className="flex items-start justify-between bg-black/30 rounded-xl p-3">
                <div>
                  <div className="text-white/90">{new Date(s.performed_at).toLocaleString()}</div>
                  <div className="text-white/80">{s.kind.replace('_',' ')} • {s.duration_min} min {s.intensity ? `• ${s.intensity}` : ''}</div>
                  {s.notes && <div className="text-white/70 text-sm mt-1 line-clamp-2">{s.notes}</div>}
                </div>
              </div>
            ))}
            {!byDateBJJ.length && <div className="text-white/60">No Jiu Jitsu sessions yet.</div>}
          </div>
        </div>
      </main>
    </div>
  )
}
