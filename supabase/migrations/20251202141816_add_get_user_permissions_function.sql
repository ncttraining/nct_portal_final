/*
  # Add get_user_permissions Function

  Creates a SECURITY DEFINER function to get user permissions without RLS interference.
  This is needed for Edge Functions using service role key to check permissions.

  ## Changes
  - Create get_user_permissions function that returns can_manage_users flag
  - Function bypasses RLS using SECURITY DEFINER
  - Only returns the specific permission field needed
*/

CREATE OR REPLACE FUNCTION get_user_permissions(user_id uuid)
RETURNS TABLE (can_manage_users boolean) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT u.can_manage_users
  FROM users u
  WHERE u.id = user_id;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION get_user_permissions(uuid) TO authenticated, service_role;
