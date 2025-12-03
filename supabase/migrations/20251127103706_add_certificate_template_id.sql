/*
  # Add certificate_template_id to certificates table

  1. Changes
    - Add `certificate_template_id` column to certificates table
    - Add foreign key constraint to certificate_templates table
    - Add course_specific_data column if not exists (for storing certificate field data)

  2. Notes
    - This allows tracking which template was used for each certificate
    - Enables support for multiple templates per course type
*/

-- Add certificate_template_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificates' AND column_name = 'certificate_template_id'
  ) THEN
    ALTER TABLE certificates
    ADD COLUMN certificate_template_id uuid REFERENCES certificate_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add course_specific_data column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificates' AND column_name = 'course_specific_data'
  ) THEN
    ALTER TABLE certificates
    ADD COLUMN course_specific_data jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;