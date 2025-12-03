/*
  # Create Certificate Management System

  1. New Tables
    - `course_types`
      - `id` (uuid, primary key)
      - `name` (text) - Course type name (e.g., Forklift, First Aid, Mental Health First Aid)
      - `code` (text) - Short code for certificate numbers (e.g., FLT, FA, MHFA)
      - `trainer_type_id` (uuid, foreign key) - Links to trainer_types
      - `description` (text) - Course description
      - `duration_days` (integer) - Typical course duration
      - `certificate_validity_months` (integer) - How long certificate is valid (null = no expiry)
      - `sort_order` (integer) - Display order
      - `active` (boolean) - Whether course type is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `certificate_templates`
      - `id` (uuid, primary key)
      - `course_type_id` (uuid, foreign key) - Links to course_types
      - `name` (text) - Template name
      - `background_image_url` (text) - URL to background image in storage
      - `page_width` (integer) - Template width in pixels
      - `page_height` (integer) - Template height in pixels
      - `fields_config` (jsonb) - JSON configuration of all fields
      - `is_active` (boolean) - Whether template is currently in use
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `certificates`
      - `id` (uuid, primary key)
      - `certificate_number` (text, unique) - Unique certificate identifier
      - `course_type_id` (uuid, foreign key) - Links to course_types
      - `booking_id` (uuid, foreign key) - Links to bookings
      - `candidate_id` (uuid, foreign key) - Links to booking_candidates
      - `candidate_name` (text) - Candidate name (denormalized)
      - `candidate_email` (text) - Candidate email (denormalized)
      - `trainer_id` (uuid, foreign key) - Trainer who conducted course
      - `trainer_name` (text) - Trainer name (denormalized)
      - `course_date_start` (date) - Course start date
      - `course_date_end` (date) - Course end date
      - `issue_date` (date) - Certificate issue date
      - `expiry_date` (date) - Certificate expiry date (null if no expiry)
      - `certificate_pdf_url` (text) - URL to generated PDF in storage
      - `status` (text) - issued, revoked, expired
      - `revoked_at` (timestamptz) - When certificate was revoked
      - `revoked_reason` (text) - Reason for revocation
      - `sent_at` (timestamptz) - When certificate was emailed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `certificate_verification_log`
      - `id` (uuid, primary key)
      - `certificate_number` (text) - Certificate number searched
      - `certificate_id` (uuid, foreign key) - Links to certificates if found
      - `ip_address` (text) - IP of requester
      - `verified_at` (timestamptz) - When verification occurred
      - `result` (text) - valid, invalid, revoked, expired

  2. Table Modifications
    - Add `course_type_id` to `bookings` table
    - Add `passed` to `booking_candidates` table

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
    - Add public read policy for certificate verification
*/

-- Course Types table
CREATE TABLE IF NOT EXISTS course_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  trainer_type_id uuid REFERENCES trainer_types(id) ON DELETE SET NULL,
  description text DEFAULT '',
  duration_days integer DEFAULT 1,
  certificate_validity_months integer,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE course_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read course_types"
  ON course_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert course_types"
  ON course_types FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update course_types"
  ON course_types FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete course_types"
  ON course_types FOR DELETE
  TO authenticated
  USING (true);

-- Certificate Templates table
CREATE TABLE IF NOT EXISTS certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_type_id uuid REFERENCES course_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  background_image_url text DEFAULT '',
  page_width integer DEFAULT 1754,
  page_height integer DEFAULT 1240,
  fields_config jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read certificate_templates"
  ON certificate_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert certificate_templates"
  ON certificate_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update certificate_templates"
  ON certificate_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete certificate_templates"
  ON certificate_templates FOR DELETE
  TO authenticated
  USING (true);

-- Certificates table
CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text NOT NULL UNIQUE,
  course_type_id uuid REFERENCES course_types(id) ON DELETE RESTRICT,
  booking_id uuid REFERENCES bookings(id) ON DELETE RESTRICT,
  candidate_id uuid REFERENCES booking_candidates(id) ON DELETE RESTRICT,
  candidate_name text NOT NULL,
  candidate_email text DEFAULT '',
  trainer_id uuid REFERENCES trainers(id) ON DELETE SET NULL,
  trainer_name text DEFAULT '',
  course_date_start date NOT NULL,
  course_date_end date NOT NULL,
  issue_date date DEFAULT CURRENT_DATE,
  expiry_date date,
  certificate_pdf_url text DEFAULT '',
  status text DEFAULT 'issued',
  revoked_at timestamptz,
  revoked_reason text DEFAULT '',
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read certificates"
  ON certificates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public can read non-revoked certificates for verification"
  ON certificates FOR SELECT
  TO anon
  USING (status != 'revoked');

CREATE POLICY "Authenticated users can insert certificates"
  ON certificates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update certificates"
  ON certificates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete certificates"
  ON certificates FOR DELETE
  TO authenticated
  USING (true);

-- Certificate Verification Log table
CREATE TABLE IF NOT EXISTS certificate_verification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text NOT NULL,
  certificate_id uuid REFERENCES certificates(id) ON DELETE SET NULL,
  ip_address text DEFAULT '',
  verified_at timestamptz DEFAULT now(),
  result text NOT NULL
);

ALTER TABLE certificate_verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read certificate_verification_log"
  ON certificate_verification_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public can insert verification logs"
  ON certificate_verification_log FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert verification logs"
  ON certificate_verification_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add course_type_id to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'course_type_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN course_type_id uuid REFERENCES course_types(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add passed to booking_candidates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_candidates' AND column_name = 'passed'
  ) THEN
    ALTER TABLE booking_candidates ADD COLUMN passed boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_course_types_trainer_type_id ON course_types(trainer_type_id);
CREATE INDEX IF NOT EXISTS idx_certificate_templates_course_type_id ON certificate_templates(course_type_id);
CREATE INDEX IF NOT EXISTS idx_certificates_certificate_number ON certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_course_type_id ON certificates(course_type_id);
CREATE INDEX IF NOT EXISTS idx_certificates_booking_id ON certificates(booking_id);
CREATE INDEX IF NOT EXISTS idx_certificates_candidate_id ON certificates(candidate_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_issue_date ON certificates(issue_date);
CREATE INDEX IF NOT EXISTS idx_verification_log_certificate_number ON certificate_verification_log(certificate_number);

-- Insert default course types
INSERT INTO course_types (name, code, description, duration_days, certificate_validity_months, sort_order, active)
VALUES
  ('Forklift Training', 'FLT', 'Forklift operator certification and training', 3, 36, 1, true),
  ('First Aid', 'FA', 'First Aid at Work certification', 3, 36, 2, true),
  ('Mental Health First Aid', 'MHFA', 'Mental Health First Aid certification', 2, 36, 3, true),
  ('CPC Driver Training', 'CPC', 'Certificate of Professional Competence for drivers', 1, 60, 4, true),
  ('Manual Handling', 'MH', 'Manual Handling Equipment training', 1, 36, 5, true)
ON CONFLICT (code) DO NOTHING;