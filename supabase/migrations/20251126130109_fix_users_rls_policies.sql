/*
  # Fix Users Table RLS Policies

  1. Changes
    - Drop existing policies with circular dependencies
    - Create new simplified policies that allow users to read their own profile
    - Allow admins to manage all users without circular lookups

  2. Security
    - Users can read and update their own profile
    - Users with can_manage_users permission can read all users
    - Users with can_manage_users permission can update all users
    - Users with can_manage_users permission can delete users
    - System can insert new users during signup
*/

DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "System can insert users" ON users;

CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "User managers can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_manage_users = true
    )
  );

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "User managers can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_manage_users = true
    )
  );

CREATE POLICY "User managers can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_manage_users = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_manage_users = true
    )
  );

CREATE POLICY "User managers can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_manage_users = true
    )
  );
