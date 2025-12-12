/*
  # Add Resend Tracking to Email Queue

  This migration adds columns to track when emails are resent:

  1. New Columns
    - `resend_count` (integer) - Number of times the email has been resent (default 0)
    - `original_sent_at` (timestamp) - Preserves the first time the email was sent
    - `original_recipient_email` (text) - Preserves the original email if updated on resend

  2. Updated Functions
    - Update refresh_email_recipient to track original email when it changes
    - Update retry_email_with_refresh to increment resend_count and preserve original_sent_at
*/

-- Add resend tracking columns
ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS resend_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS original_recipient_email text;

-- Update refresh function to track original email when it changes
CREATE OR REPLACE FUNCTION refresh_email_recipient(email_id uuid)
RETURNS TABLE(updated boolean, new_email text, new_name text) AS $$
DECLARE
  v_trainer_id uuid;
  v_user_id uuid;
  v_delegate_id uuid;
  v_current_email text;
  v_original_email text;
  v_new_email text;
  v_new_name text;
  v_updated boolean := false;
BEGIN
  -- Get the recipient references and current email
  SELECT
    recipient_trainer_id,
    recipient_user_id,
    recipient_delegate_id,
    recipient_email,
    original_recipient_email
  INTO v_trainer_id, v_user_id, v_delegate_id, v_current_email, v_original_email
  FROM email_queue
  WHERE id = email_id;

  -- Check trainer first
  IF v_trainer_id IS NOT NULL THEN
    SELECT email, name INTO v_new_email, v_new_name
    FROM trainers
    WHERE id = v_trainer_id;

    IF v_new_email IS NOT NULL AND v_new_email != v_current_email THEN
      UPDATE email_queue
      SET
        recipient_email = v_new_email,
        recipient_name = COALESCE(v_new_name, recipient_name),
        -- Store original email if this is the first time we're updating it
        original_recipient_email = CASE
          WHEN v_original_email IS NULL THEN v_current_email
          ELSE v_original_email
        END
      WHERE id = email_id;
      v_updated := true;
    END IF;
  -- Check user
  ELSIF v_user_id IS NOT NULL THEN
    SELECT email, full_name INTO v_new_email, v_new_name
    FROM users
    WHERE id = v_user_id;

    IF v_new_email IS NOT NULL AND v_new_email != v_current_email THEN
      UPDATE email_queue
      SET
        recipient_email = v_new_email,
        recipient_name = COALESCE(v_new_name, recipient_name),
        original_recipient_email = CASE
          WHEN v_original_email IS NULL THEN v_current_email
          ELSE v_original_email
        END
      WHERE id = email_id;
      v_updated := true;
    END IF;
  -- Check delegate
  ELSIF v_delegate_id IS NOT NULL THEN
    SELECT delegate_email, delegate_name INTO v_new_email, v_new_name
    FROM open_course_delegates
    WHERE id = v_delegate_id;

    IF v_new_email IS NOT NULL AND v_new_email != v_current_email THEN
      UPDATE email_queue
      SET
        recipient_email = v_new_email,
        recipient_name = COALESCE(v_new_name, recipient_name),
        original_recipient_email = CASE
          WHEN v_original_email IS NULL THEN v_current_email
          ELSE v_original_email
        END
      WHERE id = email_id;
      v_updated := true;
    END IF;
  END IF;

  RETURN QUERY SELECT v_updated, v_new_email, v_new_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Create function to forward email to a different address
CREATE OR REPLACE FUNCTION forward_email(email_id uuid, forward_to_email text, forward_to_name text DEFAULT NULL)
RETURNS uuid AS $$
DECLARE
  v_new_id uuid;
  v_source_email email_queue%ROWTYPE;
BEGIN
  -- Get the source email
  SELECT * INTO v_source_email
  FROM email_queue
  WHERE id = email_id;

  IF v_source_email.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Create a new email entry with the forwarded address
  INSERT INTO email_queue (
    recipient_email,
    recipient_name,
    subject,
    html_body,
    text_body,
    template_key,
    template_data,
    attachments,
    priority,
    max_attempts,
    created_by_user_id
  )
  VALUES (
    forward_to_email,
    COALESCE(forward_to_name, v_source_email.recipient_name),
    v_source_email.subject,
    v_source_email.html_body,
    v_source_email.text_body,
    v_source_email.template_key,
    v_source_email.template_data,
    v_source_email.attachments,
    v_source_email.priority,
    v_source_email.max_attempts,
    v_source_email.created_by_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION forward_email(uuid, text, text) TO authenticated;
