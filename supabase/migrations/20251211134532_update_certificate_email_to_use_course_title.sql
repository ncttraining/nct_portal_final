/*
  # Update Certificate Email Template to Use Course Title

  1. Changes
    - Update the certificate email template to use course title instead of course type
    - Replace all instances of {{course_type}} with {{course_title}} in the template
    - This ensures emails show the specific course title (e.g., "Driver CPC - Periodic Training")
      instead of the generic course type (e.g., "CPC Training")

  2. Security
    - No security changes, only template content update
*/

-- Update the certificate email template to use course_title instead of course_type
UPDATE email_templates
SET
  subject_template = 'Your {{course_title}} Certificate - {{candidate_name}}',
  body_html = '<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #2563eb;">Your Training Certificate</h2>
    <p>Hi {{candidate_name}},</p>
    <p>Congratulations on successfully completing your <strong>{{course_title}}</strong> training!</p>
    <p><strong>Certificate Details:</strong></p>
    <ul>
      <li>Certificate Number: {{certificate_number}}</li>
      <li>Course: {{course_title}}</li>
      <li>Training Date: {{course_date}}</li>
      <li>Trainer: {{trainer_name}}</li>
      <li>Issue Date: {{issue_date}}</li>
      <li>Expiry Date: {{expiry_date}}</li>
    </ul>
    <p>Your certificate is attached to this email as a PDF. Please keep it in a safe place and ensure you renew it before the expiry date.</p>
    <p>If you have any questions about your certificate, please don''t hesitate to contact us.</p>
    <p>Best regards,<br>National Compliance Training Team</p>
  </body></html>',
  body_text = 'Hi {{candidate_name}},

Congratulations on successfully completing your {{course_title}} training!

Certificate Details:
- Certificate Number: {{certificate_number}}
- Course: {{course_title}}
- Training Date: {{course_date}}
- Trainer: {{trainer_name}}
- Issue Date: {{issue_date}}
- Expiry Date: {{expiry_date}}

Your certificate is attached to this email as a PDF. Please keep it in a safe place and ensure you renew it before the expiry date.

If you have any questions about your certificate, please don''t hesitate to contact us.

Best regards,
National Compliance Training Team',
  updated_at = now()
WHERE template_key = 'send_certificate_candidate';
