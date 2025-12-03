/*
  # Add is_core column to email templates

  1. Changes
    - Add `is_core` boolean column to `email_templates` table
    - Mark existing templates as core templates
    - Insert new "send certificate - candidate" core template
    - Update delete policy to prevent deletion of core templates

  2. Security
    - Core templates cannot be deleted
    - Core templates can still be edited to customize content
*/

-- Add is_core column
ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS is_core boolean DEFAULT false;

-- Mark existing templates as core
UPDATE email_templates 
SET is_core = true 
WHERE template_key IN ('insurance_expiry_reminder', 'trainer_welcome');

-- Insert certificate email template
INSERT INTO email_templates (template_key, name, subject_template, body_html, body_text, description, is_core)
VALUES (
  'send_certificate_candidate',
  'Send Certificate - Candidate',
  'Your {{course_type}} Certificate - {{candidate_name}}',
  '<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #2563eb;">Your Training Certificate</h2>
    <p>Hi {{candidate_name}},</p>
    <p>Congratulations on successfully completing your <strong>{{course_type}}</strong> training!</p>
    <p><strong>Certificate Details:</strong></p>
    <ul>
      <li>Certificate Number: {{certificate_number}}</li>
      <li>Course: {{course_type}}</li>
      <li>Training Date: {{course_date}}</li>
      <li>Trainer: {{trainer_name}}</li>
      <li>Issue Date: {{issue_date}}</li>
      <li>Expiry Date: {{expiry_date}}</li>
    </ul>
    <p>Your certificate is attached to this email as a PDF. Please keep it in a safe place and ensure you renew it before the expiry date.</p>
    <p>If you have any questions about your certificate, please don''t hesitate to contact us.</p>
    <p>Best regards,<br>National Compliance Training Team</p>
  </body></html>',
  'Hi {{candidate_name}},

Congratulations on successfully completing your {{course_type}} training!

Certificate Details:
- Certificate Number: {{certificate_number}}
- Course: {{course_type}}
- Training Date: {{course_date}}
- Trainer: {{trainer_name}}
- Issue Date: {{issue_date}}
- Expiry Date: {{expiry_date}}

Your certificate is attached to this email as a PDF. Please keep it in a safe place and ensure you renew it before the expiry date.

If you have any questions about your certificate, please don''t hesitate to contact us.

Best regards,
National Compliance Training Team',
  'Email sent to candidates with their training certificate attached',
  true
)
ON CONFLICT (template_key) DO UPDATE
SET 
  is_core = true,
  updated_at = now();

-- Update delete policy to prevent deletion of core templates
DROP POLICY IF EXISTS "Authenticated users can delete email templates" ON email_templates;

CREATE POLICY "Authenticated users can delete non-core email templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (is_core = false);
