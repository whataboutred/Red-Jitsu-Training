import { supabase } from '@/lib/supabaseClient'

export async function sendPasswordReset(email: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const redirectTo = `${base}/reset-password`
  return supabase.auth.resetPasswordForEmail(email, { redirectTo })
}
