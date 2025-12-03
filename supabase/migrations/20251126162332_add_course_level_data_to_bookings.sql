/*
  # Add Course-Level Data Support to Bookings

  1. Changes to bookings table
    - Add `course_level_data` JSONB column to store course-level field values
    - This stores data that applies to the entire course, not individual candidates
    - Examples: Equipment types used, venue details, instructor notes

  2. Purpose
    - Allows administrators to enter course-wide information once
    - Reduces repetition when issuing certificates for multiple candidates
    - Data is merged with candidate-specific data during certificate generation

  3. Notes
    - Course-level fields are defined in course_types.required_fields with scope='course'
    - Candidate-level fields have scope='candidate' and are entered per candidate
    - Both are combined in the certificate's course_specific_data field
*/

-- Add course_level_data column to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'course_level_data'
  ) THEN
    ALTER TABLE bookings ADD COLUMN course_level_data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_bookings_course_level_data ON bookings USING gin (course_level_data);

-- Add helpful comment
COMMENT ON COLUMN bookings.course_level_data IS 'Course-level field data that applies to all candidates (e.g., equipment types, venue). Merged with candidate-specific data during certificate generation.';
