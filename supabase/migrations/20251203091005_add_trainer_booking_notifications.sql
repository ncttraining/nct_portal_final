/*
  # Add Trainer Booking Notification Preferences

  1. Schema Changes
    - Add `receive_booking_notifications` column to trainers table
      - Boolean flag to control whether trainer receives booking notification emails
      - Default value: true (all trainers opted-in by default)
      - Trainers can toggle this in their profile settings

  2. Data Migration
    - Set all existing trainers to receive notifications by default

  3. Indexes
    - Add index on receive_booking_notifications for efficient filtering

  4. Important Notes
    - This preference controls all booking-related notifications:
      - New booking assigned to trainer
      - Booking moved to trainer from another trainer
      - Booking cancelled/deleted
      - Booking updated (excluding contact/candidate changes)
    - Trainers can manage this preference in their profile
    - Default is true to ensure trainers stay informed about schedule changes
*/

-- Add receive_booking_notifications column to trainers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainers' AND column_name = 'receive_booking_notifications'
  ) THEN
    ALTER TABLE trainers ADD COLUMN receive_booking_notifications boolean DEFAULT true;
  END IF;
END $$;

-- Update all existing trainers to have notifications enabled by default
UPDATE trainers
SET receive_booking_notifications = true
WHERE receive_booking_notifications IS NULL;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_trainers_receive_notifications
  ON trainers(receive_booking_notifications)
  WHERE receive_booking_notifications = true;

-- Add comment for documentation
COMMENT ON COLUMN trainers.receive_booking_notifications IS
  'Controls whether trainer receives email notifications for booking changes (new, moved, cancelled, updated)';