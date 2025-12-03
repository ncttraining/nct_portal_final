/*
  # Create Client Locations System

  1. New Tables
    - `client_locations`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `location_name` (text) - Name/identifier for the location
      - `address1` (text) - First line of address
      - `address2` (text) - Second line of address
      - `town` (text) - Town/city
      - `postcode` (text) - Postal code
      - `contact_name` (text) - Location-specific contact person
      - `contact_email` (text) - Location-specific email
      - `contact_telephone` (text) - Location-specific phone
      - `notes` (text) - Additional notes about the location
      - `is_default` (boolean) - Whether this is the default location
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes to Existing Tables
    - Add `location_id` column to bookings table

  3. Security
    - Enable RLS on client_locations table
    - Add policies for authenticated users to manage locations

  4. Notes
    - Each client can have multiple locations
    - Bookings can reference a specific client location
    - Location-specific contact details override client defaults
*/

CREATE TABLE IF NOT EXISTS client_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  location_name text NOT NULL DEFAULT '',
  address1 text NOT NULL DEFAULT '',
  address2 text NOT NULL DEFAULT '',
  town text NOT NULL DEFAULT '',
  postcode text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_telephone text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE client_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read client locations"
  ON client_locations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client locations"
  ON client_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update client locations"
  ON client_locations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete client locations"
  ON client_locations
  FOR DELETE
  TO authenticated
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN location_id uuid REFERENCES client_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_locations_client_id ON client_locations(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_location_id ON bookings(location_id);
