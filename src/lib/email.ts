import { supabase } from './supabase';
import { queueEmail } from './email-queue';

export interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  subject_template: string;
  body_html: string;
  body_text: string | null;
  description: string;
  is_core?: boolean;
}

export interface EmailAttachment {
  url: string;
  filename: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string,
  options?: { sendImmediately?: boolean; recipientName?: string; priority?: number }
): Promise<boolean> {
  if (options?.sendImmediately) {
    try {
      const apiUrl = import.meta.env.VITE_EMAIL_API_URL || 'https://nctapp.nationalcompliancetraining.co.uk/api/send-email.php';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject,
          htmlBody,
          textBody,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Email error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  const queueId = await queueEmail({
    recipientEmail: to,
    recipientName: options?.recipientName,
    subject,
    htmlBody,
    textBody,
    priority: options?.priority || 5,
  });

  return queueId !== null;
}

export async function sendTemplateEmail(
  to: string,
  templateKey: string,
  templateData: Record<string, string>,
  attachments?: EmailAttachment[],
  options?: { sendImmediately?: boolean; recipientName?: string; priority?: number }
): Promise<boolean> {
  if (options?.sendImmediately) {
    try {
      const apiUrl = import.meta.env.VITE_EMAIL_API_URL || 'https://nctapp.nationalcompliancetraining.co.uk/api/send-email.php';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          templateKey,
          templateData,
          attachments,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Email error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to send template email:', error);
      return false;
    }
  }

  const queueId = await queueEmail({
    recipientEmail: to,
    recipientName: options?.recipientName || templateData.candidate_name || templateData.contact_name,
    templateKey,
    templateData,
    attachments,
    priority: options?.priority || 5,
  });

  return queueId !== null;
}

export async function sendCertificateEmail(
  candidateEmail: string,
  certificateData: {
    candidate_name: string;
    course_type: string;
    certificate_number: string;
    course_date: string;
    trainer_name: string;
    issue_date: string;
    expiry_date: string;
    certificate_pdf_url: string;
  }
): Promise<boolean> {
  const attachments: EmailAttachment[] = [
    {
      url: certificateData.certificate_pdf_url,
      filename: `${certificateData.certificate_number}.pdf`,
    },
  ];

  return sendTemplateEmail(
    candidateEmail,
    'send_certificate_candidate',
    {
      candidate_name: certificateData.candidate_name,
      course_type: certificateData.course_type,
      certificate_number: certificateData.certificate_number,
      course_date: certificateData.course_date,
      trainer_name: certificateData.trainer_name,
      issue_date: certificateData.issue_date,
      expiry_date: certificateData.expiry_date,
    },
    attachments
  );
}

export async function sendBookingConfirmationEmail(
  contactEmail: string,
  bookingData: {
    contact_name: string;
    course_title: string;
    course_type: string;
    trainer_name: string;
    booking_date: string;
    duration: string;
    location: string;
    notes?: string;
    candidates?: Array<{ name: string; email: string; telephone: string }>;
  }
): Promise<boolean> {
  let candidatesHtml = '';
  let candidatesText = '';

  if (bookingData.candidates && bookingData.candidates.length > 0) {
    candidatesHtml = `
      <h3 style="color: #2563eb; margin-top: 20px;">Registered Candidates</h3>
      <ul>
        ${bookingData.candidates.map(c => `<li>${c.name} - ${c.email} - ${c.telephone}</li>`).join('')}
      </ul>
    `;
    candidatesText = `
Registered Candidates:
${bookingData.candidates.map(c => `- ${c.name} - ${c.email} - ${c.telephone}`).join('\n')}
`;
  }

  let notesHtml = '';
  let notesText = '';
  if (bookingData.notes) {
    notesHtml = `
      <h3 style="color: #2563eb; margin-top: 20px;">Additional Notes</h3>
      <p>${bookingData.notes}</p>
    `;
    notesText = `
Additional Notes:
${bookingData.notes}
`;
  }

  return sendTemplateEmail(
    contactEmail,
    'client_booking_confirmation',
    {
      contact_name: bookingData.contact_name,
      course_title: bookingData.course_title,
      course_type: bookingData.course_type,
      trainer_name: bookingData.trainer_name,
      booking_date: bookingData.booking_date,
      duration: bookingData.duration,
      location: bookingData.location,
      candidates_section: candidatesHtml,
      candidates_text: candidatesText,
      notes_section: notesHtml,
      notes_text: notesText,
    }
  );
}

export async function sendCandidateBookingConfirmationEmail(
  candidateEmail: string,
  bookingData: {
    candidate_name: string;
    course_title: string;
    course_type: string;
    trainer_name: string;
    booking_date: string;
    duration: string;
    location: string;
    client_name?: string;
    notes?: string;
  }
): Promise<boolean> {
  let clientHtml = '';
  let clientText = '';

  if (bookingData.client_name) {
    clientHtml = `
      <h3 style="color: #2563eb; margin-top: 20px;">Client Information</h3>
      <p><strong>Client:</strong> ${bookingData.client_name}</p>
    `;
    clientText = `
Client Information:
Client: ${bookingData.client_name}
`;
  }

  let notesHtml = '';
  let notesText = '';
  if (bookingData.notes) {
    notesHtml = `
      <h3 style="color: #2563eb; margin-top: 20px;">Additional Information</h3>
      <p>${bookingData.notes}</p>
    `;
    notesText = `
Additional Information:
${bookingData.notes}
`;
  }

  return sendTemplateEmail(
    candidateEmail,
    'candidate_booking_confirmation',
    {
      candidate_name: bookingData.candidate_name,
      course_title: bookingData.course_title,
      course_type: bookingData.course_type,
      trainer_name: bookingData.trainer_name,
      booking_date: bookingData.booking_date,
      duration: bookingData.duration,
      location: bookingData.location,
      client_section: clientHtml,
      client_text: clientText,
      notes_section: notesHtml,
      notes_text: notesText,
    }
  );
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error loading email templates:', error);
    return [];
  }

  return data || [];
}
