import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '10000', 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10', 10);
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '3', 10);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

let isShuttingDown = false;
let heartbeatInterval;

async function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp,
    level,
    message,
    ...data
  }));
}

async function fetchEmailBatch() {
  try {
    const { data, error } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: true })
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      await log('error', 'Failed to fetch email batch', { error: error.message });
      return [];
    }

    return data || [];
  } catch (error) {
    await log('error', 'Exception fetching email batch', { error: error.message });
    return [];
  }
}

async function markAsProcessing(emailId) {
  try {
    const { error } = await supabase
      .from('email_queue')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', emailId)
      .eq('status', 'pending');

    if (error) {
      await log('error', 'Failed to mark email as processing', { emailId, error: error.message });
      return false;
    }

    return true;
  } catch (error) {
    await log('error', 'Exception marking email as processing', { emailId, error: error.message });
    return false;
  }
}

async function fetchTemplate(templateKey) {
  try {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', templateKey)
      .maybeSingle();

    if (error) {
      await log('error', 'Failed to fetch template', { templateKey, error: error.message });
      return null;
    }

    return data;
  } catch (error) {
    await log('error', 'Exception fetching template', { templateKey, error: error.message });
    return null;
  }
}

function renderTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  }
  return result;
}

async function downloadAttachment(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    await log('error', 'Failed to download attachment', { url, error: error.message });
    throw error;
  }
}

async function processEmail(email) {
  try {
    let subject = email.subject;
    let htmlBody = email.html_body;
    let textBody = email.text_body;

    if (email.template_key) {
      const template = await fetchTemplate(email.template_key);
      if (!template) {
        throw new Error(`Template not found: ${email.template_key}`);
      }

      subject = renderTemplate(template.subject_template, email.template_data || {});
      htmlBody = renderTemplate(template.body_html, email.template_data || {});
      textBody = template.body_text
        ? renderTemplate(template.body_text, email.template_data || {})
        : textBody;
    }

    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
      to: email.recipient_email,
      subject: subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]*>/g, ''),
    };

    if (email.attachments && Array.isArray(email.attachments)) {
      mailOptions.attachments = [];
      for (const attachment of email.attachments) {
        try {
          const content = await downloadAttachment(attachment.url);
          mailOptions.attachments.push({
            filename: attachment.filename,
            content: content,
          });
        } catch (error) {
          await log('warn', 'Failed to attach file, sending email without it', {
            emailId: email.id,
            filename: attachment.filename,
            error: error.message
          });
        }
      }
    }

    const info = await transporter.sendMail(mailOptions);

    const { error: updateError } = await supabase
      .from('email_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', email.id);

    if (updateError) {
      await log('error', 'Email sent but failed to update status', {
        emailId: email.id,
        error: updateError.message
      });
    } else {
      await log('info', 'Email sent successfully', {
        emailId: email.id,
        recipient: email.recipient_email,
        messageId: info.messageId
      });
    }

    return true;
  } catch (error) {
    const newAttempts = (email.attempts || 0) + 1;
    const maxAttempts = email.max_attempts || 3;
    const newStatus = newAttempts >= maxAttempts ? 'failed' : 'pending';

    let scheduledAt = email.scheduled_at;
    if (newStatus === 'pending') {
      const backoffMinutes = Math.pow(2, newAttempts) * 5;
      scheduledAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
    }

    const { error: updateError } = await supabase
      .from('email_queue')
      .update({
        status: newStatus,
        attempts: newAttempts,
        error_message: error.message,
        scheduled_at: scheduledAt,
        processing_started_at: null,
      })
      .eq('id', email.id);

    if (updateError) {
      await log('error', 'Failed to update email after error', {
        emailId: email.id,
        error: updateError.message
      });
    }

    await log('error', 'Failed to send email', {
      emailId: email.id,
      recipient: email.recipient_email,
      attempt: newAttempts,
      maxAttempts: maxAttempts,
      newStatus: newStatus,
      error: error.message
    });

    return false;
  }
}

async function processBatch(emails) {
  const results = [];

  for (let i = 0; i < emails.length; i += MAX_CONCURRENT) {
    if (isShuttingDown) break;

    const batch = emails.slice(i, i + MAX_CONCURRENT);
    const promises = batch.map(async (email) => {
      const marked = await markAsProcessing(email.id);
      if (!marked) return false;
      return await processEmail(email);
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  return results;
}

async function workCycle() {
  if (isShuttingDown) return;

  try {
    const emails = await fetchEmailBatch();

    if (emails.length > 0) {
      await log('info', 'Processing email batch', { count: emails.length });
      const results = await processBatch(emails);
      const successCount = results.filter(r => r).length;
      const failCount = results.length - successCount;
      await log('info', 'Batch processed', {
        total: results.length,
        success: successCount,
        failed: failCount
      });
    }
  } catch (error) {
    await log('error', 'Error in work cycle', { error: error.message });
  }
}

async function startWorker() {
  await log('info', 'Email worker starting', {
    pollInterval: POLL_INTERVAL,
    batchSize: BATCH_SIZE,
    maxConcurrent: MAX_CONCURRENT
  });

  try {
    await transporter.verify();
    await log('info', 'SMTP connection verified');
  } catch (error) {
    await log('error', 'SMTP connection failed', { error: error.message });
    process.exit(1);
  }

  heartbeatInterval = setInterval(async () => {
    await log('debug', 'Worker heartbeat');
  }, 60000);

  const mainLoop = setInterval(async () => {
    await workCycle();
  }, POLL_INTERVAL);

  process.on('SIGTERM', async () => {
    await log('info', 'Received SIGTERM, shutting down gracefully');
    isShuttingDown = true;
    clearInterval(mainLoop);
    clearInterval(heartbeatInterval);
    transporter.close();
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });

  process.on('SIGINT', async () => {
    await log('info', 'Received SIGINT, shutting down gracefully');
    isShuttingDown = true;
    clearInterval(mainLoop);
    clearInterval(heartbeatInterval);
    transporter.close();
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });

  await workCycle();
}

startWorker().catch(async (error) => {
  await log('error', 'Worker crashed', { error: error.message, stack: error.stack });
  process.exit(1);
});
