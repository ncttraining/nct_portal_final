/*
  # Fix Foreign Key Constraint for trainers.user_id

  ## Overview
  The foreign key constraint on trainers.user_id was incorrectly pointing to auth.users
  instead of public.users. This migration fixes the constraint to point to the correct table.

  ## Changes Made

  1. **Foreign Key Constraints**
    - Drop existing incorrect foreign key constraint (pointing to auth.users)
    - Add correct foreign key constraint from trainers.user_id to public.users.id
    - Set ON DELETE SET NULL to preserve trainer records if user is deleted
    - Set ON UPDATE CASCADE to maintain referential integrity

  ## Security
  - Maintains data integrity between trainers and users tables
  - Allows Supabase to properly resolve relationships in queries
*/

-- Drop the incorrect foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'trainers_user_id_fkey'
    AND table_name = 'trainers'
  ) THEN
    ALTER TABLE trainers DROP CONSTRAINT trainers_user_id_fkey;
  END IF;
END $$;

-- Add the correct foreign key constraint pointing to public.users
ALTER TABLE trainers
  ADD CONSTRAINT trainers_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
