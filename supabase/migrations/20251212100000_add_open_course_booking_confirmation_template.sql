/*
  # Add Open Course Booking Confirmation Email Template

  This migration adds the missing email template for open course booking confirmations.

  Template key: open_course_booking_confirmation

  Placeholders used:
    - {{delegate_name}} - Name of the delegate
    - {{course_name}} - Course/event title
    - {{course_subtitle}} - Course subtitle (optional)
    - {{session_date}} - Date of the session
    - {{start_time}} - Start time
    - {{end_time}} - End time
    - {{location}} - Venue name or "Online"
    - {{location_address}} - Full venue address (if not online)
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
  'open_course_booking_confirmation',
  'Open Course Booking Confirmation',
  'Booking Confirmation - {{course_name}}',
  '<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Booking Confirmation</h1>
  </div>

  <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
    <p style="font-size: 16px; margin-top: 0;">Dear {{delegate_name}},</p>

    <p>Thank you for your booking. We are pleased to confirm your place on the following course:</p>

    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #2563eb; margin: 0 0 5px 0; font-size: 20px;">{{course_name}}</h2>
      {{course_subtitle}}

      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; width: 120px;">
            <strong style="color: #64748b;">Date:</strong>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
            {{session_date}}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
            <strong style="color: #64748b;">Time:</strong>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
            {{start_time}} - {{end_time}}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
            <strong style="color: #64748b;">Location:</strong>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
            {{location}}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: #64748b;">Address:</strong>
          </td>
          <td style="padding: 8px 0;">
            {{location_address}}
          </td>
        </tr>
      </table>
    </div>

    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #92400e;">
        <strong>Important:</strong> Please arrive 10-15 minutes before the start time. If you need to cancel or reschedule, please contact us as soon as possible.
      </p>
    </div>

    <p>If you have any questions about your booking, please don''t hesitate to contact us.</p>

    <p style="margin-bottom: 0;">
      Best regards,<br>
      <strong>National Compliance Training Team</strong>
    </p>
  </div>

  <div style="background: #1e293b; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="color: #94a3b8; margin: 0; font-size: 12px;">
      National Compliance Training<br>
      This is an automated email. Please do not reply directly to this message.
    </p>
  </div>
</body>
</html>',
  'Dear {{delegate_name}},

Thank you for your booking. We are pleased to confirm your place on the following course:

COURSE DETAILS
==============
Course: {{course_name}}
{{course_subtitle}}

Date: {{session_date}}
Time: {{start_time}} - {{end_time}}
Location: {{location}}
Address: {{location_address}}

IMPORTANT: Please arrive 10-15 minutes before the start time. If you need to cancel or reschedule, please contact us as soon as possible.

If you have any questions about your booking, please don''t hesitate to contact us.

Best regards,
National Compliance Training Team',
  'Confirmation email sent to delegates when they are booked onto an open course session',
  true
) ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  subject_template = EXCLUDED.subject_template,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  description = EXCLUDED.description,
  is_core = EXCLUDED.is_core,
  updated_at = now();

-- Also add the open_course_multiple_bookings template for sending multiple booking details
INSERT INTO email_templates (
  template_key,
  name,
  subject_template,
  body_html,
  body_text,
  description,
  is_core
) VALUES (
  'open_course_multiple_bookings',
  'Open Course Multiple Bookings Summary',
  'Your Upcoming Course Bookings',
  '<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Your Upcoming Bookings</h1>
  </div>

  <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
    <p style="font-size: 16px; margin-top: 0;">Dear {{delegate_name}},</p>

    <p>Here is a summary of your <strong>{{bookings_count}}</strong> upcoming course booking(s):</p>

    {{bookings_list}}

    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #92400e;">
        <strong>Important:</strong> Please arrive 10-15 minutes before each session start time. If you need to cancel or reschedule any booking, please contact us as soon as possible.
      </p>
    </div>

    <p>If you have any questions about your bookings, please don''t hesitate to contact us.</p>

    <p style="margin-bottom: 0;">
      Best regards,<br>
      <strong>National Compliance Training Team</strong>
    </p>
  </div>

  <div style="background: #1e293b; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="color: #94a3b8; margin: 0; font-size: 12px;">
      National Compliance Training<br>
      This is an automated email. Please do not reply directly to this message.
    </p>
  </div>
</body>
</html>',
  'Dear {{delegate_name}},

Here is a summary of your {{bookings_count}} upcoming course booking(s):

{{bookings_list}}

IMPORTANT: Please arrive 10-15 minutes before each session start time. If you need to cancel or reschedule any booking, please contact us as soon as possible.

If you have any questions about your bookings, please don''t hesitate to contact us.

Best regards,
National Compliance Training Team',
  'Summary email sent to delegates listing all their upcoming open course bookings',
  true
) ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  subject_template = EXCLUDED.subject_template,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  description = EXCLUDED.description,
  is_core = EXCLUDED.is_core,
  updated_at = now();
