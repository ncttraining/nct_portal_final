/*
  # Add course_level_data to open_course_sessions table

  This allows session-level certificate fields (like instructor names, equipment used, etc.)
  to be saved and remembered for each open course session, similar to how bookings
  store course_level_data.

  1. Changes
    - Add `course_level_data` JSONB column to `open_course_sessions` table
*/

-- Add course_level_data column to open_course_sessions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'open_course_sessions'
    AND column_name = 'course_level_data'
  ) THEN
    ALTER TABLE open_course_sessions
    ADD COLUMN course_level_data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;
