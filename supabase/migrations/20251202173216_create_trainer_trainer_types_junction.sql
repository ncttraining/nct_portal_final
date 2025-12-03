/*
  # Create Trainer-Trainer Types Junction Table

  1. New Tables
    - `trainer_trainer_types`
      - `id` (uuid, primary key) - Unique identifier
      - `trainer_id` (uuid, foreign key to trainers) - Reference to trainer
      - `trainer_type_id` (uuid, foreign key to trainer_types) - Reference to trainer type
      - `created_at` (timestamptz) - When the assignment was created
      - `updated_at` (timestamptz) - When the assignment was last updated
      - Unique constraint on (trainer_id, trainer_type_id) to prevent duplicates

  2. Indexes
    - Index on `trainer_id` for fast lookups of trainer's types
    - Index on `trainer_type_id` for fast lookups of trainers by type

  3. Views
    - `trainer_available_course_types` - Shows all course types available to each trainer

  4. Functions
    - `is_trainer_qualified_for_course` - Check if trainer can teach a course type
    - `check_trainer_type_has_future_bookings` - Check if removing type would affect future bookings

  5. Security
    - Enable RLS on `trainer_trainer_types` table
    - Add policies for authenticated users to manage trainer type assignments
*/

-- Create the junction table
CREATE TABLE IF NOT EXISTS trainer_trainer_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  trainer_type_id uuid NOT NULL REFERENCES trainer_types(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(trainer_id, trainer_type_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trainer_trainer_types_trainer_id ON trainer_trainer_types(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_trainer_types_trainer_type_id ON trainer_trainer_types(trainer_type_id);

-- Enable Row Level Security
ALTER TABLE trainer_trainer_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
CREATE POLICY "Authenticated users can read trainer_trainer_types"
  ON trainer_trainer_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert trainer_trainer_types"
  ON trainer_trainer_types
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update trainer_trainer_types"
  ON trainer_trainer_types
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete trainer_trainer_types"
  ON trainer_trainer_types
  FOR DELETE
  TO authenticated
  USING (true);

-- Create view for trainer available course types
CREATE OR REPLACE VIEW trainer_available_course_types AS
SELECT DISTINCT
  ttt.trainer_id,
  ct.id as course_type_id,
  ct.name as course_type_name,
  ct.code as course_type_code,
  ct.trainer_type_id,
  tt.name as trainer_type_name
FROM trainer_trainer_types ttt
JOIN trainer_types tt ON ttt.trainer_type_id = tt.id
JOIN course_types ct ON ct.trainer_type_id = tt.id
WHERE ct.active = true;

-- Create function to check if trainer is qualified for a course type
CREATE OR REPLACE FUNCTION is_trainer_qualified_for_course(
  p_trainer_id uuid,
  p_course_type_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_required_trainer_type_id uuid;
  v_is_qualified boolean;
BEGIN
  -- Get the required trainer type for the course
  SELECT trainer_type_id INTO v_required_trainer_type_id
  FROM course_types
  WHERE id = p_course_type_id;

  -- If course type doesn't require a specific trainer type, allow it
  IF v_required_trainer_type_id IS NULL THEN
    RETURN true;
  END IF;

  -- Check if trainer has the required trainer type
  SELECT EXISTS(
    SELECT 1
    FROM trainer_trainer_types
    WHERE trainer_id = p_trainer_id
    AND trainer_type_id = v_required_trainer_type_id
  ) INTO v_is_qualified;

  RETURN v_is_qualified;
END;
$$;

-- Create function to check if trainer type has future bookings
CREATE OR REPLACE FUNCTION check_trainer_type_has_future_bookings(
  p_trainer_id uuid,
  p_trainer_type_id uuid
)
RETURNS TABLE(
  booking_count bigint,
  earliest_booking_date date,
  latest_booking_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as booking_count,
    MIN(b.booking_date) as earliest_booking_date,
    MAX(b.booking_date) as latest_booking_date
  FROM bookings b
  JOIN course_types ct ON b.course_type_id = ct.id
  WHERE b.trainer_id = p_trainer_id
    AND ct.trainer_type_id = p_trainer_type_id
    AND b.booking_date >= CURRENT_DATE
    AND b.status != 'cancelled';
END;
$$;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_trainer_trainer_types_updated_at ON trainer_trainer_types;
CREATE TRIGGER update_trainer_trainer_types_updated_at
  BEFORE UPDATE ON trainer_trainer_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
