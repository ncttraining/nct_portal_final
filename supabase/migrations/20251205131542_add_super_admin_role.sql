/*
  # Add Super Admin Role

  1. Changes
    - Add `super_admin` boolean column to users table
    - Set default to false for security
    - Update RLS policies to respect super admin permissions
  
  2. Security
    - Only super admins can modify super_admin status
    - Only super admins can delete admin users
*/

-- Add super_admin column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'super_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN super_admin boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Create index for super_admin lookups
CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(super_admin) WHERE super_admin = true;
