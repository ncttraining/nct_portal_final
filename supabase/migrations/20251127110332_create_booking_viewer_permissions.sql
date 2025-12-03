/*
  # Create Booking Viewer Permission System

  1. New Tables
    - `user_capabilities` - Stores user-level capability flags
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `capability_type` (text, e.g., 'view_bookings')
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - UNIQUE constraint on (user_id, capability_type)

    - `user_trainer_permissions` - Individual trainer viewing permissions
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `trainer_id` (uuid, foreign key to trainers)
      - `can_receive_notifications` (boolean)
      - `created_at` (timestamptz)
      - UNIQUE constraint on (user_id, trainer_id)

    - `user_trainer_type_permissions` - Trainer type-based viewing permissions
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `trainer_type_id` (uuid, foreign key to trainer_types)
      - `can_receive_notifications` (boolean)
      - `created_at` (timestamptz)
      - UNIQUE constraint on (user_id, trainer_type_id)

  2. Schema Changes
    - Add `can_view_bookings` column to users table

  3. Security
    - Enable RLS on all new tables
    - Users can read their own permissions
    - Admins can manage all permissions
    - Create helper function to get authorized trainers for a user

  4. Important Notes
    - Permissions are additive (individual + type-based)
    - Notification preferences are per-trainer and per-trainer-type
    - Users need can_view_bookings = true to access any bookings
*/

-- Add can_view_bookings field to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'can_view_bookings'
  ) THEN
    ALTER TABLE users ADD COLUMN can_view_bookings boolean DEFAULT false;
  END IF;
END $$;

-- Create user_capabilities table
CREATE TABLE IF NOT EXISTS user_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability_type text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, capability_type)
);

-- Create user_trainer_permissions table
CREATE TABLE IF NOT EXISTS user_trainer_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  can_receive_notifications boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, trainer_id)
);

-- Create user_trainer_type_permissions table
CREATE TABLE IF NOT EXISTS user_trainer_type_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trainer_type_id uuid NOT NULL REFERENCES trainer_types(id) ON DELETE CASCADE,
  can_receive_notifications boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, trainer_type_id)
);

-- Enable RLS
ALTER TABLE user_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trainer_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trainer_type_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_capabilities
CREATE POLICY "Users can read own capabilities"
  ON user_capabilities
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all capabilities"
  ON user_capabilities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert capabilities"
  ON user_capabilities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update capabilities"
  ON user_capabilities
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete capabilities"
  ON user_capabilities
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for user_trainer_permissions
CREATE POLICY "Users can read own trainer permissions"
  ON user_trainer_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all trainer permissions"
  ON user_trainer_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert trainer permissions"
  ON user_trainer_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update trainer permissions"
  ON user_trainer_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete trainer permissions"
  ON user_trainer_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for user_trainer_type_permissions
CREATE POLICY "Users can read own trainer type permissions"
  ON user_trainer_type_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all trainer type permissions"
  ON user_trainer_type_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert trainer type permissions"
  ON user_trainer_type_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update trainer type permissions"
  ON user_trainer_type_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete trainer type permissions"
  ON user_trainer_type_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_capabilities_user_id ON user_capabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_capabilities_type ON user_capabilities(capability_type);
CREATE INDEX IF NOT EXISTS idx_user_trainer_permissions_user_id ON user_trainer_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trainer_permissions_trainer_id ON user_trainer_permissions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_user_trainer_type_permissions_user_id ON user_trainer_type_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trainer_type_permissions_type_id ON user_trainer_type_permissions(trainer_type_id);

-- Helper function to get all authorized trainer IDs for a user
CREATE OR REPLACE FUNCTION get_user_authorized_trainers(p_user_id uuid)
RETURNS TABLE(trainer_id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT t.id
  FROM trainers t
  WHERE
    -- Individual trainer permissions
    t.id IN (
      SELECT utp.trainer_id
      FROM user_trainer_permissions utp
      WHERE utp.user_id = p_user_id
    )
    OR
    -- Trainer type permissions
    t.trainer_type_id IN (
      SELECT uttp.trainer_type_id
      FROM user_trainer_type_permissions uttp
      WHERE uttp.user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has booking view capability
CREATE OR REPLACE FUNCTION user_has_booking_view_capability(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
    AND can_view_bookings = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;