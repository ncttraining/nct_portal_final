-- After creating the user in Supabase Dashboard, run this to make them an admin:
-- Replace 'USER_ID_HERE' with the actual user ID from auth.users

UPDATE users
SET
  role = 'admin',
  can_manage_users = true,
  full_name = 'Rob'
WHERE email = 'rob@nationalcompliancetraining.co.uk';
