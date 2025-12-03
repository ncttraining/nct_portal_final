/*
  # Add Trainer Availability Management System

  1. Changes to users table
    - Add 'can_manage_availability' column (boolean, default false)
    - This permission allows trainers to mark days as unavailable on their calendar

  2. New Tables
    - `trainer_unavailability` - Stores dates when trainers are unavailable
      - `id` (uuid, primary key)
      - `trainer_id` (uuid, references trainers)
      - `unavailable_date` (date, not null)
      - `reason` (text, optional note about why unavailable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint on (trainer_id, unavailable_date)

  3. Security
    - Enable RLS on trainer_unavailability table
    - Trainers can manage (insert, update, delete) their own unavailability records
    - Users with can_view_bookings can view all unavailability records
    - Trainers can view their own unavailability records

  4. Notes
    - This system allows trainers to block out dates when they cannot accept bookings
    - Unavailable dates should be checked during the booking process to prevent conflicts
    - Days marked as unavailable should display with a red background on the calendar
*/

-- Add can_manage_availability permission if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'can_manage_availability'
  ) THEN
    ALTER TABLE users ADD COLUMN can_manage_availability boolean DEFAULT false;
  END IF;
END $$;

-- Create trainer_unavailability table
CREATE TABLE IF NOT EXISTS trainer_unavailability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  unavailable_date date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(trainer_id, unavailable_date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_trainer_unavailability_trainer_date
  ON trainer_unavailability(trainer_id, unavailable_date);

-- Enable RLS
ALTER TABLE trainer_unavailability ENABLE ROW LEVEL SECURITY;

-- Policy: Trainers can view their own unavailability records
CREATE POLICY "Trainers can view own unavailability"
  ON trainer_unavailability
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.trainer_id = trainer_unavailability.trainer_id
    )
  );

-- Policy: Users with can_view_bookings permission can view all unavailability
CREATE POLICY "Booking viewers can view all unavailability"
  ON trainer_unavailability
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_view_bookings = true
    )
  );

-- Policy: Trainers with can_manage_availability can insert their own unavailability
CREATE POLICY "Trainers can insert own unavailability"
  ON trainer_unavailability
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.trainer_id = trainer_unavailability.trainer_id
      AND users.can_manage_availability = true
    )
  );

-- Policy: Trainers with can_manage_availability can update their own unavailability
CREATE POLICY "Trainers can update own unavailability"
  ON trainer_unavailability
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.trainer_id = trainer_unavailability.trainer_id
      AND users.can_manage_availability = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.trainer_id = trainer_unavailability.trainer_id
      AND users.can_manage_availability = true
    )
  );

-- Policy: Trainers with can_manage_availability can delete their own unavailability
CREATE POLICY "Trainers can delete own unavailability"
  ON trainer_unavailability
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.trainer_id = trainer_unavailability.trainer_id
      AND users.can_manage_availability = true
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_trainer_unavailability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_trainer_unavailability_updated_at ON trainer_unavailability;
CREATE TRIGGER update_trainer_unavailability_updated_at
  BEFORE UPDATE ON trainer_unavailability
  FOR EACH ROW
  EXECUTE FUNCTION update_trainer_unavailability_updated_at();
