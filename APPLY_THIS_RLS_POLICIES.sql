-- RLS Policies for Open Courses Tables
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- VENUES TABLE
-- ============================================================================
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read venues" ON venues;
CREATE POLICY "Authenticated users can read venues"
  ON venues FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Booking managers can insert venues" ON venues;
CREATE POLICY "Booking managers can insert venues"
  ON venues FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'admin' OR users.can_manage_bookings = true)
    )
  );

DROP POLICY IF EXISTS "Booking managers can update venues" ON venues;
CREATE POLICY "Booking managers can update venues"
  ON venues FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'admin' OR users.can_manage_bookings = true)
    )
  );

DROP POLICY IF EXISTS "Booking managers can delete venues" ON venues;
CREATE POLICY "Booking managers can delete venues"
  ON venues FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'admin' OR users.can_manage_bookings = true)
    )
  );

-- ============================================================================
-- OPEN_COURSE_SESSIONS TABLE
-- ============================================================================
ALTER TABLE open_course_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read open_course_sessions" ON open_course_sessions;
CREATE POLICY "Authenticated users can read open_course_sessions"
  ON open_course_sessions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Booking managers can insert open_course_sessions" ON open_course_sessions;
CREATE POLICY "Booking managers can insert open_course_sessions"
  ON open_course_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'admin' OR users.can_manage_bookings = true)
    )
  );

DROP POLICY IF EXISTS "Booking managers can update open_course_sessions" ON open_course_sessions;
CREATE POLICY "Booking managers can update open_course_sessions"
  ON open_course_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'admin' OR users.can_manage_bookings = true)
    )
  );

DROP POLICY IF EXISTS "Booking managers can delete open_course_sessions" ON open_course_sessions;
CREATE POLICY "Booking managers can delete open_course_sessions"
  ON open_course_sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'admin' OR users.can_manage_bookings = true)
    )
  );

-- ============================================================================
-- OPEN_COURSE_ORDERS TABLE
-- ============================================================================
ALTER TABLE open_course_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read open_course_orders" ON open_course_orders;
CREATE POLICY "Authenticated users can read open_course_orders"
  ON open_course_orders FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Booking managers can manage open_course_orders" ON open_course_orders;
CREATE POLICY "Booking managers can manage open_course_orders"
  ON open_course_orders FOR ALL
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

-- ============================================================================
-- OPEN_COURSE_DELEGATES TABLE
-- ============================================================================
ALTER TABLE open_course_delegates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read open_course_delegates" ON open_course_delegates;
CREATE POLICY "Authenticated users can read open_course_delegates"
  ON open_course_delegates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Booking managers can manage open_course_delegates" ON open_course_delegates;
CREATE POLICY "Booking managers can manage open_course_delegates"
  ON open_course_delegates FOR ALL
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

-- ============================================================================
-- OPEN_COURSE_CAPACITY_ALERTS TABLE
-- ============================================================================
ALTER TABLE open_course_capacity_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read open_course_capacity_alerts" ON open_course_capacity_alerts;
CREATE POLICY "Authenticated users can read open_course_capacity_alerts"
  ON open_course_capacity_alerts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "System can manage open_course_capacity_alerts" ON open_course_capacity_alerts;
CREATE POLICY "System can manage open_course_capacity_alerts"
  ON open_course_capacity_alerts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- OPEN_COURSE_SYNC_LOG TABLE
-- ============================================================================
ALTER TABLE open_course_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read open_course_sync_log" ON open_course_sync_log;
CREATE POLICY "Admins can read open_course_sync_log"
  ON open_course_sync_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "System can insert open_course_sync_log" ON open_course_sync_log;
CREATE POLICY "System can insert open_course_sync_log"
  ON open_course_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
