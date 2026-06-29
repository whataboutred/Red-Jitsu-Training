-- Public read-only demo policies.
--
-- These existed only in the live database and were not versioned, which means a
-- schema rebuild would silently drop them and break the demo. They are the
-- linchpin of the demo threat model: each is SELECT-only and scoped to the
-- single demo user, so the public/anonymous demo can read the seeded account
-- but can never write (all write policies require auth.uid() = user_id, which
-- is null for anonymous visitors).
--
-- Demo user id is public by design (also shipped as NEXT_PUBLIC_DEMO_USER_ID).

-- Idempotent: drop-then-create so this can be re-applied safely.
drop policy if exists workouts_demo_read on public.workouts;
create policy workouts_demo_read on public.workouts
  for select using (user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid);

drop policy if exists bjj_demo_read on public.bjj_sessions;
create policy bjj_demo_read on public.bjj_sessions
  for select using (user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid);

drop policy if exists cardio_demo_read on public.cardio_sessions;
create policy cardio_demo_read on public.cardio_sessions
  for select using (user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid);

drop policy if exists pr_demo_read on public.personal_records;
create policy pr_demo_read on public.personal_records
  for select using (user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid);

drop policy if exists ai_demo_read on public.ai_insights;
create policy ai_demo_read on public.ai_insights
  for select using (user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid);

drop policy if exists profiles_demo_read on public.profiles;
create policy profiles_demo_read on public.profiles
  for select using (id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid);

drop policy if exists programs_demo_read on public.programs;
create policy programs_demo_read on public.programs
  for select using (user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid);

drop policy if exists pdays_demo_read on public.program_days;
create policy pdays_demo_read on public.program_days
  for select using (exists (
    select 1 from public.programs p
    where p.id = program_days.program_id
      and p.user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid
  ));

drop policy if exists tex_demo_read on public.template_exercises;
create policy tex_demo_read on public.template_exercises
  for select using (exists (
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = template_exercises.program_day_id
      and p.user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid
  ));

drop policy if exists wex_demo_read on public.workout_exercises;
create policy wex_demo_read on public.workout_exercises
  for select using (exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid
  ));

drop policy if exists sets_demo_read on public.sets;
create policy sets_demo_read on public.sets
  for select using (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = sets.workout_exercise_id
      and w.user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid
  ));
