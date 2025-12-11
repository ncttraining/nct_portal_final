/*
  # Add Trainer Provisional Booking Email Template

  Creates an email template for notifying trainers when they are
  provisionally booked for a date or date range.
*/

INSERT INTO email_templates (
  template_key,
  name,
  subject_template,
  body_html,
  body_text,
  description,
  is_core
) VALUES (
  'trainer_provisional_booking',
  'Trainer Provisional Booking Notification',
  'Provisional Booking: {{date_range}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Provisional Booking Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background-color: #22c55e; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                Provisional Booking
              </h1>
              <p style="margin: 10px 0 0; color: #dcfce7; font-size: 14px;">
                You have been provisionally booked
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.5;">
                Hello <strong>{{trainer_name}}</strong>,
              </p>

              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.5;">
                You have been provisionally booked for the following date(s). This means you are being reserved for potential work, but no specific course has been assigned yet.
              </p>

              <!-- Booking Details Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #bbf7d0;">
                          <strong style="color: #15803d;">Date(s):</strong>
                          <span style="color: #374151; float: right;">{{date_range}}</span>
                        </td>
                      </tr>
                      {{#if reason}}
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #15803d;">Reason:</strong>
                          <span style="color: #374151; float: right;">{{reason}}</span>
                        </td>
                      </tr>
                      {{/if}}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                Once a specific course is assigned, you will receive another notification with full booking details. In the meantime, please keep these dates available.
              </p>

              <p style="margin: 20px 0 0; color: #374151; font-size: 16px; line-height: 1.5;">
                If you have any questions or need to discuss your availability, please contact the office.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated notification from NCT Training Portal.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  'Hello {{trainer_name}},

You have been provisionally booked for the following date(s). This means you are being reserved for potential work, but no specific course has been assigned yet.

DATE(S): {{date_range}}
{{#if reason}}REASON: {{reason}}{{/if}}

Once a specific course is assigned, you will receive another notification with full booking details. In the meantime, please keep these dates available.

If you have any questions or need to discuss your availability, please contact the office.

---
This is an automated notification from NCT Training Portal.',
  'Email sent to trainers when they are provisionally booked for a date or date range without a specific course assignment.',
  true
) ON CONFLICT (template_key) DO NOTHING;
