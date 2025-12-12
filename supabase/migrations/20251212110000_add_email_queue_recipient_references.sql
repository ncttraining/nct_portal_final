/*
  # Add Recipient References to Email Queue

  This migration adds optional foreign key references to link email recipients
  to their source records (trainers, users, delegates). This allows us to
  refresh email addresses when resending emails.

  1. New Columns
    - `recipient_trainer_id` (uuid) - Reference to trainers table
    - `recipient_user_id` (uuid) - Reference to users table
    - `recipient_delegate_id` (uuid) - Reference to open_course_delegates table

  2. New Function
    - `refresh_email_recipient` - Updates recipient_email from source record
*/

-- Add recipient reference columns
ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS recipient_trainer_id uuid REFERENCES trainers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recipient_delegate_id uuid;

-- Add index for trainer lookups
CREATE INDEX IF NOT EXISTS idx_email_queue_recipient_trainer
ON email_queue(recipient_trainer_id)
WHERE recipient_trainer_id IS NOT NULL;

-- Add index for user lookups
CREATE INDEX IF NOT EXISTS idx_email_queue_recipient_user
ON email_queue(recipient_user_id)
WHERE recipient_user_id IS NOT NULL;

-- Add index for delegate lookups
CREATE INDEX IF NOT EXISTS idx_email_queue_recipient_delegate
ON email_queue(recipient_delegate_id)
WHERE recipient_delegate_id IS NOT NULL;

-- Create function to refresh email address from source record
CREATE OR REPLACE FUNCTION refresh_email_recipient(email_id uuid)
RETURNS TABLE(updated boolean, new_email text, new_name text) AS $$
DECLARE
  v_trainer_id uuid;
  v_user_id uuid;
  v_delegate_id uuid;
  v_new_email text;
  v_new_name text;
  v_updated boolean := false;
BEGIN
  -- Get the recipient references
  SELECT
    recipient_trainer_id,
    recipient_user_id,
    recipient_delegate_id
  INTO v_trainer_id, v_user_id, v_delegate_id
  FROM email_queue
  WHERE id = email_id;

  -- Check trainer first
  IF v_trainer_id IS NOT NULL THEN
    SELECT email, name INTO v_new_email, v_new_name
    FROM trainers
    WHERE id = v_trainer_id;

    IF v_new_email IS NOT NULL THEN
      UPDATE email_queue
      SET
        recipient_email = v_new_email,
        recipient_name = COALESCE(v_new_name, recipient_name)
      WHERE id = email_id;
      v_updated := true;
    END IF;
  -- Check user
  ELSIF v_user_id IS NOT NULL THEN
    SELECT email, full_name INTO v_new_email, v_new_name
    FROM users
    WHERE id = v_user_id;

    IF v_new_email IS NOT NULL THEN
      UPDATE email_queue
      SET
        recipient_email = v_new_email,
        recipient_name = COALESCE(v_new_name, recipient_name)
      WHERE id = email_id;
      v_updated := true;
    END IF;
  -- Check delegate
  ELSIF v_delegate_id IS NOT NULL THEN
    SELECT delegate_email, delegate_name INTO v_new_email, v_new_name
    FROM open_course_delegates
    WHERE id = v_delegate_id;

    IF v_new_email IS NOT NULL THEN
      UPDATE email_queue
      SET
        recipient_email = v_new_email,
        recipient_name = COALESCE(v_new_name, recipient_name)
      WHERE id = email_id;
      v_updated := true;
    END IF;
  END IF;

  RETURN QUERY SELECT v_updated, v_new_email, v_new_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to refresh and retry email
CREATE OR REPLACE FUNCTION retry_email_with_refresh(email_id uuid)
RETURNS boolean AS $$
DECLARE
  v_status text;
BEGIN
  -- First check the email exists and is in a retryable state
  SELECT status INTO v_status
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

  -- Update the email to pending
  UPDATE email_queue
  SET
    status = 'pending',
    error_message = NULL,
    scheduled_at = now(),
    sent_at = NULL,
    attempts = 0
  WHERE id = email_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to bulk retry with refresh
CREATE OR REPLACE FUNCTION bulk_retry_emails_with_refresh(email_ids uuid[])
RETURNS integer AS $$
DECLARE
  v_count integer := 0;
  v_id uuid;
BEGIN
  FOREACH v_id IN ARRAY email_ids
  LOOP
    IF retry_email_with_refresh(v_id) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION refresh_email_recipient(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION retry_email_with_refresh(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_retry_emails_with_refresh(uuid[]) TO authenticated;
