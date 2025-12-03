/*
  # Fix RLS policies for trainer attributes to support authenticated users

  1. Changes
    - Drop existing anon-only policies for trainer_type_attributes
    - Drop existing anon-only policies for trainer_attribute_options  
    - Create new policies that allow both anon AND authenticated users
    - This allows logged-in admin users to manage trainer types and attributes

  2. Security
    - RLS remains enabled
    - Policies allow both anonymous and authenticated access
    - In production, these should be restricted to admin users only
*/

-- Drop old anon-only policies for trainer_type_attributes
DROP POLICY IF EXISTS "Anonymous users can read attributes" ON trainer_type_attributes;
DROP POLICY IF EXISTS "Anonymous users can insert attributes" ON trainer_type_attributes;
DROP POLICY IF EXISTS "Anonymous users can update attributes" ON trainer_type_attributes;
DROP POLICY IF EXISTS "Anonymous users can delete attributes" ON trainer_type_attributes;

-- Create new policies allowing both anon and authenticated
CREATE POLICY "Users can read attributes"
  ON trainer_type_attributes
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert attributes"
  ON trainer_type_attributes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update attributes"
  ON trainer_type_attributes
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete attributes"
  ON trainer_type_attributes
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Drop old anon-only policies for trainer_attribute_options
DROP POLICY IF EXISTS "Anonymous users can read attribute options" ON trainer_attribute_options;
DROP POLICY IF EXISTS "Anonymous users can insert attribute options" ON trainer_attribute_options;
DROP POLICY IF EXISTS "Anonymous users can update attribute options" ON trainer_attribute_options;
DROP POLICY IF EXISTS "Anonymous users can delete attribute options" ON trainer_attribute_options;

-- Create new policies allowing both anon and authenticated
CREATE POLICY "Users can read attribute options"
  ON trainer_attribute_options
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert attribute options"
  ON trainer_attribute_options
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update attribute options"
  ON trainer_attribute_options
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete attribute options"
  ON trainer_attribute_options
  FOR DELETE
  TO anon, authenticated
  USING (true);
