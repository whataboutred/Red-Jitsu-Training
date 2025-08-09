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
import { DEMO } from '@/lib/activeUser'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function MobileMenu({
  onClose,
  signOut,
}: {
  onClose: () => void
  signOut: () => Promise<void>
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[100000]">
      {/* Solid, opaque background that fully covers the app */}
      <div className="absolute inset-0 bg-black" onClick={onClose} aria-hidden="true" />
      {/* Content layer */}
      <div className="absolute inset-0 text-white flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 pb-3 border-b border-white/10"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}
        >
          <span className="font-semibold">Menu</span>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="text-white/60 text-xs">Quick add</div>
          <Link href="/workouts/new" onClick={onClose} className="block rounded-xl bg-red-600 hover:bg-red-700 px-4 py-3 text-center font-medium">
            Workout
          </Link>
          <Link href="/jiu-jitsu" onClick={onClose} className="block rounded-xl border border-white/10 px-4 py-3 text-center">
            Jiu Jitsu
          </Link>

          <div className="text-white/60 text-xs pt-3">Navigation</div>
          <Link href="/history" onClick={onClose} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3">
            <History className="w-4 h-4" /> History
          </Link>
          <Link href="/programs" onClick={onClose} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3">
            <ListChecks className="w-4 h-4" /> Programs
          </Link>
          <Link href="/settings" onClick={onClose} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3">
            <Settings className="w-4 h-4" /> Settings
          </Link>

          <button
            onClick={async () => { onClose(); await signOut() }}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Nav() {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const addRef = useRef<HTMLDivElement | null>(null)

  // Register SW + auto-update + auto-reload when new code is active
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NEXT_PUBLIC_SW !== 'off') {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // Check now and every 5 minutes
        reg.update()
        const id = setInterval(() => reg.update(), 5 * 60 * 1000)

        // Reload as soon as the new worker activates
        navigator.serviceWorker.addEventListener('message', (e) => {
          if (e.data?.type === 'SW_UPDATED') {
            window.location.reload()
          }
        })
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload()
        })

        return () => clearInterval(id)
      }).catch(() => {})
    }
  }, [])

  // Close desktop dropdown on outside click / Esc
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
    if (!DEMO) {
      router.push('/login')
    }
  }

  return (
    <nav className="sticky top-0 z-50 bg-black/40 backdrop-blur border-b border-white/10">
      <div className="max-w-4xl mx-auto flex items-center justify-between p-3">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/red-jitsu-logo.png?v=15"
            alt="Red Jitsu Training"
            width={28}
            height={28}
            className="rounded-full"
            priority
          />
          <span className="font-semibold">Red Jitsu Training</span>
          {DEMO && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70">
              demo
            </span>
          )}
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
                <Link href="/workouts/new" onClick={() => setAddOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/5">
                  <Dumbbell className="w-4 h-4" />
                  Strength workout
                </Link>
                <Link href="/jiu-jitsu" onClick={() => setAddOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/5">
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

      {/* Mobile menu (portal) */}
      {mobileOpen && (
        <MobileMenu onClose={() => setMobileOpen(false)} signOut={signOut} />
      )}
    </nav>
  )
}
