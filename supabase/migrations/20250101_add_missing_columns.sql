-- Add location column to workouts table
ALTER TABLE public.workouts
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add completed column to sets table
ALTER TABLE public.sets
ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;

-- Add index for location-based queries
CREATE INDEX IF NOT EXISTS idx_workouts_user_location_date
ON public.workouts(user_id, location, performed_at DESC);

-- Add unique constraint to prevent duplicate exercises in same workout
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_exercises_unique
ON public.workout_exercises(workout_id, exercise_id);
