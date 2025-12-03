/*
  # Add Duration Unit to Course Types

  1. Changes
    - Add `duration_unit` column to course_types table (text, check constraint for 'hours' or 'days')
    - Set default to 'days' for backward compatibility
    - Update existing records to use 'days' as the unit

  2. Notes
    - This allows courses to specify duration in either hours or days
    - Existing duration_days values will be interpreted as days
    - The UI will provide a dropdown to select between hours and days
*/

-- Add duration_unit column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_types' AND column_name = 'duration_unit'
  ) THEN
    ALTER TABLE course_types ADD COLUMN duration_unit text DEFAULT 'days';
    
    -- Add check constraint to ensure only 'hours' or 'days' are allowed
    ALTER TABLE course_types ADD CONSTRAINT course_types_duration_unit_check 
      CHECK (duration_unit IN ('hours', 'days'));
  END IF;
END $$;