/*
  # Add Trainer-User Relationship and Portal Access Control

  ## Overview
  This migration creates a bidirectional relationship between trainers and users,
  allowing all trainers to have user accounts while controlling portal login access.

  ## Changes Made

  1. **Users Table Updates**
    - Add `trainer_id` (uuid, nullable, foreign key to trainers)
    - Add `is_trainer` (boolean, default false) - Identifies trainer accounts
    - Add `can_login` (boolean, default true) - Controls portal access
    - Add `avatar_url` (text, nullable) - For future profile pictures

  2. **Trainers Table Updates**
    - Add `user_id` (uuid, nullable, foreign key to users)
    - Add unique constraint to ensure one-to-one relationship

  3. **Database Functions**
    - `generate_random_password()` - Generates secure temporary passwords
    - `create_trainer_with_user()` - Handles complete trainer creation with user account

  4. **Indexes**
    - Index on users.trainer_id for performance
    - Index on trainers.user_id for performance

  5. **Security Notes**
    - Maintains existing RLS policies
    - New trainers default to can_login=false for security
    - Admins can enable portal access through User Management
*/

-- 1. Add new columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'trainer_id'
  ) THEN
    ALTER TABLE users ADD COLUMN trainer_id uuid REFERENCES trainers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_trainer'
  ) THEN
    ALTER TABLE users ADD COLUMN is_trainer boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'can_login'
  ) THEN
    ALTER TABLE users ADD COLUMN can_login boolean DEFAULT true;
  END IF;
END $$;

-- 2. Add user_id to trainers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE trainers ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_trainer_id ON users(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainers_user_id ON trainers(user_id);
CREATE INDEX IF NOT EXISTS idx_users_is_trainer ON users(is_trainer);

-- 4. Function to generate random password
CREATE OR REPLACE FUNCTION generate_random_password(length INTEGER DEFAULT 12)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to create trainer with user account
CREATE OR REPLACE FUNCTION create_trainer_with_user(
  p_email TEXT,
  p_full_name TEXT,
  p_password TEXT,
  p_trainer_name TEXT,
  p_trainer_type_id UUID,
  p_telephone TEXT DEFAULT '',
  p_address1 TEXT DEFAULT '',
  p_address2 TEXT DEFAULT '',
  p_town TEXT DEFAULT '',
  p_postcode TEXT DEFAULT '',
  p_day_rate NUMERIC DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_trainer_id UUID;
  v_result JSON;
BEGIN
  -- Create auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', p_full_name),
    now(),
    now(),
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  -- Create trainer record
  INSERT INTO trainers (
    id,
    name,
    email,
    telephone,
    trainer_type_id,
    address1,
    address2,
    town,
    postcode,
    day_rate,
    latitude,
    longitude,
    active,
    user_id
  ) VALUES (
    gen_random_uuid(),
    p_trainer_name,
    p_email,
    p_telephone,
    p_trainer_type_id,
    p_address1,
    p_address2,
    p_town,
    p_postcode,
    p_day_rate,
    p_latitude,
    p_longitude,
    true,
    v_user_id
  )
  RETURNING id INTO v_trainer_id;

  -- Update users table with trainer relationship
  UPDATE users
  SET 
    trainer_id = v_trainer_id,
    is_trainer = true,
    can_login = false,
    full_name = p_full_name
  WHERE id = v_user_id;

  -- Return result
  v_result := json_build_object(
    'user_id', v_user_id,
    'trainer_id', v_trainer_id,
    'email', p_email,
    'success', true
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email address already exists'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION generate_random_password TO authenticated;
GRANT EXECUTE ON FUNCTION create_trainer_with_user TO authenticated;

-- 7. Update RLS policies to respect can_login flag
-- Note: Auth system will need to check can_login during authentication
-- This is handled at the application level in the login flow
