/*
  # Make duration_days nullable in course_types
  
  1. Changes
    - Alter `course_types.duration_days` to allow NULL values
    - This allows course types to use the booking's duration instead of a fixed duration
  
  2. Notes
    - When duration_days is NULL, the system will use the booking's num_days value
    - This is useful for courses where duration varies by booking
*/

DO $$
BEGIN
  -- Make duration_days nullable if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_types' AND column_name = 'duration_days'
  ) THEN
    ALTER TABLE course_types ALTER COLUMN duration_days DROP NOT NULL;
  END IF;
END $$;
