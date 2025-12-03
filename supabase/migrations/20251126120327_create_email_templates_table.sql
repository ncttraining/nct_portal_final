/*
  # Create email templates table

  1. New Tables
    - `email_templates`
      - `id` (uuid, primary key)
      - `template_key` (text, unique) - unique identifier for the template
      - `name` (text) - friendly name for the template
      - `subject_template` (text) - subject line with placeholders
      - `body_html` (text) - HTML email body with placeholders
      - `body_text` (text) - plain text fallback with placeholders
      - `description` (text) - description of what the template is for
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `email_templates` table
    - Add policy for authenticated users to read templates
    - Add policy for authenticated users to manage templates

  3. Sample Data
    - Insert default email templates for trainer communications
*/

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  name text NOT NULL,
  subject_template text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert email templates"
  ON email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update email templates"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete email templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (true);

INSERT INTO email_templates (template_key, name, subject_template, body_html, body_text, description) VALUES
(
  'insurance_expiry_reminder',
  'Insurance Expiry Reminder',
  'Insurance Document Expiry - {{trainer_name}}',
  '<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #2563eb;">Insurance Document Expiry Reminder</h2>
    <p>Hi {{trainer_name}},</p>
    <p>This is a reminder that your insurance documentation is {{expiry_status}}.</p>
    <p><strong>Insurance Expiry Date:</strong> {{expiry_date}}</p>
    <p>Please ensure you upload your updated insurance documentation as soon as possible to maintain your active status in our system.</p>
    <p>You can update your insurance documents by logging into your trainer portal.</p>
    <p>If you have any questions, please don''t hesitate to contact us.</p>
    <p>Best regards,<br>National Compliance Training Team</p>
  </body></html>',
  'Hi {{trainer_name}},

This is a reminder that your insurance documentation is {{expiry_status}}.

Insurance Expiry Date: {{expiry_date}}

Please ensure you upload your updated insurance documentation as soon as possible to maintain your active status in our system.

You can update your insurance documents by logging into your trainer portal.

If you have any questions, please don''t hesitate to contact us.

Best regards,
National Compliance Training Team',
  'Reminder email sent to trainers when their insurance is expired or expiring soon'
),
(
  'trainer_welcome',
  'Welcome New Trainer',
  'Welcome to National Compliance Training - {{trainer_name}}',
  '<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #2563eb;">Welcome to National Compliance Training!</h2>
    <p>Hi {{trainer_name}},</p>
    <p>We''re excited to have you join our team of professional trainers.</p>
    <p><strong>Your Details:</strong></p>
    <ul>
      <li>Name: {{trainer_name}}</li>
      <li>Type: {{trainer_type}}</li>
      <li>Email: {{email}}</li>
      <li>Phone: {{telephone}}</li>
    </ul>
    <p>Our team will be in touch soon with next steps and additional information.</p>
    <p>If you have any immediate questions, please feel free to reach out.</p>
    <p>Best regards,<br>National Compliance Training Team</p>
  </body></html>',
  'Hi {{trainer_name}},

We''re excited to have you join our team of professional trainers.

Your Details:
- Name: {{trainer_name}}
- Type: {{trainer_type}}
- Email: {{email}}
- Phone: {{telephone}}

Our team will be in touch soon with next steps and additional information.

If you have any immediate questions, please feel free to reach out.

Best regards,
National Compliance Training Team',
  'Welcome email sent to newly added trainers'
);
