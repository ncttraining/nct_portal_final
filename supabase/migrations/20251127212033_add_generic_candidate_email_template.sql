/*
  # Add generic candidate email template

  1. Changes
    - Insert new "Generic Candidate Email" core template
    - Template is marked as core so it can be edited but not deleted
    - Allows sending custom emails to candidates from Candidates Management page

  2. Security
    - Template is a core template (is_core = true)
    - Can be customized but cannot be deleted
*/

-- Insert generic candidate email template
INSERT INTO email_templates (template_key, name, subject_template, body_html, body_text, description, is_core)
VALUES (
  'generic_candidate_email',
  'Generic Candidate Email',
  '{{subject}}',
  '<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <p>Hi {{candidate_name}},</p>
    <div>{{body}}</div>
    <p>Best regards,<br>National Compliance Training Team</p>
  </body></html>',
  'Hi {{candidate_name}},

{{body}}

Best regards,
National Compliance Training Team',
  'Generic email template for sending custom messages to candidates',
  true
)
ON CONFLICT (template_key) DO UPDATE
SET 
  is_core = true,
  updated_at = now();
