/*
  # Add RLS Policies for Open Courses Tables

  1. Enable RLS on all open_course tables
  2. Add policies for authenticated users with booking management permissions

  Tables:
  - venues
  - open_course_sessions
  - open_course_orders
  - open_course_delegates
  - open_course_capacity_alerts
  - open_course_sync_log
*/

-- Enable RLS on venues table
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read venues"
  ON venues FOR SELECT
  TO authenticated
  USING (true);

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

CREATE POLICY "Booking managers can update venues"
  ON venues FOR UPDATE
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

-- Enable RLS on open_course_sessions table
ALTER TABLE open_course_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read open_course_sessions"
  ON open_course_sessions FOR SELECT
  TO authenticated
  USING (true);

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

CREATE POLICY "Booking managers can update open_course_sessions"
  ON open_course_sessions FOR UPDATE
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

-- Enable RLS on open_course_orders table
ALTER TABLE open_course_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read open_course_orders"
  ON open_course_orders FOR SELECT
  TO authenticated
  USING (true);

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

-- Enable RLS on open_course_delegates table
ALTER TABLE open_course_delegates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read open_course_delegates"
  ON open_course_delegates FOR SELECT
  TO authenticated
  USING (true);

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

-- Enable RLS on open_course_capacity_alerts table
ALTER TABLE open_course_capacity_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read open_course_capacity_alerts"
  ON open_course_capacity_alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage open_course_capacity_alerts"
  ON open_course_capacity_alerts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable RLS on open_course_sync_log table
ALTER TABLE open_course_sync_log ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "System can insert open_course_sync_log"
  ON open_course_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
