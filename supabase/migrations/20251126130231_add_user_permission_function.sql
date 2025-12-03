/*
  # Add User Permission Function to Fix RLS

  1. Changes
    - Create a security definer function that bypasses RLS to check permissions
    - Update RLS policies to use this function instead of direct queries
    - This fixes the circular dependency issue

  2. Security
    - Function runs with elevated privileges but only returns boolean
    - Cannot be exploited as it only checks the current user's permissions
*/

-- Create a function that checks if the current user can manage users
CREATE OR REPLACE FUNCTION public.current_user_can_manage_users()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND can_manage_users = true
  );
END;
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "User managers can read all users" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "User managers can insert users" ON users;
DROP POLICY IF EXISTS "User managers can update all users" ON users;
DROP POLICY IF EXISTS "User managers can delete users" ON users;

-- Create new policies using the function
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "User managers can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (current_user_can_manage_users());

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "User managers can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (current_user_can_manage_users());

CREATE POLICY "User managers can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (current_user_can_manage_users())
  WITH CHECK (current_user_can_manage_users());

CREATE POLICY "User managers can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (current_user_can_manage_users());
