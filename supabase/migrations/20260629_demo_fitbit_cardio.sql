-- Wrapper: reseed the demo, then tag a few cardio sessions as Fitbit-imported
-- so the public demo showcases the Fitbit connector. reseed_demo() is untouched.
-- The weekly pg_cron job 'reseed-demo-weekly' is repointed to this wrapper:
--   select cron.schedule('reseed-demo-weekly', '0 6 * * 1', 'select public.reseed_demo_full();');
create or replace function public.reseed_demo_full()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare d uuid := '581543c1-a23a-4f95-a7ed-c98fb285ece7';
begin
  perform public.reseed_demo();

  update cardio_sessions set source='fitbit', external_id='demo-fb-1',
    notes='Imported from Fitbit · avg HR 138 · 6m vigorous / 19m moderate'
    where user_id=d and activity='Running' and notes='Easy zone-2 around the park.';

  update cardio_sessions set source='fitbit', external_id='demo-fb-2',
    notes='Imported from Fitbit · avg HR 146 · 18m vigorous / 20m moderate'
    where user_id=d and activity='Cycling' and notes='Intervals on the trainer.';

  update cardio_sessions set source='fitbit', external_id='demo-fb-3',
    notes='Imported from Fitbit · avg HR 159 · 17m vigorous / 4m moderate'
    where user_id=d and activity='Rowing' and notes='4x500m, hard.';
end
$$;
