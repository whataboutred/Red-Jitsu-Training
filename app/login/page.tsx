'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()

  // Redirect after sign-in
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') router.push('/dashboard')
    })
    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(1200px_circle_at_50%_0%,rgba(239,68,68,0.15),transparent)]">
      <div className="w-full max-w-md space-y-6">
        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/red-jitsu-logo.png"
            alt="Red Jitsu Training"
            width={160}
            height={160}
            priority
            className="drop-shadow-[0_0_24px_rgba(239,68,68,0.35)]"
          />
          <h1 className="text-xl font-semibold">Red Jitsu Training</h1>
        </div>

        {/* Auth card */}
        <div className="card p-4">
          <Auth
            supabaseClient={supabase}
            providers={[]}
            theme="dark"
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#ef4444',        // red-500
                    brandAccent: '#b91c1c',  // red-700
                    inputText: 'white',
                    inputBackground: 'rgba(0,0,0,0.35)',
                    inputBorder: 'rgba(255,255,255,0.12)',
                    messageText: 'white',
                  },
                  radii: {
                    inputBorderRadius: '12px',
                    buttonBorderRadius: '12px',
                  },
                },
              },
              className: {
                container: 'space-y-3',
                input:
                  'text-white placeholder-white/60 bg-black/40 border-white/20',
                label: 'text-white/80',
                button:
                  'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500/40 text-white',
                anchor: 'text-red-400 hover:text-red-300',
                loader: 'text-white',
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
