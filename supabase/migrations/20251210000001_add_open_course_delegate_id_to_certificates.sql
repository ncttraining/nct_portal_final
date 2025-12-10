/*
  # Add Open Course Delegate Support to Certificates

  This migration adds support for issuing certificates to open course delegates.

  1. Changes to `certificates` table
    - Add `open_course_delegate_id` column to link certificates to open course delegates
    - Make `booking_id` and `candidate_id` nullable (as open course certs don't have these)
    - Add `open_course_session_id` for reference

  2. Indexes
    - Add index on `open_course_delegate_id` for performance
    - Add index on `open_course_session_id` for performance
*/

-- Add open_course_delegate_id column to certificates table
ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS open_course_delegate_id uuid REFERENCES open_course_delegates(id) ON DELETE SET NULL;

-- Add open_course_session_id column to certificates table
ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS open_course_session_id uuid REFERENCES open_course_sessions(id) ON DELETE SET NULL;

-- Make booking_id and candidate_id nullable (they were already nullable by default in the schema)
-- No change needed as they already allow null

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_certificates_open_course_delegate_id
ON certificates(open_course_delegate_id);

CREATE INDEX IF NOT EXISTS idx_certificates_open_course_session_id
ON certificates(open_course_session_id);

-- Add comment explaining the relationship
COMMENT ON COLUMN certificates.open_course_delegate_id IS 'Reference to open_course_delegates for certificates issued to open course attendees';
COMMENT ON COLUMN certificates.open_course_session_id IS 'Reference to open_course_sessions for certificates issued from open courses';
