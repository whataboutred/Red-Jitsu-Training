-- A partial unique index can't serve as an ON CONFLICT arbiter for the client's
-- upsert. Replace it with a plain unique index on (user_id, external_id). NULLs
-- are distinct in Postgres, so manual sessions (external_id IS NULL) are
-- unconstrained as before.
drop index if exists public.cardio_sessions_user_external_ux;
create unique index if not exists cardio_sessions_user_external_uk
  on public.cardio_sessions(user_id, external_id);
