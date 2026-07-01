-- Atomic workout save.
-- One RPC creates or fully replaces a workout with its exercises and sets in a
-- single transaction, so a mid-save network drop can no longer orphan a workout
-- header or destroy existing sets (the old edit path deleted sets before
-- inserting replacements). client_id makes offline/retry saves idempotent:
-- replaying the same payload returns the already-created workout instead of
-- inserting a duplicate.

alter table public.workouts add column if not exists client_id uuid;
create unique index if not exists workouts_user_client_uidx
  on public.workouts(user_id, client_id) where client_id is not null;

create or replace function public.save_workout(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_workout_id uuid := nullif(p_payload->>'workout_id', '')::uuid;
  v_client_id uuid := nullif(p_payload->>'client_id', '')::uuid;
  v_performed_at timestamptz := coalesce(nullif(p_payload->>'performed_at', '')::timestamptz, now());
  v_exercises jsonb := coalesce(p_payload->'exercises', '[]'::jsonb);
  v_ex jsonb;
  v_set jsonb;
  v_wex_id uuid;
  v_ex_idx int := 0;
  v_set_idx int;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_typeof(v_exercises) <> 'array' or jsonb_array_length(v_exercises) = 0 then
    raise exception 'workout needs at least one exercise';
  end if;
  if jsonb_array_length(v_exercises) > 50 then
    raise exception 'too many exercises';
  end if;

  if v_workout_id is not null then
    -- Edit: replace the whole workout in place. RLS scopes the update to the
    -- owner's row; children cascade-delete and are re-inserted below.
    update public.workouts
      set performed_at = v_performed_at,
          title = nullif(p_payload->>'title', ''),
          note = nullif(p_payload->>'note', ''),
          location = nullif(p_payload->>'location', '')
      where id = v_workout_id and user_id = v_user;
    if not found then
      raise exception 'workout not found';
    end if;
    delete from public.workout_exercises where workout_id = v_workout_id;
  else
    if v_client_id is not null then
      select id into v_workout_id from public.workouts
        where user_id = v_user and client_id = v_client_id;
      if v_workout_id is not null then
        return v_workout_id; -- idempotent replay of an earlier successful save
      end if;
    end if;
    insert into public.workouts (user_id, performed_at, title, note, location, client_id)
      values (v_user, v_performed_at,
              nullif(p_payload->>'title', ''),
              nullif(p_payload->>'note', ''),
              nullif(p_payload->>'location', ''),
              v_client_id)
      returning id into v_workout_id;
  end if;

  for v_ex in select * from jsonb_array_elements(v_exercises) loop
    if jsonb_typeof(coalesce(v_ex->'sets', '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(v_ex->'sets', '[]'::jsonb)) > 100 then
      raise exception 'invalid sets payload';
    end if;

    -- Exercises with zero sets are kept: they preserve the workout's template
    -- structure (e.g. planned-but-unstarted exercises).
    insert into public.workout_exercises (workout_id, exercise_id, display_name, order_index)
      values (v_workout_id,
              (v_ex->>'exercise_id')::uuid,
              coalesce(nullif(v_ex->>'display_name', ''), 'Exercise'),
              v_ex_idx)
      returning id into v_wex_id;

    v_set_idx := 1;
    for v_set in select * from jsonb_array_elements(coalesce(v_ex->'sets', '[]'::jsonb)) loop
      insert into public.sets (workout_exercise_id, set_index, weight, reps, set_type, completed)
        values (v_wex_id, v_set_idx,
                coalesce((v_set->>'weight')::numeric, 0),
                coalesce((v_set->>'reps')::int, 0),
                coalesce(v_set->>'set_type', 'working'),
                coalesce((v_set->>'completed')::boolean, false));
      v_set_idx := v_set_idx + 1;
    end loop;
    v_ex_idx := v_ex_idx + 1;
  end loop;

  return v_workout_id;
exception
  when unique_violation then
    -- A concurrent retry of the same offline item committed first: return its
    -- workout. Any other unique violation re-raises.
    if v_client_id is not null then
      select id into v_workout_id from public.workouts
        where user_id = v_user and client_id = v_client_id;
      if v_workout_id is not null then
        return v_workout_id;
      end if;
    end if;
    raise;
end;
$$;

revoke all on function public.save_workout(jsonb) from public;
grant execute on function public.save_workout(jsonb) to authenticated;
