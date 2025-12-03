/*
  # Add Authenticated User Policies for Trainer Attribute Values

  ## Overview
  This migration adds RLS policies to allow authenticated users to manage trainer attribute values.

  ## Changes Made

  1. **RLS Policies**
    - Add SELECT policy for authenticated users
    - Add INSERT policy for authenticated users
    - Add UPDATE policy for authenticated users
    - Add DELETE policy for authenticated users

  ## Security
  - Authenticated users can perform all operations on trainer attribute values
  - Maintains data integrity while allowing necessary access
*/

-- Add authenticated user policies for trainer_attribute_values
DO $$
BEGIN
  -- SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trainer_attribute_values' 
    AND policyname = 'Authenticated users can read attribute values'
  ) THEN
    CREATE POLICY "Authenticated users can read attribute values"
      ON trainer_attribute_values
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trainer_attribute_values' 
    AND policyname = 'Authenticated users can insert attribute values'
  ) THEN
    CREATE POLICY "Authenticated users can insert attribute values"
      ON trainer_attribute_values
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trainer_attribute_values' 
    AND policyname = 'Authenticated users can update attribute values'
  ) THEN
    CREATE POLICY "Authenticated users can update attribute values"
      ON trainer_attribute_values
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trainer_attribute_values' 
    AND policyname = 'Authenticated users can delete attribute values'
  ) THEN
    CREATE POLICY "Authenticated users can delete attribute values"
      ON trainer_attribute_values
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
