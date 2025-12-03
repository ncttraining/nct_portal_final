/*
  # Add avatar URL to users table

  1. Changes
    - Add avatar_url column to users table to store profile picture URLs
  
  2. Notes
    - Stores the URL path to the avatar image in Supabase storage
    - Nullable field, defaults to null (no avatar)
*/

-- Add avatar_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_url text;
  END IF;
END $$;
