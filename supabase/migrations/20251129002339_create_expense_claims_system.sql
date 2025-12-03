/*
  # Create Travel Expense Claims System

  1. New Tables
    - `expense_claims`
      - `id` (uuid, primary key)
      - `trainer_id` (uuid, references trainers)
      - `trainer_name` (text, denormalized for easy display)
      - `submission_date` (date)
      - `vehicle_registration` (text)
      - `fuel_type` (text, enum: 'petrol' or 'diesel')
      - `engine_size` (text, enum: '1400cc_or_less', '1401cc_to_2000cc', 'over_2000cc')
      - `total_miles` (numeric)
      - `total_tolls_parking` (numeric)
      - `total_amount` (numeric, calculated)
      - `status` (text, enum: 'pending', 'approved', 'paid', 'rejected')
      - `payment_date` (date, nullable)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `expense_claim_journeys`
      - `id` (uuid, primary key)
      - `expense_claim_id` (uuid, references expense_claims)
      - `journey_date` (date)
      - `origin` (text, where from)
      - `destination` (text, where to)
      - `miles` (numeric)
      - `tolls_parking` (numeric)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Trainers can create and view their own expense claims (matched by email)
    - Trainers can create journeys for their own claims
    - Admins and users with can_manage_bookings can view and update all claims
    - Admins can approve/reject and mark as paid

  3. Indexes
    - Index on trainer_id for fast lookup
    - Index on status for filtering
    - Index on expense_claim_id for journey lookup
*/

-- Create expense_claims table
CREATE TABLE IF NOT EXISTS expense_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  trainer_name text NOT NULL,
  submission_date date NOT NULL DEFAULT CURRENT_DATE,
  vehicle_registration text NOT NULL,
  fuel_type text NOT NULL CHECK (fuel_type IN ('petrol', 'diesel')),
  engine_size text NOT NULL CHECK (engine_size IN ('1400cc_or_less', '1401cc_to_2000cc', 'over_2000cc')),
  total_miles numeric(10, 2) NOT NULL DEFAULT 0,
  total_tolls_parking numeric(10, 2) NOT NULL DEFAULT 0,
  total_amount numeric(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create expense_claim_journeys table
CREATE TABLE IF NOT EXISTS expense_claim_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_claim_id uuid NOT NULL REFERENCES expense_claims(id) ON DELETE CASCADE,
  journey_date date NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  miles numeric(10, 2) NOT NULL DEFAULT 0,
  tolls_parking numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expense_claims_trainer_id ON expense_claims(trainer_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON expense_claims(status);
CREATE INDEX IF NOT EXISTS idx_expense_claim_journeys_claim_id ON expense_claim_journeys(expense_claim_id);

-- Enable RLS
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_claim_journeys ENABLE ROW LEVEL SECURITY;

-- Policies for expense_claims

-- Trainers can view their own claims (matched by email)
CREATE POLICY "Trainers can view own expense claims"
  ON expense_claims FOR SELECT
  TO authenticated
  USING (
    trainer_id IN (
      SELECT t.id FROM trainers t
      INNER JOIN users u ON LOWER(t.email) = LOWER(u.email)
      WHERE u.id = auth.uid()
    )
  );

-- Trainers can create their own claims (matched by email)
CREATE POLICY "Trainers can create own expense claims"
  ON expense_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    trainer_id IN (
      SELECT t.id FROM trainers t
      INNER JOIN users u ON LOWER(t.email) = LOWER(u.email)
      WHERE u.id = auth.uid()
    )
  );

-- Trainers can update their own pending claims
CREATE POLICY "Trainers can update own pending claims"
  ON expense_claims FOR UPDATE
  TO authenticated
  USING (
    trainer_id IN (
      SELECT t.id FROM trainers t
      INNER JOIN users u ON LOWER(t.email) = LOWER(u.email)
      WHERE u.id = auth.uid()
    )
    AND status = 'pending'
  )
  WITH CHECK (
    trainer_id IN (
      SELECT t.id FROM trainers t
      INNER JOIN users u ON LOWER(t.email) = LOWER(u.email)
      WHERE u.id = auth.uid()
    )
    AND status = 'pending'
  );

-- Admins and booking managers can view all claims
CREATE POLICY "Admins and booking managers can view all expense claims"
  ON expense_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND (role = 'admin' OR can_manage_bookings = true)
    )
  );

-- Admins and booking managers can update all claims
CREATE POLICY "Admins and booking managers can update all expense claims"
  ON expense_claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND (role = 'admin' OR can_manage_bookings = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND (role = 'admin' OR can_manage_bookings = true)
    )
  );

-- Policies for expense_claim_journeys

-- Trainers can view journeys for their own claims
CREATE POLICY "Trainers can view own claim journeys"
  ON expense_claim_journeys FOR SELECT
  TO authenticated
  USING (
    expense_claim_id IN (
      SELECT ec.id FROM expense_claims ec
      INNER JOIN trainers t ON ec.trainer_id = t.id
      INNER JOIN users u ON LOWER(t.email) = LOWER(u.email)
      WHERE u.id = auth.uid()
    )
  );

-- Trainers can create journeys for their own claims
CREATE POLICY "Trainers can create own claim journeys"
  ON expense_claim_journeys FOR INSERT
  TO authenticated
  WITH CHECK (
    expense_claim_id IN (
      SELECT ec.id FROM expense_claims ec
      INNER JOIN trainers t ON ec.trainer_id = t.id
      INNER JOIN users u ON LOWER(t.email) = LOWER(u.email)
      WHERE u.id = auth.uid()
      AND ec.status = 'pending'
    )
  );

-- Trainers can update journeys for their own pending claims
CREATE POLICY "Trainers can update own claim journeys"
  ON expense_claim_journeys FOR UPDATE
  TO authenticated
  USING (
    expense_claim_id IN (
      SELECT ec.id FROM expense_claims ec
      INNER JOIN trainers t ON ec.trainer_id = t.id
      INNER JOIN users u ON LOWER(t.email) = LOWER(u.email)
      WHERE u.id = auth.uid()
      AND ec.status = 'pending'
    )
  )
  WITH CHECK (
    expense_claim_id IN (
      SELECT ec.id FROM expense_claims ec
      INNER JOIN trainers t ON ec.trainer_id = t.id
      INNER JOIN users u ON LOWER(t.email) = LOWER(u.email)
      WHERE u.id = auth.uid()
      AND ec.status = 'pending'
    )
  );

-- Trainers can delete journeys for their own pending claims
CREATE POLICY "Trainers can delete own claim journeys"
  ON expense_claim_journeys FOR DELETE
  TO authenticated
  USING (
    expense_claim_id IN (
      SELECT ec.id FROM expense_claims ec
      INNER JOIN trainers t ON ec.trainer_id = t.id
      INNER JOIN users u ON LOWER(t.email) = LOWER(u.email)
      WHERE u.id = auth.uid()
      AND ec.status = 'pending'
    )
  );

-- Admins and booking managers can view all journeys
CREATE POLICY "Admins and booking managers can view all journeys"
  ON expense_claim_journeys FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND (role = 'admin' OR can_manage_bookings = true)
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_expense_claim_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on expense_claims
DROP TRIGGER IF EXISTS expense_claims_updated_at ON expense_claims;
CREATE TRIGGER expense_claims_updated_at
  BEFORE UPDATE ON expense_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_expense_claim_updated_at();
