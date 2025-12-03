/*
  # Add candidate course data field

  1. Changes
    - Add `candidate_course_data` JSONB column to `booking_candidates` table
      - Stores candidate-specific course field values (e.g., exam scores, grades)
      - Default to empty object
      - Used for certificate generation
  
  2. Notes
    - This allows storing dynamic candidate-level fields defined in course types
    - Complements the course-level data stored in bookings table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_candidates' AND column_name = 'candidate_course_data'
  ) THEN
    ALTER TABLE booking_candidates ADD COLUMN candidate_course_data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;