'use client'

import Link from 'next/link'
import {
  Dumbbell,
  History,
  PlusCircle,
  LogOut,
  Settings,
  ListChecks,
  Activity,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function Nav() {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  }, [])

  // Close the Add Session menu when clicking outside / pressing ESC
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!addRef.current) return
      if (!addRef.current.contains(e.target as Node)) setAddOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAddOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <nav className="sticky top-0 z-50 bg-black/40 backdrop-blur border-b border-white/10">
      <div className="max-w-4xl mx-auto flex items-center justify-between p-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Dumbbell className="w-5 h-5" />
          <span className="font-semibold">Red Jitsu Training</span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Add session dropdown */}
          <div className="relative" ref={addRef}>
            <button
              type="button"
              className="toggle"
              onClick={() => setAddOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={addOpen}
            >
              <PlusCircle className="w-4 h-4" />
              Add session
            </button>

            {addOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-white/10 bg-black/90 shadow-xl p-2 z-50"
              >
                <Link
                  href="/workouts/new"
                  className="toggle w-full justify-start"
                  role="menuitem"
                  onClick={() => setAddOpen(false)}
                >
                  <Dumbbell className="w-4 h-4" />
                  Strength workout
                </Link>
                <Link
                  href="/jiu-jitsu"
                  className="toggle w-full justify-start mt-2"
                  role="menuitem"
                  onClick={() => setAddOpen(false)}
                >
                  <Activity className="w-4 h-4" />
                  Jiu Jitsu session
                </Link>
              </div>
            )}
          </div>

          <Link href="/history" className="toggle">
            <History className="w-4 h-4" /> History
          </Link>
          <Link href="/programs" className="toggle">
            <ListChecks className="w-4 h-4" /> Programs
          </Link>
          <Link href="/jiu-jitsu" className="toggle">
            <Activity className="w-4 h-4" /> Jiu Jitsu
          </Link>
          <Link href="/settings" className="toggle">
            <Settings className="w-4 h-4" /> Settings
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="toggle"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  )
}
