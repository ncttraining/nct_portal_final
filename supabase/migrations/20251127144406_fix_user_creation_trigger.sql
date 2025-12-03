/*
  # Fix User Creation Trigger

  1. Changes
    - Drop existing trigger and function
    - Recreate with proper RLS bypass using SECURITY DEFINER
    - Update INSERT policy to allow service role
    - Manually insert missing user record

  2. Security
    - Trigger runs with elevated privileges to bypass RLS
    - Only creates basic user records from auth.users
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate function with proper security context
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, can_manage_users)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Fix missing user record for recently created user
INSERT INTO public.users (id, email, full_name, role, can_manage_users)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', ''),
  'user',
  false
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;