/*
  # Add Booking Manager Policies for Trainer Availability
  
  1. Changes
    - Add policies allowing users with can_manage_bookings permission to manage all trainer unavailability records
    - This enables administrators and booking managers to set availability for any trainer
  
  2. Security
    - Users with can_manage_bookings can view, insert, update, and delete any unavailability record
    - This supplements the existing policies for trainers managing their own availability
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Booking managers can view all unavailability v2" ON trainer_unavailability;
DROP POLICY IF EXISTS "Booking managers can insert any unavailability v2" ON trainer_unavailability;
DROP POLICY IF EXISTS "Booking managers can update any unavailability v2" ON trainer_unavailability;
DROP POLICY IF EXISTS "Booking managers can delete any unavailability v2" ON trainer_unavailability;

-- Policy: Users with can_manage_bookings can view all unavailability
CREATE POLICY "Booking managers can view all unavailability v2"
  ON trainer_unavailability
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_manage_bookings = true
    )
  );

-- Policy: Users with can_manage_bookings can insert any unavailability
CREATE POLICY "Booking managers can insert any unavailability v2"
  ON trainer_unavailability
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_manage_bookings = true
    )
  );

-- Policy: Users with can_manage_bookings can update any unavailability
CREATE POLICY "Booking managers can update any unavailability v2"
  ON trainer_unavailability
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_manage_bookings = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_manage_bookings = true
    )
  );

-- Policy: Users with can_manage_bookings can delete any unavailability
CREATE POLICY "Booking managers can delete any unavailability v2"
  ON trainer_unavailability
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_manage_bookings = true
    )
  );
