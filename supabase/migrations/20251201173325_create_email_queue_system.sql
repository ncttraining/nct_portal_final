/*
  # Create Email Queue System

  1. New Tables
    - `email_queue`
      - `id` (uuid, primary key) - Unique identifier for queued email
      - `recipient_email` (text) - Email address of recipient
      - `recipient_name` (text, nullable) - Name of recipient for display
      - `subject` (text) - Email subject line
      - `html_body` (text) - HTML email content
      - `text_body` (text, nullable) - Plain text email content
      - `template_key` (text, nullable) - Email template identifier if template-based
      - `template_data` (jsonb, nullable) - Template variables
      - `attachments` (jsonb, nullable) - Array of attachment objects {url, filename}
      - `status` (text) - Email status: pending, processing, sent, failed, cancelled
      - `priority` (integer, default 5) - Priority level (1-10, lower = higher priority)
      - `attempts` (integer, default 0) - Number of send attempts
      - `max_attempts` (integer, default 3) - Maximum retry attempts
      - `error_message` (text, nullable) - Error details if failed
      - `scheduled_at` (timestamptz, default now) - When to send the email
      - `processing_started_at` (timestamptz, nullable) - When processing started
      - `sent_at` (timestamptz, nullable) - When successfully sent
      - `created_at` (timestamptz, default now) - When queued
      - `updated_at` (timestamptz, default now) - Last updated
      - `created_by_user_id` (uuid, nullable) - User who created the email

  2. Indexes
    - Composite index on (status, priority, scheduled_at) for efficient queue processing
    - Index on recipient_email for searching
    - Index on template_key for filtering
    - Index on created_at for date queries and cleanup
    - Index on created_by_user_id for user tracking

  3. Security
    - Enable RLS on email_queue table
    - Admin users can view all emails
    - Non-admin users can only view emails they created
    - Service role has full access for worker

  4. Functions
    - Trigger to update updated_at timestamp
*/

-- Create email_queue table
CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  template_key text,
  template_data jsonb,
  attachments jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  priority integer NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error_message text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_processing 
  ON email_queue(status, priority, scheduled_at) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_email_queue_recipient 
  ON email_queue(recipient_email);

CREATE INDEX IF NOT EXISTS idx_email_queue_template 
  ON email_queue(template_key) 
  WHERE template_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_queue_created 
  ON email_queue(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_queue_user 
  ON email_queue(created_by_user_id) 
  WHERE created_by_user_id IS NOT NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS email_queue_updated_at ON email_queue;
CREATE TRIGGER email_queue_updated_at
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_email_queue_updated_at();

-- Enable RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all emails
CREATE POLICY "Admins can view all emails"
  ON email_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Users can view their own emails
CREATE POLICY "Users can view own emails"
  ON email_queue
  FOR SELECT
  TO authenticated
  USING (created_by_user_id = auth.uid());

-- Policy: Admins can insert emails
CREATE POLICY "Admins can insert emails"
  ON email_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Users can insert their own emails
CREATE POLICY "Users can insert own emails"
  ON email_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

-- Policy: Admins can update emails
CREATE POLICY "Admins can update emails"
  ON email_queue
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Users can update their own pending/failed emails (for retry/cancel)
CREATE POLICY "Users can update own pending emails"
  ON email_queue
  FOR UPDATE
  TO authenticated
  USING (
    created_by_user_id = auth.uid() 
    AND status IN ('pending', 'failed')
  )
  WITH CHECK (
    created_by_user_id = auth.uid() 
    AND status IN ('pending', 'failed', 'cancelled')
  );

-- Create statistics view for monitoring
CREATE OR REPLACE VIEW email_queue_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
  COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
  COUNT(*) as total_count,
  MAX(sent_at) as last_sent_at,
  MAX(processing_started_at) as last_processing_at
FROM email_queue
WHERE created_at > now() - interval '7 days';

-- Grant access to the view
GRANT SELECT ON email_queue_stats TO authenticated;