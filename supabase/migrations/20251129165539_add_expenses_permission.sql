/*
  # Add expenses permission to user permissions

  1. Changes
    - Add 'can_manage_expenses' column to users table (boolean, default false)
  
  2. Notes
    - Users with this permission can view and manage their own expense claims
    - Admin users can see all expenses regardless of this permission
    - This permission is required to access the expenses feature
*/

-- Add can_manage_expenses permission if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'can_manage_expenses'
  ) THEN
    ALTER TABLE users ADD COLUMN can_manage_expenses boolean DEFAULT false;
  END IF;
END $$;
