/*
  # Add Foreign Key Constraint for Trainers User Relationship

  ## Overview
  This migration adds a foreign key constraint from trainers.user_id to users.id
  to enable proper relationship queries in Supabase.

  ## Changes Made

  1. **Foreign Key Constraint**
    - Add FK from trainers.user_id to users.id
    - Set ON DELETE SET NULL to preserve trainer records when user is deleted

  ## Notes
  - Enables Supabase relationship syntax: user:user_id
  - Maintains data integrity between trainers and users tables
*/

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'trainers_user_id_fkey' 
    AND table_name = 'trainers'
  ) THEN
    ALTER TABLE trainers
    ADD CONSTRAINT trainers_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL;
  END IF;
END $$;
