/*
  # Fix open_course_delegates Check Constraints

  1. Changes
    - Update attendance_status constraint to allow NULL values
    - Update booking_source constraint to include 'admin' instead of just 'manual'
  
  2. Security
    - No changes to RLS policies
*/

-- Drop and recreate attendance_status constraint to allow NULL
ALTER TABLE open_course_delegates
DROP CONSTRAINT IF EXISTS open_course_delegates_attendance_status_check;

ALTER TABLE open_course_delegates
ADD CONSTRAINT open_course_delegates_attendance_status_check
CHECK (attendance_status IS NULL OR attendance_status IN ('present', 'absent', 'late', 'left_early'));

-- Drop and recreate booking_source constraint to allow 'admin'
ALTER TABLE open_course_delegates
DROP CONSTRAINT IF EXISTS open_course_delegates_booking_source_check;

ALTER TABLE open_course_delegates
ADD CONSTRAINT open_course_delegates_booking_source_check
CHECK (booking_source IS NULL OR booking_source IN ('website', 'phone', 'admin', 'transfer'));