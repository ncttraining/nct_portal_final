-- Flexible trainer type system with custom attributes
-- Run this SQL in your Supabase SQL Editor

-- Drop old tables if they exist
DROP TABLE IF EXISTS trainer_types CASCADE;
DROP TABLE IF EXISTS trainer_type_categories CASCADE;

-- 1. Trainer Types (e.g., MHE, First Aid, DCPC, etc.)
CREATE TABLE IF NOT EXISTS trainer_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Attribute Definitions (custom fields per trainer type)
CREATE TABLE IF NOT EXISTS trainer_type_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_type_id uuid NOT NULL REFERENCES trainer_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'date', 'number', 'multiselect', 'file')),
  is_required boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(trainer_type_id, name)
);

-- 3. Attribute Options (for multiselect fields)
CREATE TABLE IF NOT EXISTS trainer_attribute_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES trainer_type_attributes(id) ON DELETE CASCADE,
  category text DEFAULT '',
  code text NOT NULL,
  label text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Update trainers table to reference trainer type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainers' AND column_name = 'trainer_type_id'
  ) THEN
    ALTER TABLE trainers ADD COLUMN trainer_type_id uuid REFERENCES trainer_types(id);
  END IF;
END $$;

-- 5. Trainer Attribute Values (stores actual data)
CREATE TABLE IF NOT EXISTS trainer_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  attribute_id uuid NOT NULL REFERENCES trainer_type_attributes(id) ON DELETE CASCADE,
  value_text text,
  value_date date,
  value_number numeric(10,2),
  value_array text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(trainer_id, attribute_id)
);

-- Enable Row Level Security
ALTER TABLE trainer_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_type_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_attribute_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anonymous users (internal tool)
CREATE POLICY "Anonymous users can read trainer types"
  ON trainer_types FOR SELECT TO anon USING (true);
CREATE POLICY "Anonymous users can insert trainer types"
  ON trainer_types FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anonymous users can update trainer types"
  ON trainer_types FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anonymous users can delete trainer types"
  ON trainer_types FOR DELETE TO anon USING (true);

CREATE POLICY "Anonymous users can read attributes"
  ON trainer_type_attributes FOR SELECT TO anon USING (true);
CREATE POLICY "Anonymous users can insert attributes"
  ON trainer_type_attributes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anonymous users can update attributes"
  ON trainer_type_attributes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anonymous users can delete attributes"
  ON trainer_type_attributes FOR DELETE TO anon USING (true);

CREATE POLICY "Anonymous users can read attribute options"
  ON trainer_attribute_options FOR SELECT TO anon USING (true);
CREATE POLICY "Anonymous users can insert attribute options"
  ON trainer_attribute_options FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anonymous users can update attribute options"
  ON trainer_attribute_options FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anonymous users can delete attribute options"
  ON trainer_attribute_options FOR DELETE TO anon USING (true);

CREATE POLICY "Anonymous users can read attribute values"
  ON trainer_attribute_values FOR SELECT TO anon USING (true);
CREATE POLICY "Anonymous users can insert attribute values"
  ON trainer_attribute_values FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anonymous users can update attribute values"
  ON trainer_attribute_values FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anonymous users can delete attribute values"
  ON trainer_attribute_values FOR DELETE TO anon USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trainer_type_attributes_type ON trainer_type_attributes(trainer_type_id);
CREATE INDEX IF NOT EXISTS idx_attribute_options_attribute ON trainer_attribute_options(attribute_id);
CREATE INDEX IF NOT EXISTS idx_attribute_values_trainer ON trainer_attribute_values(trainer_id);
CREATE INDEX IF NOT EXISTS idx_attribute_values_attribute ON trainer_attribute_values(attribute_id);
CREATE INDEX IF NOT EXISTS idx_trainers_type ON trainers(trainer_type_id);

-- Seed data: MHE Trainer Type
INSERT INTO trainer_types (name, description, sort_order) VALUES
  ('MHE Trainer', 'Materials Handling Equipment (RTITB) trainers', 1),
  ('First Aid Trainer', 'First Aid at Work and Emergency First Aid trainers', 2)
ON CONFLICT (name) DO NOTHING;

-- Get the MHE trainer type ID
DO $$
DECLARE
  mhe_type_id uuid;
  firstaid_type_id uuid;
  rtitb_attr_id uuid;
  insurance_attr_id uuid;
  trucks_attr_id uuid;
  faw_cert_attr_id uuid;
  efaw_cert_attr_id uuid;
BEGIN
  SELECT id INTO mhe_type_id FROM trainer_types WHERE name = 'MHE Trainer';
  SELECT id INTO firstaid_type_id FROM trainer_types WHERE name = 'First Aid Trainer';

  -- MHE Trainer Attributes
  INSERT INTO trainer_type_attributes (trainer_type_id, name, label, field_type, is_required, sort_order) VALUES
    (mhe_type_id, 'rtitb_number', 'RTITB Number', 'text', false, 1),
    (mhe_type_id, 'rtitb_expiry', 'RTITB Expiry', 'date', false, 2),
    (mhe_type_id, 'insurance_expiry', 'Insurance Expiry', 'date', false, 3),
    (mhe_type_id, 'truck_types', 'Truck Types', 'multiselect', false, 4)
  ON CONFLICT (trainer_type_id, name) DO NOTHING;

  -- First Aid Trainer Attributes
  INSERT INTO trainer_type_attributes (trainer_type_id, name, label, field_type, is_required, sort_order) VALUES
    (firstaid_type_id, 'faw_cert_number', 'FAW Certificate Number', 'text', false, 1),
    (firstaid_type_id, 'faw_expiry', 'FAW Expiry', 'date', false, 2),
    (firstaid_type_id, 'efaw_cert_number', 'EFAW Certificate Number', 'text', false, 3),
    (firstaid_type_id, 'efaw_expiry', 'EFAW Expiry', 'date', false, 4),
    (firstaid_type_id, 'insurance_expiry', 'Insurance Expiry', 'date', false, 5)
  ON CONFLICT (trainer_type_id, name) DO NOTHING;

  -- Get the truck_types attribute ID for MHE
  SELECT id INTO trucks_attr_id
  FROM trainer_type_attributes
  WHERE trainer_type_id = mhe_type_id AND name = 'truck_types';

  -- Seed MHE truck type options
  IF trucks_attr_id IS NOT NULL THEN
    INSERT INTO trainer_attribute_options (attribute_id, category, code, label, sort_order) VALUES
      (trucks_attr_id, 'Counterbalance lift trucks', 'B1', 'B1 - Counterbalance up to 5T', 1),
      (trucks_attr_id, 'Counterbalance lift trucks', 'B2', 'B2 - Counterbalance 5–15T', 2),
      (trucks_attr_id, 'Counterbalance lift trucks', 'B3', 'B3 - Counterbalance over 15T', 3),
      (trucks_attr_id, 'Counterbalance lift trucks', 'B4', 'B4 - Stand-on counterbalance', 4),
      (trucks_attr_id, 'Reach trucks', 'D1', 'D1 - Reach truck (basic)', 5),
      (trucks_attr_id, 'Reach trucks', 'D2', 'D2 - Reach truck (high bay)', 6),
      (trucks_attr_id, 'Pivot steer / articulated', 'P1', 'P1 - Pivot steer up to 5T', 7),
      (trucks_attr_id, 'Pivot steer / articulated', 'P2', 'P2 - Pivot steer above 5T', 8),
      (trucks_attr_id, 'Pallet & low-level MHE', 'A1', 'A1 - Powered pallet (rider)', 9),
      (trucks_attr_id, 'Pallet & low-level MHE', 'A2', 'A2 - Powered pallet (pedestrian)', 10),
      (trucks_attr_id, 'Pallet & low-level MHE', 'A3', 'A3 - Rider pallet stacker', 11),
      (trucks_attr_id, 'Pallet & low-level MHE', 'A4', 'A4 - Pedestrian pallet stacker', 12),
      (trucks_attr_id, 'Order pickers', 'LLOP', 'LLOP - Low level order picker', 13),
      (trucks_attr_id, 'Order pickers', 'MOP', 'MOP - Medium level order picker', 14),
      (trucks_attr_id, 'Order pickers', 'HLOP', 'HLOP - High level order picker', 15),
      (trucks_attr_id, 'VNA (very narrow aisle)', 'V1', 'V1 - VNA man-down', 16),
      (trucks_attr_id, 'VNA (very narrow aisle)', 'V2', 'V2 - VNA man-up', 17),
      (trucks_attr_id, 'Other / specialist', 'RTM', 'RTM - Rough terrain masted', 18),
      (trucks_attr_id, 'Other / specialist', 'RTT', 'RTT - Rough terrain telescopic', 19),
      (trucks_attr_id, 'Other / specialist', 'MDT', 'MDT - Multi-directional truck', 20),
      (trucks_attr_id, 'Other / specialist', 'SL', 'SL - Side loader', 21)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
