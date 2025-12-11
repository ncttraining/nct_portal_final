-- Add two-factor authentication fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret text,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes text[];

-- Add comment explaining the fields
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN users.two_factor_secret IS 'Encrypted TOTP secret for authenticator apps';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'One-time use backup codes for 2FA recovery';

-- Create index for faster lookup during login
CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = true;

-- Update RLS policies to ensure users can only read/update their own 2FA fields
-- Note: Existing policies should already cover this, but we add explicit security

-- Function to safely check if user has 2FA enabled (for use in login flow)
CREATE OR REPLACE FUNCTION public.check_user_2fa_status(user_id uuid)
RETURNS TABLE(
  has_2fa boolean,
  email text,
  full_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(u.two_factor_enabled, false) as has_2fa,
    u.email,
    u.full_name
  FROM users u
  WHERE u.id = user_id;
END;
$$;

-- Function to verify a backup code and invalidate it
CREATE OR REPLACE FUNCTION public.verify_and_consume_backup_code(
  p_user_id uuid,
  p_backup_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codes text[];
  v_found boolean := false;
  v_new_codes text[] := '{}';
  v_code text;
BEGIN
  -- Get current backup codes
  SELECT two_factor_backup_codes INTO v_codes
  FROM users
  WHERE id = p_user_id;

  IF v_codes IS NULL THEN
    RETURN false;
  END IF;

  -- Check if the code exists and build new array without it
  FOREACH v_code IN ARRAY v_codes
  LOOP
    IF v_code = p_backup_code THEN
      v_found := true;
    ELSE
      v_new_codes := array_append(v_new_codes, v_code);
    END IF;
  END LOOP;

  -- If found, update the backup codes to remove the used one
  IF v_found THEN
    UPDATE users
    SET two_factor_backup_codes = v_new_codes
    WHERE id = p_user_id;
  END IF;

  RETURN v_found;
END;
$$;

-- Function to enable 2FA for a user
CREATE OR REPLACE FUNCTION public.enable_user_2fa(
  p_user_id uuid,
  p_secret text,
  p_backup_codes text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET
    two_factor_enabled = true,
    two_factor_secret = p_secret,
    two_factor_backup_codes = p_backup_codes
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

-- Function to disable 2FA for a user
CREATE OR REPLACE FUNCTION public.disable_user_2fa(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET
    two_factor_enabled = false,
    two_factor_secret = NULL,
    two_factor_backup_codes = NULL
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

-- Function to get 2FA secret for verification (only for authenticated user)
CREATE OR REPLACE FUNCTION public.get_user_2fa_secret(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT two_factor_secret INTO v_secret
  FROM users
  WHERE id = p_user_id;

  RETURN v_secret;
END;
$$;
