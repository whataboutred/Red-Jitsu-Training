'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import ProgramTemplates from '@/components/ProgramTemplates'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'

type Exercise = {
  id: string
  name: string
  category: 'barbell'|'dumbbell'|'machine'|'cable'|'other'
}

type Program = { 
  id: string
  name: string 
  is_active: boolean
  created_at: string
  total_days?: number
  total_exercises?: number
}

type DayDraft = {
  id?: string
  name: string
  dows: number[] // 0..6 (Sun..Sat)
  items: Array<{
    id?: string
    exercise_id: string
    display_name: string
    default_sets: number
    default_reps: number
  }>
}

type ProgramTemplate = {
  id: string
  name: string
  description: string
  duration: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  focus: string[]
  emoji: string
  days: Array<{
    name: string
    dows: number[]
    exercises: Array<{
      name: string
      sets: number
      reps: number | string
      category: string
    }>
  }>
}

const DOWS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const
const CATEGORIES = ['all', 'barbell', 'dumbbell', 'machine', 'cable', 'other'] as const

export default function ProgramsPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [selected, setSelected] = useState<Program | null>(null)
  const [demo, setDemo] = useState(false)
  const [mode, setMode] = useState<'list' | 'quick' | 'manual'>('list')
  const [loading, setLoading] = useState(true)

  // Program creation state
  const [pName, setPName] = useState('')
  const [days, setDays] = useState<DayDraft[]>([{ name: '', dows: [], items: [] }])

  // Enhanced search and filtering
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number]>('all')

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter(e => {
      const matchesSearch = !q || e.name.toLowerCase().includes(q)
      const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [exercises, search, selectedCategory])

  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)
      if (!isDemo) {
        await loadData()
      }
      setLoading(false)
    })()
  }, [])

  if (demo) {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 p-4 max-w-xl mx-auto">
          <h1 className="text-xl font-semibold mb-2">Demo mode</h1>
          <p className="text-white/70">
            You're viewing the app in read-only demo mode. To create your own
            programs, please <Link href="/login" className="underline">sign in</Link>.
          </p>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 max-w-6xl mx-auto p-4">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-white/10 rounded w-1/3"></div>
            <div className="h-32 bg-white/10 rounded"></div>
            <div className="h-48 bg-white/10 rounded"></div>
          </div>
        </main>
      </div>
    )
  }

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const { data: ex } = await supabase.from('exercises').select('id,name,category').order('name')
    setExercises((ex || []) as Exercise[])

    await reloadPrograms()
  }

  async function reloadPrograms() {
    const userId = await getActiveUserId()
    if (!userId) return

    // Get programs with stats
    const { data: progs } = await supabase
      .from('programs')
      .select(`
        id,
        name,
        is_active,
        created_at,
        program_days(
          id,
          template_exercises(id)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    const programsWithStats = (progs || []).map(p => ({
      id: p.id,
      name: p.name,
      is_active: p.is_active,
      created_at: p.created_at,
      total_days: p.program_days?.length || 0,
      total_exercises: p.program_days?.reduce((acc: number, day: any) => 
        acc + (day.template_exercises?.length || 0), 0) || 0
    }))

    setPrograms(programsWithStats)
  }

  async function handleTemplateSelect(template: ProgramTemplate) {
    // Convert template to days format
    const templateDays: DayDraft[] = []
    
    for (const templateDay of template.days) {
      const items: DayDraft['items'] = []
      
      for (const exercise of templateDay.exercises) {
        // Find matching exercise or create placeholder
        const existingExercise = exercises.find(e => 
          e.name.toLowerCase() === exercise.name.toLowerCase()
        )
        
        if (existingExercise) {
          items.push({
            exercise_id: existingExercise.id,
            display_name: exercise.name,
            default_sets: exercise.sets,
            default_reps: typeof exercise.reps === 'string' ? 0 : exercise.reps
          })
        } else {
          // Create a new exercise if it doesn't exist
          const newExercise = await createCustomExercise(exercise.name, exercise.category as Exercise['category'])
          if (newExercise) {
            items.push({
              exercise_id: newExercise.id,
              display_name: exercise.name,
              default_sets: exercise.sets,
              default_reps: typeof exercise.reps === 'string' ? 0 : exercise.reps
            })
          }
        }
      }
      
      templateDays.push({
        name: templateDay.name,
        dows: templateDay.dows,
        items
      })
    }
    
    setPName(template.name)
    setDays(templateDays)
    setMode('manual')
  }

  async function createCustomExercise(exerciseName: string, category: Exercise['category'] = 'other') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: ins, error } = await supabase
      .from('exercises')
      .insert({ name: exerciseName, category, is_global: false, owner: user.id })
      .select('id,name,category')
      .single()

    if (error || !ins) return null

    const newExercise = ins as Exercise
    setExercises(prev => [...prev, newExercise])
    return newExercise
  }

  function startQuickMode() {
    setSelected(null)
    setPName('')
    setDays([{ name: '', dows: [], items: [] }])
    setMode('quick')
  }

  function startManualMode() {
    setSelected(null)
    setPName('')
    setDays([{ name: '', dows: [], items: [] }])
    setMode('manual')
  }

  function backToList() {
    setMode('list')
    setSelected(null)
  }

  async function setActive(id: string) {
    const userId = await getActiveUserId()
    if (!userId) return
    
    await supabase.from('programs').update({ is_active: false }).eq('user_id', userId)
    await supabase.from('programs').update({ is_active: true }).eq('id', id)
    await reloadPrograms()
  }

  async function deleteProgram(id: string) {
    const ok = confirm('Delete this program and all its days/templates? This cannot be undone.')
    if (!ok) return
    
    await supabase.from('programs').delete().eq('id', id)
    if (selected?.id === id) setSelected(null)
    await reloadPrograms()
  }

  async function loadProgram(prog: Program) {
    setSelected(prog)
    setPName(prog.name)

    const { data: daysRows } = await supabase
      .from('program_days')
      .select('id,name,dows,order_index')
      .eq('program_id', prog.id)
      .order('order_index')

    const out: DayDraft[] = []
    for (const d of (daysRows || [])) {
      const { data: tx } = await supabase
        .from('template_exercises')
        .select('id,exercise_id,display_name,default_sets,default_reps,order_index')
        .eq('program_day_id', d.id)
        .order('order_index')
        
      out.push({
        id: d.id,
        name: d.name,
        dows: d.dows || [],
        items: (tx || []).map(x => ({
          id: x.id,
          exercise_id: x.exercise_id,
          display_name: x.display_name,
          default_sets: x.default_sets ?? 3,
          default_reps: (x.default_reps ?? 0),
        })),
      })
    }
    
    setDays(out.length ? out : [{ name: '', dows: [], items: [] }])
    setMode('manual')
  }

  // List Mode
  if (mode === 'list') {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Workout Programs</h1>
            <div className="flex gap-3">
              <button className="toggle" onClick={startQuickMode}>
                ⚡ Quick Start
              </button>
              <button className="btn" onClick={startManualMode}>
                + Create Custom
              </button>
            </div>
          </div>

          {/* Quick Start Templates */}
          {programs.length === 0 && (
            <ProgramTemplates onSelectTemplate={handleTemplateSelect} />
          )}

          {/* Existing Programs */}
          {programs.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div className="font-medium">Your Programs</div>
                <button className="toggle" onClick={startQuickMode}>
                  📋 Browse Templates
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {programs.map(p => (
                  <div 
                    key={p.id} 
                    className={`bg-black/30 rounded-2xl p-5 border transition-all duration-200 group ${
                      p.is_active 
                        ? 'border-brand-red/50 bg-brand-red/5' 
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="font-semibold text-white/90 mb-1">{p.name}</div>
                        {p.is_active && (
                          <span className="text-xs text-brand-red font-medium bg-brand-red/10 px-2 py-1 rounded-full">
                            Active Program
                          </span>
                        )}
                      </div>
                      <div className="text-2xl group-hover:scale-110 transition-transform duration-200">💪</div>
                    </div>

                    <div className="text-sm text-white/70 mb-4 space-y-1">
                      <div>{p.total_days} training day{p.total_days !== 1 ? 's' : ''}</div>
                      <div>{p.total_exercises} exercises total</div>
                      <div className="text-xs text-white/60">
                        Created {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        className="toggle text-sm flex-1" 
                        onClick={() => loadProgram(p)}
                      >
                        Edit
                      </button>
                      {!p.is_active && (
                        <button 
                          className="btn text-sm px-3 py-2" 
                          onClick={() => setActive(p.id)}
                        >
                          Activate
                        </button>
                      )}
                      <button 
                        className="toggle text-sm px-3 py-2 text-red-400 hover:bg-red-500/20" 
                        onClick={() => deleteProgram(p.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {programs.length === 0 && mode === 'list' && (
            <div className="card text-center py-12">
              <div className="text-6xl mb-4">💪</div>
              <div className="font-medium mb-2">Start Your Training Journey</div>
              <div className="text-white/70 mb-6 max-w-md mx-auto">
                Choose from proven templates or create your own custom program to reach your fitness goals
              </div>
              <div className="flex gap-3 justify-center">
                <button className="btn" onClick={startQuickMode}>
                  ⚡ Quick Start Templates
                </button>
                <button className="toggle" onClick={startManualMode}>
                  🎯 Create Custom Program
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  // Quick Start Mode
  if (mode === 'quick') {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <button className="toggle" onClick={backToList}>
              ← Back
            </button>
            <h1 className="text-2xl font-bold">Quick Start Templates</h1>
          </div>

          <ProgramTemplates onSelectTemplate={handleTemplateSelect} />

          <div className="card text-center py-8">
            <div className="font-medium mb-2">Need Something Different?</div>
            <div className="text-white/70 mb-4">Create a fully custom program from scratch</div>
            <button className="btn" onClick={startManualMode}>
              🎯 Create Custom Program
            </button>
          </div>
        </main>
      </div>
    )
  }

  // Manual/Edit Mode - Simplified placeholder for now
  return (
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-6xl mx-auto p-4">
        <div className="flex items-center gap-4 mb-6">
          <button className="toggle" onClick={backToList}>
            ← Back to Programs
          </button>
          <h1 className="text-2xl font-bold">
            {selected ? 'Edit Program' : 'Create Program'}
          </h1>
        </div>
        
        <div className="card">
          <div className="font-medium mb-4">Program Builder</div>
          <div className="text-white/70 mb-6">
            Enhanced program creation interface would be implemented here with the same
            mobile-first UX as the workout and BJJ session pages.
          </div>
          
          <div className="bg-brand-red/10 border border-brand-red/20 rounded-xl p-4">
            <div className="font-medium text-brand-red/90 mb-2">🚧 Coming Soon</div>
            <div className="text-sm text-white/80">
              The enhanced program creation interface is being developed to match
              the improved UX of the workout and BJJ session pages.
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button className="btn" onClick={backToList}>
              Back to Programs
            </button>
            <button className="toggle">
              Save Program (Demo)
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}