-- Create trainer type categories and types tables
-- Run this SQL in your Supabase SQL Editor

-- Create the trainer_type_categories table
CREATE TABLE IF NOT EXISTS trainer_type_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create the trainer_types table
CREATE TABLE IF NOT EXISTS trainer_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES trainer_type_categories(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE trainer_type_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for anonymous users (internal tool)
CREATE POLICY "Anonymous users can read all categories"
  ON trainer_type_categories
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can insert categories"
  ON trainer_type_categories
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can update categories"
  ON trainer_type_categories
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous users can delete categories"
  ON trainer_type_categories
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can read all types"
  ON trainer_types
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can insert types"
  ON trainer_types
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can update types"
  ON trainer_types
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous users can delete types"
  ON trainer_types
  FOR DELETE
  TO anon
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON trainer_type_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_types_category_id ON trainer_types(category_id);
CREATE INDEX IF NOT EXISTS idx_types_sort_order ON trainer_types(sort_order);

-- Seed data with existing categories
INSERT INTO trainer_type_categories (title, subtitle, sort_order) VALUES
  ('Counterbalance lift trucks', 'Rider operated (B-categories)', 1),
  ('Reach trucks', 'D-categories', 2),
  ('Pivot steer / articulated', 'P-categories', 3),
  ('Pallet & low-level MHE', 'A- & L-categories', 4),
  ('Order pickers', 'Low / medium / high level', 5),
  ('VNA (very narrow aisle)', 'Man-up / man-down', 6),
  ('Other / specialist', '', 7)
ON CONFLICT DO NOTHING;

-- Seed data with existing types
-- Note: You'll need to get the category IDs first, so this is a template
-- Run this after the categories are created

DO $$
DECLARE
  cat_counterbalance uuid;
  cat_reach uuid;
  cat_pivot uuid;
  cat_pallet uuid;
  cat_order_picker uuid;
  cat_vna uuid;
  cat_other uuid;
BEGIN
  SELECT id INTO cat_counterbalance FROM trainer_type_categories WHERE title = 'Counterbalance lift trucks';
  SELECT id INTO cat_reach FROM trainer_type_categories WHERE title = 'Reach trucks';
  SELECT id INTO cat_pivot FROM trainer_type_categories WHERE title = 'Pivot steer / articulated';
  SELECT id INTO cat_pallet FROM trainer_type_categories WHERE title = 'Pallet & low-level MHE';
  SELECT id INTO cat_order_picker FROM trainer_type_categories WHERE title = 'Order pickers';
  SELECT id INTO cat_vna FROM trainer_type_categories WHERE title = 'VNA (very narrow aisle)';
  SELECT id INTO cat_other FROM trainer_type_categories WHERE title = 'Other / specialist';

  INSERT INTO trainer_types (category_id, code, name, sort_order) VALUES
    (cat_counterbalance, 'B1', 'Counterbalance up to 5T', 1),
    (cat_counterbalance, 'B2', 'Counterbalance 5–15T', 2),
    (cat_counterbalance, 'B3', 'Counterbalance over 15T', 3),
    (cat_counterbalance, 'B4', 'Stand-on counterbalance', 4),
    (cat_reach, 'D1', 'Reach truck - basic', 1),
    (cat_reach, 'D2', 'Reach truck - high bay', 2),
    (cat_pivot, 'P1', 'Pivot steer up to 5T', 1),
    (cat_pivot, 'P2', 'Pivot steer above 5T', 2),
    (cat_pallet, 'A1', 'Powered pallet - rider', 1),
    (cat_pallet, 'A2', 'Powered pallet - pedestrian', 2),
    (cat_pallet, 'A3', 'Rider pallet stacker', 3),
    (cat_pallet, 'A4', 'Pedestrian pallet stacker', 4),
    (cat_order_picker, 'LLOP', 'Low level order picker', 1),
    (cat_order_picker, 'MOP', 'Medium level order picker', 2),
    (cat_order_picker, 'HLOP', 'High level order picker', 3),
    (cat_vna, 'V1', 'VNA man-down', 1),
    (cat_vna, 'V2', 'VNA man-up', 2),
    (cat_other, 'RTM', 'Rough terrain masted', 1),
    (cat_other, 'RTT', 'Rough terrain telescopic', 2),
    (cat_other, 'MDT', 'Multi-directional truck', 3),
    (cat_other, 'SL', 'Side loader', 4)
  ON CONFLICT DO NOTHING;
END $$;
