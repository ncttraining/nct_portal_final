/*
  # Add Foreign Key Constraint for trainers.user_id

  ## Overview
  This migration adds a foreign key constraint between trainers.user_id and users.id
  to enable proper relationship queries in Supabase.

  ## Changes Made

  1. **Foreign Key Constraints**
    - Add foreign key constraint from trainers.user_id to users.id
    - Set ON DELETE SET NULL to preserve trainer records if user is deleted
    - Set ON UPDATE CASCADE to maintain referential integrity

  ## Security
  - Maintains data integrity between trainers and users tables
  - Allows Supabase to properly resolve relationships in queries
*/

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'trainers_user_id_fkey'
    AND table_name = 'trainers'
  ) THEN
    ALTER TABLE trainers
      ADD CONSTRAINT trainers_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
