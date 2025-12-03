/*
  # Cleanup orphaned auth user
  
  This migration removes the orphaned auth user conrad@nationalcompliancetraining.co.uk
  who exists in auth.users but not in public.users table.
  
  This is a one-time cleanup operation.
*/

-- Create a temporary admin function to delete the auth user
CREATE OR REPLACE FUNCTION delete_auth_user_by_id(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function has elevated privileges to delete from auth schema
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- Delete the orphaned user
SELECT delete_auth_user_by_id('03c33614-5e9f-477b-8451-6729ba5b358b');

-- Drop the temporary function
DROP FUNCTION IF EXISTS delete_auth_user_by_id(uuid);
