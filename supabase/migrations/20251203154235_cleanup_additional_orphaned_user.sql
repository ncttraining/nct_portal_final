/*
  # Cleanup additional orphaned auth user
  
  This migration removes the orphaned auth user accoutns@natioanlcompliancetraining.co.uk
  who exists in auth.users but not in public.users table.
  
  This is causing authorization errors when this user tries to perform actions.
*/

-- Create a temporary admin function to delete the auth user
CREATE OR REPLACE FUNCTION delete_auth_user_by_id(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- Delete the orphaned user
SELECT delete_auth_user_by_id('988823a7-2914-4871-9387-49d3be10b792');

-- Drop the temporary function
DROP FUNCTION IF EXISTS delete_auth_user_by_id(uuid);
