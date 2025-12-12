/*
  # Add Resend Tracking to Email Queue

  This migration adds columns to track when emails are resent:

  1. New Columns
    - `resend_count` (integer) - Number of times the email has been resent (default 0)
    - `original_sent_at` (timestamp) - Preserves the first time the email was sent

  2. Updated Functions
    - Update retry_email_with_refresh to increment resend_count and preserve original_sent_at
*/

-- Add resend tracking columns
ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS resend_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_sent_at timestamptz;

-- Create or replace function to refresh and retry email with resend tracking
CREATE OR REPLACE FUNCTION retry_email_with_refresh(email_id uuid)
RETURNS boolean AS $$
DECLARE
  v_status text;
  v_sent_at timestamptz;
  v_original_sent_at timestamptz;
BEGIN
  -- First check the email exists and get its current state
  SELECT status, sent_at, original_sent_at
  INTO v_status, v_sent_at, v_original_sent_at
  FROM email_queue
  WHERE id = email_id;

  IF v_status IS NULL THEN
    RETURN false;
  END IF;

  IF v_status NOT IN ('failed', 'cancelled', 'sent') THEN
    RETURN false;
  END IF;

  -- Refresh the recipient email if we have a reference
  PERFORM refresh_email_recipient(email_id);

  -- Update the email to pending, preserving original_sent_at and incrementing resend_count
  UPDATE email_queue
  SET
    status = 'pending',
    error_message = NULL,
    scheduled_at = now(),
    -- Preserve the original sent_at if this is the first resend of a sent email
    original_sent_at = CASE
      WHEN v_status = 'sent' AND v_original_sent_at IS NULL THEN v_sent_at
      ELSE v_original_sent_at
    END,
    sent_at = NULL,
    attempts = 0,
    -- Increment resend_count if this was previously sent
    resend_count = CASE
      WHEN v_status = 'sent' THEN COALESCE(resend_count, 0) + 1
      ELSE COALESCE(resend_count, 0)
    END
  WHERE id = email_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
