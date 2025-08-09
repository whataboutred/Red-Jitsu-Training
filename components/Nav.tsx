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
  const [addOpen, setAddOpen] = useState(false)      // desktop add-session
  const [mobileOpen, setMobileOpen] = useState(false) // mobile slide-over
  const addRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  // close desktop dropdown on outside click/escape
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
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/red-jitsu-logo.png?v=3"
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
          <button onClick={signOut} className="toggle" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden toggle px-3 py-2"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile slide-over menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          {/* backdrop */}
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          {/* panel */}
          <div className="absolute right-0 top-0 h-full w-72 bg-neutral-950 border-l border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">Menu</span>
              <button className="toggle" onClick={() => setMobileOpen(false)} aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-2">
              <div className="text-white/60 text-xs mb-1">Quick add</div>
              <Link href="/workouts/new" onClick={() => setMobileOpen(false)} className="btn w-full">
                Workout
              </Link>
              <Link href="/jiu-jitsu" onClick={() => setMobileOpen(false)} className="toggle w-full">
                Jiu Jitsu
              </Link>

              <div className="text-white/60 text-xs mt-4 mb-1">Navigation</div>
              <Link href="/history" onClick={() => setMobileOpen(false)} className="toggle w-full">
                <History className="w-4 h-4" /> History
              </Link>
              <Link href="/programs" onClick={() => setMobileOpen(false)} className="toggle w-full">
                <ListChecks className="w-4 h-4" /> Programs
              </Link>
              <Link href="/settings" onClick={() => setMobileOpen(false)} className="toggle w-full">
                <Settings className="w-4 h-4" /> Settings
              </Link>

              <button onClick={async () => { setMobileOpen(false); await signOut(); }} className="toggle w-full mt-4">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
