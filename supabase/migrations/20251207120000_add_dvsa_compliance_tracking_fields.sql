-- Stage 3: DVSA Compliance Tracking - Database Schema Changes
-- This migration adds fields for register management, attendance tracking, and DVSA upload status

-- ============================================================================
-- 1. Add new columns to open_course_delegates table
-- ============================================================================

-- Driver licence number (CPC courses only, manually entered by trainer/admin)
ALTER TABLE open_course_delegates
ADD COLUMN IF NOT EXISTS driver_number TEXT;

-- Single select licence category
ALTER TABLE open_course_delegates
ADD COLUMN IF NOT EXISTS licence_category TEXT;

-- ID verification type
ALTER TABLE open_course_delegates
ADD COLUMN IF NOT EXISTS id_type TEXT;

-- ID verification confirmed by trainer
ALTER TABLE open_course_delegates
ADD COLUMN IF NOT EXISTS id_checked BOOLEAN DEFAULT FALSE;

-- Detailed attendance status for session (attended/absent/late/left_early)
ALTER TABLE open_course_delegates
ADD COLUMN IF NOT EXISTS attendance_detail TEXT;

-- Additional comments/notes per delegate per session
ALTER TABLE open_course_delegates
ADD COLUMN IF NOT EXISTS additional_comments TEXT;

-- DVSA R&E Upload tracking (admin only, for CPC courses)
ALTER TABLE open_course_delegates
ADD COLUMN IF NOT EXISTS dvsa_uploaded BOOLEAN DEFAULT FALSE;

ALTER TABLE open_course_delegates
ADD COLUMN IF NOT EXISTS dvsa_uploaded_at TIMESTAMPTZ;

ALTER TABLE open_course_delegates
ADD COLUMN IF NOT EXISTS dvsa_uploaded_by UUID REFERENCES auth.users(id);

-- Track who marked attendance
ALTER TABLE open_course_delegates
ADD COLUMN IF NOT EXISTS attendance_marked_by UUID REFERENCES auth.users(id);

-- ============================================================================
-- 2. Add constraints for enum-like fields
-- ============================================================================

-- Licence category constraint (C, CE, C1, C1E, D, DE, D1, D1E, C+E, D+E)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'open_course_delegates_licence_category_check'
  ) THEN
    ALTER TABLE open_course_delegates
    ADD CONSTRAINT open_course_delegates_licence_category_check
    CHECK (licence_category IS NULL OR licence_category IN ('C', 'CE', 'C1', 'C1E', 'D', 'DE', 'D1', 'D1E', 'C+E', 'D+E'));
  END IF;
END $$;

-- ID type constraint (NONE, DL, DQC, Digitaco, Passport, Other)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'open_course_delegates_id_type_check'
  ) THEN
    ALTER TABLE open_course_delegates
    ADD CONSTRAINT open_course_delegates_id_type_check
    CHECK (id_type IS NULL OR id_type IN ('NONE', 'DL', 'DQC', 'Digitaco', 'Passport', 'Other'));
  END IF;
END $$;

-- Attendance detail constraint (attended/absent/late/left_early)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'open_course_delegates_attendance_detail_check'
  ) THEN
    ALTER TABLE open_course_delegates
    ADD CONSTRAINT open_course_delegates_attendance_detail_check
    CHECK (attendance_detail IS NULL OR attendance_detail IN ('attended', 'absent', 'late', 'left_early'));
  END IF;
END $$;

-- ============================================================================
-- 3. Add new columns to open_course_sessions table
-- ============================================================================

-- Trainer declaration: confirms licence/identity checks and course delivery
ALTER TABLE open_course_sessions
ADD COLUMN IF NOT EXISTS trainer_declaration_signed BOOLEAN DEFAULT FALSE;

ALTER TABLE open_course_sessions
ADD COLUMN IF NOT EXISTS trainer_declaration_at TIMESTAMPTZ;

ALTER TABLE open_course_sessions
ADD COLUMN IF NOT EXISTS trainer_declaration_by UUID REFERENCES auth.users(id);

-- Break time field for session schedule
ALTER TABLE open_course_sessions
ADD COLUMN IF NOT EXISTS break_time TEXT;

-- ============================================================================
-- 4. Add JAUPT code to course_types table (for CPC course identification)
-- ============================================================================

ALTER TABLE course_types
ADD COLUMN IF NOT EXISTS jaupt_code TEXT;

-- Add comment for documentation
COMMENT ON COLUMN course_types.jaupt_code IS 'JAUPT accreditation code for CPC Driver Training courses (e.g., iCRS30158/2364)';

-- ============================================================================
-- 5. Create indexes for performance
-- ============================================================================

-- Index for filtering delegates by session
CREATE INDEX IF NOT EXISTS idx_open_course_delegates_session_id
ON open_course_delegates(session_id);

-- Index for filtering delegates by attendance detail
CREATE INDEX IF NOT EXISTS idx_open_course_delegates_attendance_detail
ON open_course_delegates(attendance_detail);

-- Index for filtering delegates by DVSA upload status
CREATE INDEX IF NOT EXISTS idx_open_course_delegates_dvsa_uploaded
ON open_course_delegates(dvsa_uploaded);

-- Index for filtering sessions by trainer for register list
CREATE INDEX IF NOT EXISTS idx_open_course_sessions_trainer_id
ON open_course_sessions(trainer_id);

-- Index for filtering sessions by declaration status
CREATE INDEX IF NOT EXISTS idx_open_course_sessions_trainer_declaration_signed
ON open_course_sessions(trainer_declaration_signed);

-- ============================================================================
-- 6. RLS Policies for register access
-- ============================================================================

-- Note: Additional RLS policies may be needed. The existing policies from
-- 20251206000000_add_open_courses_rls_policies.sql should cover basic access.
-- We may need to add trainer-specific policies for their assigned sessions.

-- Policy: Trainers can read their assigned sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Trainers can read their assigned sessions'
    AND tablename = 'open_course_sessions'
  ) THEN
    CREATE POLICY "Trainers can read their assigned sessions"
    ON open_course_sessions FOR SELECT
    USING (
      trainer_id IN (
        SELECT t.id FROM trainers t WHERE t.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
      )
    );
  END IF;
END $$;

-- Policy: Trainers can update their assigned sessions (for declaration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Trainers can update their assigned sessions for declaration'
    AND tablename = 'open_course_sessions'
  ) THEN
    CREATE POLICY "Trainers can update their assigned sessions for declaration"
    ON open_course_sessions FOR UPDATE
    USING (
      trainer_id IN (
        SELECT t.id FROM trainers t WHERE t.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
      )
    );
  END IF;
END $$;

-- Policy: Trainers can read delegates for their sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Trainers can read delegates for their sessions'
    AND tablename = 'open_course_delegates'
  ) THEN
    CREATE POLICY "Trainers can read delegates for their sessions"
    ON open_course_delegates FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM open_course_sessions ocs
        JOIN trainers t ON t.id = ocs.trainer_id
        WHERE ocs.id = open_course_delegates.session_id
        AND t.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
      )
    );
  END IF;
END $$;

-- Policy: Trainers can update delegates for their sessions (attendance, ID check, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Trainers can update delegates for their sessions'
    AND tablename = 'open_course_delegates'
  ) THEN
    CREATE POLICY "Trainers can update delegates for their sessions"
    ON open_course_delegates FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM open_course_sessions ocs
        JOIN trainers t ON t.id = ocs.trainer_id
        WHERE ocs.id = open_course_delegates.session_id
        AND t.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
      )
    );
  END IF;
END $$;

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================

-- Ensure authenticated users can access the new columns
GRANT SELECT, UPDATE ON open_course_delegates TO authenticated;
GRANT SELECT, UPDATE ON open_course_sessions TO authenticated;
GRANT SELECT ON course_types TO authenticated;
