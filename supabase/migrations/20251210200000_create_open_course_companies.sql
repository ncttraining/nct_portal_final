-- Create open_course_companies table
-- This table manages companies that have delegates on open courses

CREATE TABLE IF NOT EXISTS open_course_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  telephone TEXT,
  address1 TEXT,
  address2 TEXT,
  town TEXT,
  postcode TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_open_course_companies_name ON open_course_companies(name);
CREATE INDEX IF NOT EXISTS idx_open_course_companies_active ON open_course_companies(active);

-- Add company_id column to open_course_delegates to link delegates to companies
ALTER TABLE open_course_delegates
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES open_course_companies(id);

-- Add index for company_id on delegates
CREATE INDEX IF NOT EXISTS idx_open_course_delegates_company_id ON open_course_delegates(company_id);

-- Enable RLS
ALTER TABLE open_course_companies ENABLE ROW LEVEL SECURITY;

-- RLS policies for open_course_companies
CREATE POLICY "Allow authenticated users to view open course companies"
  ON open_course_companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow booking managers to manage open course companies"
  ON open_course_companies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'admin' OR users.can_manage_bookings = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'admin' OR users.can_manage_bookings = true)
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_open_course_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_open_course_companies_updated_at
  BEFORE UPDATE ON open_course_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_open_course_companies_updated_at();

-- Create a function to migrate existing delegate_company text to company records
-- This can be run manually if needed to create companies from existing text values
CREATE OR REPLACE FUNCTION migrate_delegate_companies()
RETURNS void AS $$
DECLARE
  company_name TEXT;
  new_company_id UUID;
BEGIN
  -- Get distinct non-null, non-empty company names from delegates
  FOR company_name IN
    SELECT DISTINCT delegate_company
    FROM open_course_delegates
    WHERE delegate_company IS NOT NULL
    AND delegate_company != ''
    AND company_id IS NULL
  LOOP
    -- Check if company already exists
    SELECT id INTO new_company_id
    FROM open_course_companies
    WHERE LOWER(name) = LOWER(company_name)
    LIMIT 1;

    -- Create company if it doesn't exist
    IF new_company_id IS NULL THEN
      INSERT INTO open_course_companies (name)
      VALUES (company_name)
      RETURNING id INTO new_company_id;
    END IF;

    -- Update delegates with this company name to use the company_id
    UPDATE open_course_delegates
    SET company_id = new_company_id
    WHERE LOWER(delegate_company) = LOWER(company_name)
    AND company_id IS NULL;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Comment the function
COMMENT ON FUNCTION migrate_delegate_companies() IS 'Migrates existing delegate_company text values to proper company records. Run SELECT migrate_delegate_companies() to execute.';
