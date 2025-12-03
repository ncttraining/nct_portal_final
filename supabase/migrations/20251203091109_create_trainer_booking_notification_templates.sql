/*
  # Create Trainer Booking Notification Email Templates

  1. New Email Templates
    - `trainer_new_booking` - Sent when a new booking is assigned to a trainer
    - `trainer_booking_moved` - Sent when a booking is moved to this trainer from another
    - `trainer_booking_cancelled` - Sent when a booking assigned to trainer is cancelled/deleted
    - `trainer_booking_updated` - Sent when booking details are changed (excluding contact/candidate changes)

  2. Template Variables
    Each template uses placeholders that will be replaced with actual booking data:
    - {{trainer_name}} - Name of the trainer
    - {{course_title}} - Title/description of the course
    - {{course_type}} - Type of course
    - {{booking_date}} - Start date of booking
    - {{start_time}} - Start time of booking
    - {{duration}} - Duration/number of days
    - {{location}} - Location of training
    - {{client_name}} - Client name
    - {{client_contact}} - Client contact person
    - {{client_email}} - Client email
    - {{client_telephone}} - Client telephone
    - {{notes}} - Booking notes
    - {{status}} - Booking status
    - {{candidates_list}} - List of candidates (HTML formatted)
    - {{previous_trainer}} - Previous trainer name (for moved bookings)
    - {{changes_summary}} - Summary of changes (for updated bookings)

  3. Important Notes
    - Templates use responsive HTML design
    - Templates are marked as core templates (cannot be deleted)
    - Text alternatives provided for email clients that don't support HTML
*/

-- Insert trainer new booking notification template
INSERT INTO email_templates (template_key, name, subject_template, body_html, body_text, description, is_core)
VALUES (
  'trainer_new_booking',
  'Trainer - New Booking Notification',
  'New Booking Assigned: {{course_title}} on {{booking_date}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .detail-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
    .label { font-weight: bold; color: #2563eb; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .candidate-list { background: white; padding: 15px; margin: 10px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Booking Assigned</h1>
    </div>
    <div class="content">
      <p>Hi {{trainer_name}},</p>
      <p>You have been assigned a new training booking. Here are the details:</p>
      
      <div class="detail-row">
        <span class="label">Course:</span> {{course_title}}
      </div>
      <div class="detail-row">
        <span class="label">Course Type:</span> {{course_type}}
      </div>
      <div class="detail-row">
        <span class="label">Date:</span> {{booking_date}}
      </div>
      <div class="detail-row">
        <span class="label">Start Time:</span> {{start_time}}
      </div>
      <div class="detail-row">
        <span class="label">Duration:</span> {{duration}}
      </div>
      <div class="detail-row">
        <span class="label">Location:</span> {{location}}
      </div>
      <div class="detail-row">
        <span class="label">Status:</span> {{status}}
      </div>
      
      <h3 style="color: #2563eb; margin-top: 20px;">Client Information</h3>
      <div class="detail-row">
        <span class="label">Client:</span> {{client_name}}
      </div>
      <div class="detail-row">
        <span class="label">Contact:</span> {{client_contact}}
      </div>
      <div class="detail-row">
        <span class="label">Email:</span> {{client_email}}
      </div>
      <div class="detail-row">
        <span class="label">Telephone:</span> {{client_telephone}}
      </div>
      
      {{candidates_section}}
      
      {{notes_section}}
      
      <p style="margin-top: 20px;">Please log into the NCT portal to view full details and manage this booking.</p>
    </div>
    <div class="footer">
      <p>National Compliance Training</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>',
  'New Booking Assigned

Hi {{trainer_name}},

You have been assigned a new training booking. Here are the details:

Course: {{course_title}}
Course Type: {{course_type}}
Date: {{booking_date}}
Start Time: {{start_time}}
Duration: {{duration}}
Location: {{location}}
Status: {{status}}

Client Information:
Client: {{client_name}}
Contact: {{client_contact}}
Email: {{client_email}}
Telephone: {{client_telephone}}

{{candidates_text}}

{{notes_text}}

Please log into the NCT portal to view full details and manage this booking.

---
National Compliance Training
This is an automated notification. Please do not reply to this email.',
  'Notification sent to trainers when a new booking is assigned to them',
  true
)
ON CONFLICT (template_key) DO NOTHING;

-- Insert trainer booking moved notification template
INSERT INTO email_templates (template_key, name, subject_template, body_html, body_text, description, is_core)
VALUES (
  'trainer_booking_moved',
  'Trainer - Booking Moved Notification',
  'Booking Transferred to You: {{course_title}} on {{booking_date}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .detail-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
    .label { font-weight: bold; color: #f59e0b; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .alert { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Transferred to You</h1>
    </div>
    <div class="content">
      <p>Hi {{trainer_name}},</p>
      <div class="alert">
        <strong>Note:</strong> This booking has been transferred to you{{previous_trainer_text}}.
      </div>
      <p>Here are the booking details:</p>
      
      <div class="detail-row">
        <span class="label">Course:</span> {{course_title}}
      </div>
      <div class="detail-row">
        <span class="label">Course Type:</span> {{course_type}}
      </div>
      <div class="detail-row">
        <span class="label">Date:</span> {{booking_date}}
      </div>
      <div class="detail-row">
        <span class="label">Start Time:</span> {{start_time}}
      </div>
      <div class="detail-row">
        <span class="label">Duration:</span> {{duration}}
      </div>
      <div class="detail-row">
        <span class="label">Location:</span> {{location}}
      </div>
      <div class="detail-row">
        <span class="label">Status:</span> {{status}}
      </div>
      
      <h3 style="color: #f59e0b; margin-top: 20px;">Client Information</h3>
      <div class="detail-row">
        <span class="label">Client:</span> {{client_name}}
      </div>
      <div class="detail-row">
        <span class="label">Contact:</span> {{client_contact}}
      </div>
      <div class="detail-row">
        <span class="label">Email:</span> {{client_email}}
      </div>
      <div class="detail-row">
        <span class="label">Telephone:</span> {{client_telephone}}
      </div>
      
      {{candidates_section}}
      
      {{notes_section}}
      
      <p style="margin-top: 20px;">Please log into the NCT portal to view full details and manage this booking.</p>
    </div>
    <div class="footer">
      <p>National Compliance Training</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>',
  'Booking Transferred to You

Hi {{trainer_name}},

Note: This booking has been transferred to you{{previous_trainer_text}}.

Course: {{course_title}}
Course Type: {{course_type}}
Date: {{booking_date}}
Start Time: {{start_time}}
Duration: {{duration}}
Location: {{location}}
Status: {{status}}

Client Information:
Client: {{client_name}}
Contact: {{client_contact}}
Email: {{client_email}}
Telephone: {{client_telephone}}

{{candidates_text}}

{{notes_text}}

Please log into the NCT portal to view full details and manage this booking.

---
National Compliance Training
This is an automated notification. Please do not reply to this email.',
  'Notification sent to trainers when a booking is moved to them from another trainer',
  true
)
ON CONFLICT (template_key) DO NOTHING;

-- Insert trainer booking cancelled notification template
INSERT INTO email_templates (template_key, name, subject_template, body_html, body_text, description, is_core)
VALUES (
  'trainer_booking_cancelled',
  'Trainer - Booking Cancelled Notification',
  'Booking Cancelled: {{course_title}} on {{booking_date}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .detail-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
    .label { font-weight: bold; color: #ef4444; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .alert { background: #fee2e2; padding: 15px; border-left: 4px solid #ef4444; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Cancelled</h1>
    </div>
    <div class="content">
      <p>Hi {{trainer_name}},</p>
      <div class="alert">
        <strong>Important:</strong> The following booking has been cancelled and removed from your schedule.
      </div>
      <p>Cancelled booking details:</p>
      
      <div class="detail-row">
        <span class="label">Course:</span> {{course_title}}
      </div>
      <div class="detail-row">
        <span class="label">Course Type:</span> {{course_type}}
      </div>
      <div class="detail-row">
        <span class="label">Date:</span> {{booking_date}}
      </div>
      <div class="detail-row">
        <span class="label">Start Time:</span> {{start_time}}
      </div>
      <div class="detail-row">
        <span class="label">Duration:</span> {{duration}}
      </div>
      <div class="detail-row">
        <span class="label">Location:</span> {{location}}
      </div>
      
      <h3 style="color: #ef4444; margin-top: 20px;">Client Information</h3>
      <div class="detail-row">
        <span class="label">Client:</span> {{client_name}}
      </div>
      <div class="detail-row">
        <span class="label">Contact:</span> {{client_contact}}
      </div>
      
      {{notes_section}}
      
      <p style="margin-top: 20px;">This date is now available in your schedule for other bookings.</p>
    </div>
    <div class="footer">
      <p>National Compliance Training</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>',
  'Booking Cancelled

Hi {{trainer_name}},

Important: The following booking has been cancelled and removed from your schedule.

Cancelled booking details:

Course: {{course_title}}
Course Type: {{course_type}}
Date: {{booking_date}}
Start Time: {{start_time}}
Duration: {{duration}}
Location: {{location}}

Client Information:
Client: {{client_name}}
Contact: {{client_contact}}

{{notes_text}}

This date is now available in your schedule for other bookings.

---
National Compliance Training
This is an automated notification. Please do not reply to this email.',
  'Notification sent to trainers when their booking is cancelled or deleted',
  true
)
ON CONFLICT (template_key) DO NOTHING;

-- Insert trainer booking updated notification template
INSERT INTO email_templates (template_key, name, subject_template, body_html, body_text, description, is_core)
VALUES (
  'trainer_booking_updated',
  'Trainer - Booking Updated Notification',
  'Booking Updated: {{course_title}} on {{booking_date}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .detail-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
    .label { font-weight: bold; color: #8b5cf6; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .alert { background: #ede9fe; padding: 15px; border-left: 4px solid #8b5cf6; margin: 15px 0; }
    .changes { background: white; padding: 15px; margin: 10px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Updated</h1>
    </div>
    <div class="content">
      <p>Hi {{trainer_name}},</p>
      <div class="alert">
        <strong>Update:</strong> One of your bookings has been updated.
      </div>
      
      <h3 style="color: #8b5cf6;">What Changed:</h3>
      <div class="changes">
        {{changes_summary}}
      </div>
      
      <h3 style="color: #8b5cf6; margin-top: 20px;">Current Booking Details:</h3>
      <div class="detail-row">
        <span class="label">Course:</span> {{course_title}}
      </div>
      <div class="detail-row">
        <span class="label">Course Type:</span> {{course_type}}
      </div>
      <div class="detail-row">
        <span class="label">Date:</span> {{booking_date}}
      </div>
      <div class="detail-row">
        <span class="label">Start Time:</span> {{start_time}}
      </div>
      <div class="detail-row">
        <span class="label">Duration:</span> {{duration}}
      </div>
      <div class="detail-row">
        <span class="label">Location:</span> {{location}}
      </div>
      <div class="detail-row">
        <span class="label">Status:</span> {{status}}
      </div>
      
      <h3 style="color: #8b5cf6; margin-top: 20px;">Client Information</h3>
      <div class="detail-row">
        <span class="label">Client:</span> {{client_name}}
      </div>
      <div class="detail-row">
        <span class="label">Contact:</span> {{client_contact}}
      </div>
      
      {{notes_section}}
      
      <p style="margin-top: 20px;">Please log into the NCT portal to view full details.</p>
    </div>
    <div class="footer">
      <p>National Compliance Training</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>',
  'Booking Updated

Hi {{trainer_name}},

Update: One of your bookings has been updated.

What Changed:
{{changes_summary}}

Current Booking Details:
Course: {{course_title}}
Course Type: {{course_type}}
Date: {{booking_date}}
Start Time: {{start_time}}
Duration: {{duration}}
Location: {{location}}
Status: {{status}}

Client Information:
Client: {{client_name}}
Contact: {{client_contact}}

{{notes_text}}

Please log into the NCT portal to view full details.

---
National Compliance Training
This is an automated notification. Please do not reply to this email.',
  'Notification sent to trainers when booking details are updated (excluding contact/candidate changes)',
  true
)
ON CONFLICT (template_key) DO NOTHING;