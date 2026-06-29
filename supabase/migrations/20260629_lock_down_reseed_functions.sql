-- The demo reseed is expensive (bulk delete + reinsert). It must only run from
-- the pg_cron job (which executes as its owner), never via the public REST API.
-- Revoke EXECUTE from the API roles to close a demo-thrash/DoS vector.
revoke execute on function public.reseed_demo() from public, anon, authenticated;
revoke execute on function public.reseed_demo_full() from public, anon, authenticated;
