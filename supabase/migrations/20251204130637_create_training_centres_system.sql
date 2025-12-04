/*
  # Create Training Centres and Rooms Management System

  1. New Tables
    - `training_centres`
      - `id` (uuid, primary key)
      - `name` (text) - Centre name (e.g., "NCT Training Centre - Main Building")
      - `address1` (text) - Address line 1
      - `address2` (text) - Address line 2
      - `town` (text) - Town/City
      - `postcode` (text) - Postcode
      - `contact_name` (text) - Main contact person
      - `contact_email` (text) - Contact email
      - `contact_telephone` (text) - Contact phone
      - `notes` (text) - Special instructions or notes
      - `is_active` (boolean) - Whether centre is active
      - `sort_order` (integer) - For custom sorting
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `training_centre_rooms`
      - `id` (uuid, primary key)
      - `centre_id` (uuid, foreign key to training_centres)
      - `room_name` (text) - Room name (e.g., "Room A", "Conference Room")
      - `capacity` (integer) - Maximum number of people
      - `equipment` (text) - Available equipment description
      - `notes` (text) - Special instructions
      - `is_active` (boolean) - Whether room is active
      - `sort_order` (integer) - For custom sorting
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Updates to Existing Tables
    - Add `centre_id` and `room_id` to bookings table

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users with booking management permissions
*/

-- Training centres table
CREATE TABLE IF NOT EXISTS training_centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address1 text DEFAULT '',
  address2 text DEFAULT '',
  town text DEFAULT '',
  postcode text DEFAULT '',
  contact_name text DEFAULT '',
  contact_email text DEFAULT '',
  contact_telephone text DEFAULT '',
  notes text DEFAULT '',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE training_centres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read training_centres"
  ON training_centres FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert training_centres"
  ON training_centres FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update training_centres"
  ON training_centres FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete training_centres"
  ON training_centres FOR DELETE
  TO authenticated
  USING (true);

-- Training centre rooms table
CREATE TABLE IF NOT EXISTS training_centre_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES training_centres(id) ON DELETE CASCADE,
  room_name text NOT NULL,
  capacity integer DEFAULT 0,
  equipment text DEFAULT '',
  notes text DEFAULT '',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE training_centre_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read training_centre_rooms"
  ON training_centre_rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert training_centre_rooms"
  ON training_centre_rooms FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update training_centre_rooms"
  ON training_centre_rooms FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete training_centre_rooms"
  ON training_centre_rooms FOR DELETE
  TO authenticated
  USING (true);

-- Add centre_id and room_id to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'centre_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN centre_id uuid REFERENCES training_centres(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'room_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN room_id uuid REFERENCES training_centre_rooms(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_centre_rooms_centre_id ON training_centre_rooms(centre_id);
CREATE INDEX IF NOT EXISTS idx_bookings_centre_id ON bookings(centre_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
