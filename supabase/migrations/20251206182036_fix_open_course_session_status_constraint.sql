/*
  # Fix Open Course Session Status Constraint

  1. Changes
    - Drop existing constraint
    - Update all status values to new convention
    - Add new constraint with: draft, confirmed, cancelled
*/

DO $$
BEGIN
  -- Drop the old constraint if it exists
  ALTER TABLE open_course_sessions
  DROP CONSTRAINT IF EXISTS open_course_sessions_status_check;

  -- Update existing statuses to match new convention
  UPDATE open_course_sessions
  SET status = 'confirmed'
  WHERE status IN ('scheduled', 'published', 'full', 'completed');

  UPDATE open_course_sessions
  SET status = 'cancelled'
  WHERE status = 'canceled';

  UPDATE open_course_sessions
  SET status = 'draft'
  WHERE status NOT IN ('confirmed', 'cancelled', 'draft');

  -- Add new constraint with correct values
  ALTER TABLE open_course_sessions
  ADD CONSTRAINT open_course_sessions_status_check 
  CHECK (status IN ('draft', 'confirmed', 'cancelled'));
END $$;
