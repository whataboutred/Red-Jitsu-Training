# IronLog — Workout Tracker (Next.js + Supabase)
Mobile-first, black/red theme. Log sets fast (weight, reps, warm-up/working). Trends: estimated 1RM & volume by day-of-week. Offline-ready (PWA).

## Setup
1) Create Supabase project → run `supabase/schema.sql` in SQL Editor.
2) Copy `.env.local.example` → `.env.local` and paste your project URL & anon key.
3) `npm install` → `npm run dev` → http://localhost:3000
4) Sign in with your email (magic link).

## Deploy
Import into Vercel, add the same env vars, deploy, then "Add to Home Screen" on your phone.
