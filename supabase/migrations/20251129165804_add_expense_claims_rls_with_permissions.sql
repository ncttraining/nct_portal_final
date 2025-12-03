/*
  # Update expense claims RLS policies with permission checks

  1. Changes
    - Drop existing RLS policies for expense_claims and expense_claim_journeys
    - Add new RLS policies that check user permissions
    - Users with can_manage_expenses permission can only see their own claims
    - Admin users can see all claims regardless of permission
  
  2. Security
    - Authenticated users need can_manage_expenses permission to access their data
    - Admin users have full access to all expense data
    - Non-admin users can only see/modify their own expense claims
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read expense_claims" ON expense_claims;
DROP POLICY IF EXISTS "Authenticated users can insert expense_claims" ON expense_claims;
DROP POLICY IF EXISTS "Authenticated users can update expense_claims" ON expense_claims;
DROP POLICY IF EXISTS "Authenticated users can delete expense_claims" ON expense_claims;

DROP POLICY IF EXISTS "Authenticated users can read expense_claim_journeys" ON expense_claim_journeys;
DROP POLICY IF EXISTS "Authenticated users can insert expense_claim_journeys" ON expense_claim_journeys;
DROP POLICY IF EXISTS "Authenticated users can update expense_claim_journeys" ON expense_claim_journeys;
DROP POLICY IF EXISTS "Authenticated users can delete expense_claim_journeys" ON expense_claim_journeys;

-- Create function to check if user has expenses permission
CREATE OR REPLACE FUNCTION has_expenses_permission()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND (role = 'admin' OR can_manage_expenses = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expense Claims Policies

CREATE POLICY "Users with permission can read own expense claims"
  ON expense_claims FOR SELECT
  TO authenticated
  USING (
    has_expenses_permission() AND (
      is_admin() OR trainer_id = auth.uid()
    )
  );

CREATE POLICY "Users with permission can insert own expense claims"
  ON expense_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    has_expenses_permission() AND trainer_id = auth.uid()
  );

CREATE POLICY "Users with permission can update own expense claims"
  ON expense_claims FOR UPDATE
  TO authenticated
  USING (
    has_expenses_permission() AND (
      (is_admin()) OR 
      (trainer_id = auth.uid() AND status = 'pending')
    )
  )
  WITH CHECK (
    has_expenses_permission() AND (
      (is_admin()) OR 
      (trainer_id = auth.uid() AND status = 'pending')
    )
  );

CREATE POLICY "Users with permission can delete own expense claims"
  ON expense_claims FOR DELETE
  TO authenticated
  USING (
    has_expenses_permission() AND (
      (is_admin()) OR 
      (trainer_id = auth.uid() AND status = 'pending')
    )
  );

-- Expense Claim Journeys Policies

CREATE POLICY "Users with permission can read own expense journeys"
  ON expense_claim_journeys FOR SELECT
  TO authenticated
  USING (
    has_expenses_permission() AND EXISTS (
      SELECT 1 FROM expense_claims
      WHERE expense_claims.id = expense_claim_journeys.expense_claim_id
      AND (is_admin() OR expense_claims.trainer_id = auth.uid())
    )
  );

CREATE POLICY "Users with permission can insert own expense journeys"
  ON expense_claim_journeys FOR INSERT
  TO authenticated
  WITH CHECK (
    has_expenses_permission() AND EXISTS (
      SELECT 1 FROM expense_claims
      WHERE expense_claims.id = expense_claim_journeys.expense_claim_id
      AND expense_claims.trainer_id = auth.uid()
      AND expense_claims.status = 'pending'
    )
  );

CREATE POLICY "Users with permission can update own expense journeys"
  ON expense_claim_journeys FOR UPDATE
  TO authenticated
  USING (
    has_expenses_permission() AND EXISTS (
      SELECT 1 FROM expense_claims
      WHERE expense_claims.id = expense_claim_journeys.expense_claim_id
      AND expense_claims.trainer_id = auth.uid()
      AND expense_claims.status = 'pending'
    )
  )
  WITH CHECK (
    has_expenses_permission() AND EXISTS (
      SELECT 1 FROM expense_claims
      WHERE expense_claims.id = expense_claim_journeys.expense_claim_id
      AND expense_claims.trainer_id = auth.uid()
      AND expense_claims.status = 'pending'
    )
  );

CREATE POLICY "Users with permission can delete own expense journeys"
  ON expense_claim_journeys FOR DELETE
  TO authenticated
  USING (
    has_expenses_permission() AND EXISTS (
      SELECT 1 FROM expense_claims
      WHERE expense_claims.id = expense_claim_journeys.expense_claim_id
      AND expense_claims.trainer_id = auth.uid()
      AND expense_claims.status = 'pending'
    )
  );
