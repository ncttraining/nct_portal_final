/*
  # Create Course Booking System Tables

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text) - Client company name
      - `contact_name` (text) - Main contact person
      - `email` (text) - Contact email
      - `telephone` (text) - Contact phone
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `trainers`
      - `id` (uuid, primary key)
      - `name` (text) - Trainer full name
      - `email` (text) - Trainer email
      - `telephone` (text) - Trainer phone
      - `active` (boolean) - Whether trainer is active
      - `display_order` (integer) - For custom sorting
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `bookings`
      - `id` (uuid, primary key)
      - `trainer_id` (uuid, foreign key to trainers)
      - `booking_date` (date) - Start date of booking
      - `start_time` (time) - Start time
      - `title` (text) - Course/job description
      - `location` (text) - Location name
      - `client_id` (uuid, foreign key to clients)
      - `client_name` (text) - Client name (denormalized for display)
      - `client_contact_name` (text)
      - `client_email` (text)
      - `client_telephone` (text)
      - `notes` (text) - Internal notes
      - `status` (text) - confirmed, provisional, hold, cancelled
      - `in_centre` (boolean) - In-centre vs off-site
      - `num_days` (integer) - Course length in days (1-5)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `booking_candidates`
      - `id` (uuid, primary key)
      - `booking_id` (uuid, foreign key to bookings)
      - `candidate_name` (text)
      - `telephone` (text)
      - `email` (text)
      - `paid` (boolean)
      - `outstanding_balance` (decimal)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text DEFAULT '',
  email text DEFAULT '',
  telephone text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (true);

-- Trainers table
CREATE TABLE IF NOT EXISTS trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text DEFAULT '',
  telephone text DEFAULT '',
  active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read trainers"
  ON trainers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert trainers"
  ON trainers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update trainers"
  ON trainers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete trainers"
  ON trainers FOR DELETE
  TO authenticated
  USING (true);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid REFERENCES trainers(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  start_time time DEFAULT '09:00',
  title text NOT NULL,
  location text DEFAULT '',
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name text DEFAULT '',
  client_contact_name text DEFAULT '',
  client_email text DEFAULT '',
  client_telephone text DEFAULT '',
  notes text DEFAULT '',
  status text DEFAULT 'confirmed',
  in_centre boolean DEFAULT false,
  num_days integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (true);

-- Booking candidates table
CREATE TABLE IF NOT EXISTS booking_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  candidate_name text NOT NULL,
  telephone text DEFAULT '',
  email text DEFAULT '',
  paid boolean DEFAULT false,
  outstanding_balance decimal(10,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE booking_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read booking_candidates"
  ON booking_candidates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert booking_candidates"
  ON booking_candidates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update booking_candidates"
  ON booking_candidates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete booking_candidates"
  ON booking_candidates FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_trainer_id ON bookings(trainer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_booking_candidates_booking_id ON booking_candidates(booking_id);
