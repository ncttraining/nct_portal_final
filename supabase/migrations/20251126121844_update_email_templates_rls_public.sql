/*
  # Update Email Templates RLS for Public Access

  1. Changes
    - Drop existing restrictive RLS policies
    - Add new policies allowing public access for all operations
    
  2. Security
    - Allows public read/write access since this is an internal admin portal
*/

DROP POLICY IF EXISTS "Authenticated users can read email templates" ON email_templates;
DROP POLICY IF EXISTS "Authenticated users can insert email templates" ON email_templates;
DROP POLICY IF EXISTS "Authenticated users can update email templates" ON email_templates;
DROP POLICY IF EXISTS "Authenticated users can delete email templates" ON email_templates;

CREATE POLICY "Allow public read access to email templates"
  ON email_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to email templates"
  ON email_templates
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to email templates"
  ON email_templates
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to email templates"
  ON email_templates
  FOR DELETE
  USING (true);
