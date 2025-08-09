'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  Dumbbell,
  History,
  PlusCircle,
  LogOut,
  Settings,
  ListChecks,
  Activity,
  Menu,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function Nav() {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)        // desktop add-session
  const [mobileOpen, setMobileOpen] = useState(false)  // mobile drawer
  const addRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!addRef.current) return
      if (!addRef.current.contains(e.target as Node)) setAddOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAddOpen(false)
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 bg-black/40 backdrop-blur border-b border-white/10">
      <div className="max-w-4xl mx-auto flex items-center justify-between p-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/red-jitsu-logo.png?v=11"
            alt="Red Jitsu Training"
            width={28}
            height={28}
            className="rounded-full"
            priority
          />
          <span className="font-semibold">Red Jitsu Training</span>
        </Link>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <div className="relative" ref={addRef}>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
              onClick={() => setAddOpen(v => !v)}
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
                  onClick={() => setAddOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/5"
                  role="menuitem"
                >
                  <Dumbbell className="w-4 h-4" />
                  Strength workout
                </Link>
                <Link
                  href="/jiu-jitsu"
                  onClick={() => setAddOpen(false)}
                  className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/5"
                  role="menuitem"
                >
                  <Activity className="w-4 h-4" />
                  Jiu Jitsu session
                </Link>
              </div>
            )}
          </div>

          <Link href="/history" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5">
            <History className="w-4 h-4" /> History
          </Link>
          <Link href="/programs" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5">
            <ListChecks className="w-4 h-4" /> Programs
          </Link>
          <Link href="/jiu-jitsu" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5">
            <Activity className="w-4 h-4" /> Jiu Jitsu
          </Link>
          <Link href="/settings" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5">
            <Settings className="w-4 h-4" /> Settings
          </Link>
          <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile slide-over (opaque, simple classes) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[999]">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/75"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* panel */}
          <aside className="absolute right-0 top-0 bottom-0 w-[86%] max-w-[22rem] bg-black text-white shadow-2xl border-l border-white/10 flex flex-col">
            {/* header */}
            <div
              className="flex items-center justify-between px-4 pb-3 border-b border-white/10"
              style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}
            >
              <span className="font-semibold">Menu</span>
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80"
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* body */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="text-white/60 text-xs">Quick add</div>
              <Link href="/workouts/new" onClick={() => setMobileOpen(false)}
                    className="block rounded-xl bg-red-600 hover:bg-red-700 px-4 py-3 text-center font-medium">
                Workout
              </Link>
              <Link href="/jiu-jitsu" onClick={() => setMobileOpen(false)}
                    className="block rounded-xl border border-white/10 px-4 py-3 text-center">
                Jiu Jitsu
              </Link>

              <div className="text-white/60 text-xs pt-4">Navigation</div>
              <Link href="/history" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3">
                <History className="w-4 h-4" /> History
              </Link>
              <Link href="/programs" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3">
                <ListChecks className="w-4 h-4" /> Programs
              </Link>
              <Link href="/settings" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3">
                <Settings className="w-4 h-4" /> Settings
              </Link>

              <button onClick={async () => { setMobileOpen(false); await signOut(); }}
                      className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </nav>
          </aside>
        </div>
      )}
    </nav>
  )
}
