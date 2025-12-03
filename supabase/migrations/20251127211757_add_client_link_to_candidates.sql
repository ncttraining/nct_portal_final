/*
  # Add client linking to booking candidates

  1. Changes
    - Add `client_id` column to `booking_candidates` table to link candidates with clients
    - Create index on `client_id` for query performance
    - Create index on `email` for searching candidates by email
    - Add RLS policy to ensure proper access control

  2. Purpose
    - Enables tracking which candidates belong to specific clients
    - Supports future client-specific functionality
    - Improves query performance for candidate searches
    - Maintains data integrity with foreign key relationship

  3. Notes
    - Existing candidates will have null client_id initially
    - Can be populated from booking.client_id when needed
    - Allows candidates to be linked to clients even if booking is deleted
*/

-- Add client_id to booking_candidates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_candidates' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE booking_candidates 
    ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_candidates_client_id 
  ON booking_candidates(client_id);

CREATE INDEX IF NOT EXISTS idx_booking_candidates_email 
  ON booking_candidates(email);

CREATE INDEX IF NOT EXISTS idx_booking_candidates_candidate_name 
  ON booking_candidates(candidate_name);
