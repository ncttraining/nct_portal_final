/*
  # Add Active Status Column to Trainers Table

  ## Overview
  This migration adds an `active` column to the trainers table to track whether
  a trainer is currently active or has been deactivated.

  ## Changes Made

  1. **Trainers Table**
    - Add `active` (boolean, default true) - Indicates if trainer is active

  2. **Data Migration**
    - Set all existing trainers to active=true

  ## Notes
  - Inactive trainers can be filtered out in the UI
  - Maintains data integrity by not deleting trainer records
*/

-- Add active column to trainers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainers' AND column_name = 'active'
  ) THEN
    ALTER TABLE trainers ADD COLUMN active boolean DEFAULT true;
  END IF;
END $$;

-- Update existing trainers to be active
UPDATE trainers SET active = true WHERE active IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE trainers ALTER COLUMN active SET NOT NULL;
ALTER TABLE trainers ALTER COLUMN active SET DEFAULT true;
