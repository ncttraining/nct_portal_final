-- Create trainers table for NCT Internal Portal
-- Run this SQL in your Supabase SQL Editor

-- Create the trainers table
CREATE TABLE IF NOT EXISTS trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address1 text DEFAULT '',
  address2 text DEFAULT '',
  town text DEFAULT '',
  postcode text NOT NULL,
  telephone text DEFAULT '',
  email text DEFAULT '',
  day_rate numeric(10,2),
  rtitb_number text DEFAULT '',
  rtitb_expiry date,
  insurance_expiry date,
  insurance_file_name text DEFAULT '',
  insurance_url text DEFAULT '',
  latitude numeric(10,6),
  longitude numeric(10,6),
  truck_types text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for anonymous users (internal tool)
CREATE POLICY "Anonymous users can read all trainers"
  ON trainers
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can insert trainers"
  ON trainers
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can update trainers"
  ON trainers
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous users can delete trainers"
  ON trainers
  FOR DELETE
  TO anon
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_trainers_postcode ON trainers(postcode);
CREATE INDEX IF NOT EXISTS idx_trainers_insurance_expiry ON trainers(insurance_expiry);
CREATE INDEX IF NOT EXISTS idx_trainers_rtitb_expiry ON trainers(rtitb_expiry);
