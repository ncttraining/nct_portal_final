/*
  # Add suspended column to trainers

  1. Changes
    - Add `suspended` boolean column to trainers table
    - Default value is false (not suspended)
    - Suspended trainers cannot login and won't appear in trainer lists
  
  2. Notes
    - Trainers cannot be deleted, only suspended
    - This provides a soft-delete mechanism while preserving data integrity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainers' AND column_name = 'suspended'
  ) THEN
    ALTER TABLE trainers ADD COLUMN suspended boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Create index for faster queries filtering suspended trainers
CREATE INDEX IF NOT EXISTS idx_trainers_suspended ON trainers(suspended) WHERE suspended = false;
