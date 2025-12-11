/*
  # Add Provisional Booking Status to Trainer Availability

  This migration adds support for provisional bookings where trainers can be
  reserved for a date without being assigned to a specific course yet.

  1. Changes to trainer_unavailability table
    - Add 'status' column with values: 'unavailable', 'provisionally_booked'
    - Default is 'unavailable' for backward compatibility

  2. Visual representation:
    - 'unavailable' = Red background (existing)
    - 'provisionally_booked' = Light green background (new)
*/

-- Add status column to trainer_unavailability table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainer_unavailability' AND column_name = 'status'
  ) THEN
    ALTER TABLE trainer_unavailability
    ADD COLUMN status text NOT NULL DEFAULT 'unavailable'
    CHECK (status IN ('unavailable', 'provisionally_booked'));
  END IF;
END $$;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_trainer_unavailability_status
  ON trainer_unavailability(status);

-- Add comment for documentation
COMMENT ON COLUMN trainer_unavailability.status IS 'Status of the availability record: unavailable (trainer cannot work), provisionally_booked (trainer reserved but not assigned to a course)';
