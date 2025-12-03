/*
  # Add Default Course Data to Course Types

  1. Purpose
    - Allow administrators to set default values for course-level fields
    - These defaults auto-populate when creating bookings or issuing certificates
    - Reduces repetitive data entry for common course configurations
    - Examples: Standard equipment types for Forklift courses, default venues

  2. Changes
    - Add `default_course_data` JSONB column to `course_types` table
    - Stores key-value pairs matching course-level field names
    - Empty by default, administrators populate via Course Types Manager

  3. Example Usage
    - Forklift Training (FLT) might have:
      {"equipment_types": "B1, B3", "venue": "Main Training Center"}
    - First Aid (FA) might have:
      {"training_materials_version": "2024.1"}

  4. Notes
    - Only applies to fields with scope='course'
    - Booking data can override these defaults
    - Defaults are copied to bookings.course_level_data on creation
*/

-- Add default_course_data column to course_types table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_types' AND column_name = 'default_course_data'
  ) THEN
    ALTER TABLE course_types ADD COLUMN default_course_data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_course_types_default_course_data ON course_types USING gin (default_course_data);

-- Add helpful comment
COMMENT ON COLUMN course_types.default_course_data IS 'Default values for course-level fields. Auto-populates when creating bookings. Administrators set via Course Types Manager.';
