-- Track when the connection was authorized (Google testing-mode refresh tokens
-- expire ~7 days after issuance) and a flag set when a sync hits an auth failure.
alter table public.fitbit_connections
  add column if not exists connected_at timestamptz,
  add column if not exists needs_reconnect boolean not null default false;

-- Seed a baseline for any existing connection so the age-based warning works.
update public.fitbit_connections
  set connected_at = coalesce(connected_at, now())
  where access_token_enc is not null;
