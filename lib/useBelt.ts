'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'

// The signed-in user's BJJ belt (null until loaded / signed out). Drives
// belt-accent theming outside the jiu-jitsu pages, e.g. navigation.
export function useBelt(): string | null {
  const [belt, setBelt] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const userId = await getActiveUserId()
      if (!userId) return
      const { data } = await supabase
        .from('profiles')
        .select('bjj_belt')
        .eq('id', userId)
        .maybeSingle()
      if (mounted && data?.bjj_belt) setBelt(data.bjj_belt)
    })()
    return () => {
      mounted = false
    }
  }, [])

  return belt
}
