/*
  # Add certificate template and duration fields to bookings

  1. Changes
    - Add `certificate_template_id` column to bookings table (nullable, references certificate_templates)
    - Add `duration_value` column to bookings table (nullable integer for duration number)
    - Add `duration_unit` column to bookings table (text with check constraint for 'hours' or 'days')
  
  2. Notes
    - These fields allow saving the selected certificate template and custom duration per booking
    - Nullable to allow legacy bookings without these values
    - duration_value and duration_unit work together to store course duration overrides
*/

-- Add certificate_template_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'certificate_template_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN certificate_template_id uuid REFERENCES certificate_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add duration_value column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'duration_value'
  ) THEN
    ALTER TABLE bookings ADD COLUMN duration_value integer;
  END IF;
END $$;

-- Add duration_unit column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'duration_unit'
  ) THEN
    ALTER TABLE bookings ADD COLUMN duration_unit text DEFAULT 'days';
  END IF;
END $$;

-- Add check constraint for duration_unit if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'bookings_duration_unit_check'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_duration_unit_check 
      CHECK (duration_unit IN ('hours', 'days'));
  END IF;
END $$;
