-- Fitbit connector: cardio source tagging + per-user OAuth connection store.

-- cardio_sessions: tag the source + external id for idempotent imports
alter table public.cardio_sessions
  add column if not exists source text not null default 'manual',
  add column if not exists external_id text;

create unique index if not exists cardio_sessions_user_external_ux
  on public.cardio_sessions(user_id, external_id)
  where external_id is not null;

-- Per-user Fitbit OAuth connection. Tokens are stored as app-encrypted
-- ciphertext (AES-GCM, key only in server env), so a DB dump alone cannot use
-- them. User-session routes read/write their own row under RLS; the daily cron
-- (no user session) uses the service role.
create table if not exists public.fitbit_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fitbit_user_id text,
  access_token_enc text,
  refresh_token_enc text,
  expires_at timestamptz,
  scopes text,
  allowed_activities text[] not null default '{}',
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fitbit_connections enable row level security;

drop policy if exists fitbit_select_own on public.fitbit_connections;
create policy fitbit_select_own on public.fitbit_connections
  for select using ((select auth.uid()) = user_id);

drop policy if exists fitbit_insert_own on public.fitbit_connections;
create policy fitbit_insert_own on public.fitbit_connections
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists fitbit_update_own on public.fitbit_connections;
create policy fitbit_update_own on public.fitbit_connections
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists fitbit_delete_own on public.fitbit_connections;
create policy fitbit_delete_own on public.fitbit_connections
  for delete using ((select auth.uid()) = user_id);

-- Demo row is status-only (tokens null); lets the demo show a "connected" state.
drop policy if exists fitbit_demo_read on public.fitbit_connections;
create policy fitbit_demo_read on public.fitbit_connections
  for select using (user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid);
