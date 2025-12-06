/*
  # Add Trainer Open Course Assignment Email Template

  1. New Email Template
    - Template key: trainer_open_course_assignment
    - Used when a trainer is assigned to an open course session
    - Contains session details, location, time, and delegate information
    - Marked as core system template
*/

INSERT INTO email_templates (template_key, name, subject_template, body_html, body_text, description, is_core)
VALUES (
  'trainer_open_course_assignment',
  'Trainer Open Course Assignment',
  'New Open Course Assignment: {{course_title}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1e293b; color: #ffffff; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">New Open Course Assignment</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">Hi {{trainer_name}},</p>

              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                You have been assigned to deliver an open course session:
              </p>

              <!-- Course Details Box -->
              <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #1e293b;">{{course_title}}</h2>
                {{#if course_subtitle}}
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">{{course_subtitle}}</p>
                {{/if}}

                <table style="width: 100%; margin-top: 15px;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #475569; width: 120px;">Course Type:</td>
                    <td style="padding: 8px 0; color: #333;">{{course_type}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #475569;">Date:</td>
                    <td style="padding: 8px 0; color: #333;">{{session_date}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #475569;">Time:</td>
                    <td style="padding: 8px 0; color: #333;">{{start_time}} - {{end_time}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #475569;">Location:</td>
                    <td style="padding: 8px 0; color: #333;">
                      {{#if is_online}}
                        <span style="color: #3b82f6; font-weight: 500;">Online</span>
                      {{else}}
                        {{location}}
                      {{/if}}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #475569;">Capacity:</td>
                    <td style="padding: 8px 0; color: #333;">{{capacity}}</td>
                  </tr>
                </table>
              </div>

              <!-- Delegates Section -->
              <div style="margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #1e293b;">Current Delegates:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #333;">
                  {{{delegates_list}}}
                </ul>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #64748b;">
                You can view more details and manage this session from the Open Courses Dashboard in the training management system.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                This is an automated notification from the NCT Training Management System.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  'Hi {{trainer_name}},

You have been assigned to deliver an open course session:

Course Details:
---------------
{{course_title}}
{{#if course_subtitle}}{{course_subtitle}}{{/if}}

Course Type: {{course_type}}
Date: {{session_date}}
Time: {{start_time}} - {{end_time}}
Location: {{#if is_online}}Online{{else}}{{location}}{{/if}}
Capacity: {{capacity}}

Current Delegates:
{{{delegates_text}}}

You can view more details and manage this session from the Open Courses Dashboard in the training management system.

---
This is an automated notification from the NCT Training Management System.',
  'Email sent to trainers when they are assigned to an open course session',
  true
) ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  subject_template = EXCLUDED.subject_template,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  description = EXCLUDED.description,
  is_core = EXCLUDED.is_core;
