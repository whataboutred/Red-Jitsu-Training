'use client'

import Nav from '@/components/Nav'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'

type Exercise = {
  id: string
  name: string
  category: 'barbell'|'dumbbell'|'machine'|'cable'|'other'
}
type Program = { id: string; name: string; is_active: boolean }

type DayDraft = {
  id?: string
  name: string
  dows: number[] // 0..6 (Sun..Sat)
  items: Array<{
    id?: string
    exercise_id: string
    display_name: string
    default_sets: number
    /** 0 = reps unspecified (optional) */
    default_reps: number
  }>
}

const DOWS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const

export default function ProgramsPage(){
  const [exercises,setExercises]=useState<Exercise[]>([])
  const [programs,setPrograms]=useState<Program[]>([])
  const [selected,setSelected]=useState<Program|null>(null)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)
      if (isDemo) return
    })()
  }, [])

  if (demo) {
    return (
      <div>
        <Nav />
        <main className="p-4 max-w-xl mx-auto">
          <h1 className="text-xl font-semibold mb-2">Demo mode</h1>
          <p className="text-white/70">
            You're viewing the app in read-only demo mode. To log your own
            sessions, please <Link href="/login" className="underline">sign in</Link>.
          </p>
        </main>
      </div>
    )
  }

  // Blank draft (one empty day)
  const [pName,setPName]=useState('')
  const [days,setDays]=useState<DayDraft[]>([{ name:'', dows:[], items:[] }])

  // Shared search + filtered list
  const [search,setSearch]=useState('')
  const filteredExercises=useMemo(()=>{
    const q=search.trim().toLowerCase()
    return exercises.filter(e=>!q || e.name.toLowerCase().includes(q))
  },[exercises,search])

  useEffect(()=>{(async()=>{
    const { data:{ user } } = await supabase.auth.getUser()
    if(!user){ window.location.href='/login'; return }

    const { data: ex } = await supabase.from('exercises').select('id,name,category').order('name')
    setExercises((ex||[]) as Exercise[])

    await reloadPrograms()
  })()},[])

  async function reloadPrograms(){
    const { data: progs } = await supabase
      .from('programs')
      .select('id,name,is_active')
      .order('created_at',{ascending:false})
    setPrograms((progs||[]) as Program[])
  }

  async function loadProgram(prog: Program){
    setSelected(prog)
    setPName(prog.name)

    const { data: daysRows } = await supabase
      .from('program_days')
      .select('id,name,dows,order_index')
      .eq('program_id', prog.id)
      .order('order_index')

    const out: DayDraft[] = []
    for (const d of (daysRows||[])) {
      const { data: tx } = await supabase
        .from('template_exercises')
        .select('id,exercise_id,display_name,default_sets,default_reps,order_index')
        .eq('program_day_id', d.id)
        .order('order_index')
      out.push({
        id: d.id,
        name: d.name,
        dows: d.dows || [],
        items: (tx||[]).map(x=>({
          id:x.id,
          exercise_id:x.exercise_id,
          display_name:x.display_name,
          default_sets: x.default_sets ?? 3,
          default_reps: (x.default_reps ?? 0),
        })),
      })
    }
    setDays(out.length ? out : [{ name:'', dows:[], items:[] }])
  }

  function newProgram(){
    setSelected(null)
    setPName('')
    setDays([{ name:'', dows:[], items:[] }])
  }

  function addDay(){ setDays(p=>[...p,{ name:'', dows:[], items:[] }]) }
  function removeDay(i:number){ setDays(p=>p.filter((_,idx)=>idx!==i)) }

  function addItem(di:number, ex: Exercise){
    setDays(p=>p.map((d,idx)=>idx===di
      ? {...d, items:[...d.items, { exercise_id: ex.id, display_name: ex.name, default_sets: 3, default_reps: 0 }]}
      : d))
  }
  function removeItem(di:number, ii:number){
    setDays(p=>p.map((d,idx)=>idx===di?{...d, items:d.items.filter((_,j)=>j!==ii)}:d))
  }

  // NEW: reorder item up/down
  function moveItem(di:number, ii:number, dir:-1|1){
    setDays(p=>p.map((d,i)=>{
      if(i!==di) return d
      const items = [...d.items]
      const to = ii + dir
      if(to < 0 || to >= items.length) return d
      const [row] = items.splice(ii,1)
      items.splice(to, 0, row)
      return {...d, items}
    }))
  }

  // NEW: create a custom exercise from the current search text
  async function addCustomExercise(di:number){
    const name = search.trim()
    if(!name){ alert('Type a name first.'); return }
    const { data:{ user } } = await supabase.auth.getUser()
    if(!user){ window.location.href='/login'; return }

    const { data: ins, error } = await supabase
      .from('exercises')
      .insert({ name, category:'other', is_global:false, owner:user.id })
      .select('id,name,category')
      .single()
    if(error || !ins){ alert('Could not create exercise.'); return }

    setExercises(prev => [...prev, ins as Exercise])
    addItem(di, ins as Exercise)
    setSearch('')
  }

  async function setActive(id:string){
    const { data:{ user } } = await supabase.auth.getUser(); if(!user) return
    await supabase.from('programs').update({ is_active:false }).eq('user_id', user.id)
    await supabase.from('programs').update({ is_active:true }).eq('id', id)
    await reloadPrograms()
  }

  async function deleteProgram(id:string){
    const ok = confirm('Delete this program and all its days/templates? This cannot be undone.')
    if (!ok) return
    await supabase.from('programs').delete().eq('id', id)
    if (selected?.id === id) newProgram()
    await reloadPrograms()
  }

  async function saveProgram(){
    const { data:{ user } } = await supabase.auth.getUser(); if(!user) return
    if (days.length === 0) setDays([{ name:'', dows:[], items:[] }])

    if(selected){
      await supabase.from('programs').update({ name:pName }).eq('id', selected.id)

      const { data: pd } = await supabase.from('program_days').select('id').eq('program_id', selected.id)
      const oldDayIds = (pd||[]).map(r=>r.id)
      if(oldDayIds.length){ await supabase.from('template_exercises').delete().in('program_day_id', oldDayIds) }
      await supabase.from('program_days').delete().eq('program_id', selected.id)

      for(let i=0;i<days.length;i++){
        const d=days[i]
        const { data: insDay } = await supabase.from('program_days').insert({
          program_id: selected.id, name:d.name || 'Day', dows:d.dows, order_index:i
        }).select('id').single()
        if(!insDay) continue
        for(let j=0;j<d.items.length;j++){
          const it=d.items[j]
          await supabase.from('template_exercises').insert({
            program_day_id: insDay.id,
            exercise_id: it.exercise_id,
            display_name: it.display_name,
            default_sets: Math.max(1, it.default_sets || 1),
            default_reps: Math.max(0, it.default_reps || 0),
            set_type: 'working',
            order_index: j
          })
        }
      }
    } else {
      const userId = await getActiveUserId()
      if (!userId) return
      
      const { data: prog } = await supabase.from('programs').insert({
        user_id: userId, name: pName || 'Program', is_active: programs.length===0
      }).select('id').single()
      if(!prog) return

      for(let i=0;i<days.length;i++){
        const d=days[i]
        const { data: insDay } = await supabase.from('program_days').insert({
          program_id: prog.id, name:d.name || 'Day', dows:d.dows, order_index:i
        }).select('id').single()
        if(!insDay) continue
        for(let j=0;j<d.items.length;j++){
          const it=d.items[j]
          await supabase.from('template_exercises').insert({
            program_day_id: insDay.id,
            exercise_id: it.exercise_id,
            display_name: it.display_name,
            default_sets: Math.max(1, it.default_sets || 1),
            default_reps: Math.max(0, it.default_reps || 0),
            set_type: 'working',
            order_index: j
          })
        }
      }
      await reloadPrograms()
    }

    alert('Saved program')
  }

  function toggleDow(di:number, dow:number){
    setDays(p=>p.map((d,i)=>{
      if(i!==di) return d
      const has = d.dows.includes(dow)
      return {...d, dows: has ? d.dows.filter(n=>n!==dow) : [...d.dows, dow]}
    }))
  }

  return (
    <div>
      <Nav/>
      <main className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Workout Programs</h1>
          <button className="btn" onClick={newProgram}>+ New Program</button>
        </div>

        <div className="card">
          <div className="font-medium mb-3">Your Workout Programs</div>
          <div className="grid gap-2">
            {programs.map(p=>(
              <div key={p.id} className="flex items-center justify-between">
                <div>{p.name} {p.is_active && <span className="text-xs text-brand-red">(Active)</span>}</div>
                <div className="flex items-center gap-2">
                  {!p.is_active && <button className="toggle" onClick={()=>setActive(p.id)}>Set Active</button>}
                  <button className="toggle" onClick={()=>loadProgram(p)}>Edit</button>
                  <button className="toggle" onClick={()=>deleteProgram(p.id)}>Delete</button>
                </div>
              </div>
            ))}
            {!programs.length && <div className="text-white/60">No workout programs yet. Create one above.</div>}
          </div>
        </div>

        <div className="card space-y-4">
          <div className="font-medium">Editor</div>

          <label className="block">
            <div className="mb-1 text-sm text-white/80">Program name</div>
            <input className="input w-full" value={pName} onChange={e=>setPName(e.target.value)} placeholder="e.g., Upper/Lower 4-Day"/>
          </label>

          <div className="text-xs text-white/60">
            Tip: Removing a day or changing items only takes effect after you click <span className="text-white/80 font-medium">Save Program</span>.
          </div>

          <div className="space-y-4">
            {days.map((d,di)=>(
              <div key={di} className="bg-black/30 rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="w-full">
                    <div className="mb-1 text-sm text-white/80">Day name</div>
                    <input className="input w-64" value={d.name}
                      onChange={e=>setDays(p=>p.map((x,i)=>i===di?{...x,name:e.target.value}:x))}
                      placeholder="e.g., Upper A" />
                  </label>
                  <button className="toggle" onClick={()=>removeDay(di)}>Remove Day</button>
                </div>

                <div>
                  <div className="mb-1 text-sm text-white/80">Days of week</div>
                  <div className="flex flex-wrap gap-2">
                    {DOWS.map((label,idx)=>(
                      <button
                        key={idx}
                        type="button"
                        onClick={()=>toggleDow(di, idx)}
                        className={`toggle ${d.dows.includes(idx) ? '!bg-red-600 !text-white !border-red-600' : ''}`}
                        aria-pressed={d.dows.includes(idx)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add exercises */}
                <div className="space-y-2">
                  <div className="mb-1 text-sm text-white/80">Add exercises</div>
                  <div className="flex items-center gap-2">
                    <input className="input w-full" placeholder="Search exercises…" value={search} onChange={e=>setSearch(e.target.value)}/>
                    <div className="text-white/60 text-sm">Click to add →</div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2">
                    <div className="max-h-48 overflow-auto border border-white/10 rounded-xl p-2">
                      {filteredExercises.slice(0,200).map(ex=>(
                        <button key={ex.id} className="toggle w-full mb-2 text-left" onClick={()=>addItem(di,ex)}>
                          {ex.name} {ex.category!=='other'?`• ${ex.category}`:''}
                        </button>
                      ))}
                      {search.trim() && (
                        <button className="toggle w-full mt-2" onClick={()=>addCustomExercise(di)}>
                          + Add custom: “{search.trim()}”
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Header labels (note new Actions column) */}
                      <div className="grid grid-cols-12 gap-2 px-1 text-sm font-medium text-white/70">
                        <div className="col-span-5">Exercise</div>
                        <div className="col-span-2">Sets</div>
                        <div className="col-span-3">Reps (optional)</div>
                        <div className="col-span-2">Actions</div>
                      </div>

                      {d.items.map((it,ii)=>(
                        <div key={ii} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5 text-sm">{it.display_name}</div>

                          {/* Sets (required) */}
                          <input
                            className="input col-span-2 text-center"
                            type="number"
                            min={1}
                            value={it.default_sets}
                            onChange={e=>setDays(p=>p.map((x,i)=>i===di?{
                              ...x, items:x.items.map((y,j)=>j===ii?{...y,default_sets: Math.max(1, Number(e.target.value||1)) }:y)
                            }:x))}
                            placeholder="sets"
                          />

                          {/* Reps (optional) */}
                          <input
                            className="input col-span-3 text-center"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={it.default_reps === 0 ? '' : String(it.default_reps)}
                            onChange={e=>{
                              const v = e.target.value.replace(/\D/g,'')
                              const n = v === '' ? 0 : Number(v)
                              setDays(p=>p.map((x,i)=>i===di?{
                                ...x, items:x.items.map((y,j)=>j===ii?{...y,default_reps: n }:y)
                              }:x))
                            }}
                            placeholder="optional"
                          />

                          {/* Actions: up / down / delete */}
                          <div className="col-span-2 flex items-center gap-2">
                            <button className="toggle" title="Move up" onClick={()=>moveItem(di, ii, -1)}>↑</button>
                            <button className="toggle" title="Move down" onClick={()=>moveItem(di, ii, 1)}>↓</button>
                            <button className="toggle" title="Remove" onClick={()=>removeItem(di,ii)}>✕</button>
                          </div>
                        </div>
                      ))}

                      {!d.items.length && <div className="text-white/60 text-sm">No exercises yet — add from the list on the left.</div>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button className="toggle" onClick={addDay}>+ Add Day</button>
          </div>

          <div className="flex gap-2">
            <button className="btn" onClick={saveProgram}>Save Program</button>
            {selected && !selected.is_active && <button className="toggle" onClick={()=>setActive(selected.id!)}>Set Active</button>}
          </div>
        </div>
      </main>
    </div>
  )
}
