/*
  # Add Booking and Course Management Permissions

  1. Changes
    - Add `can_manage_bookings` column to users table (boolean, default false)
    - Add `can_manage_courses` column to users table (boolean, default false)
    - These permissions control access to booking management and course management features

  2. Security
    - Only users with can_manage_users permission can modify these fields
    - Permissions default to false for new users
    - Admin users typically have all permissions

  3. Notes
    - can_manage_bookings: Access to Course Booking & Scheduling, Trainer Map, Clients
    - can_manage_courses: Access to Certificate Templates, Course Types Manager, View/Issue Certificates
    - can_view_bookings: Already exists - allows viewing bookings for specific trainers
*/

-- Add can_manage_bookings column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'can_manage_bookings'
  ) THEN
    ALTER TABLE users ADD COLUMN can_manage_bookings boolean DEFAULT false;
  END IF;
END $$;

-- Add can_manage_courses column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'can_manage_courses'
  ) THEN
    ALTER TABLE users ADD COLUMN can_manage_courses boolean DEFAULT false;
  END IF;
END $$;