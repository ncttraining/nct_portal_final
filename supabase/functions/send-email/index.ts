import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  to: string;
  templateKey?: string;
  templateData?: Record<string, string>;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
}

interface EmailTemplate {
  subject_template: string;
  body_html: string;
  body_text: string | null;
}

function renderTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  }
  return result;
}

async function sendEmailViaSMTP(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string
): Promise<boolean> {
  try {
    const username = Deno.env.get('SMTP_USERNAME');
    const password = Deno.env.get('SMTP_PASSWORD');
    const host = Deno.env.get('SMTP_HOST') || 'smtp.office365.com';
    const port = parseInt(Deno.env.get('SMTP_PORT') || '587');

    if (!username || !password) {
      console.error('SMTP credentials not configured');
      return false;
    }

    const boundary = '----=_Part_' + Date.now();
    const message = [
      `From: National Compliance Training <${username}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      textBody,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody,
      '',
      `--${boundary}--`,
    ].join('\r\n');

    const conn = await Deno.connect({
      hostname: host,
      port: port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(4096);
      const n = await conn.read(buffer);
      return n ? decoder.decode(buffer.subarray(0, n)) : '';
    }

    async function sendCommand(command: string): Promise<string> {
      await conn.write(encoder.encode(command + '\r\n'));
      return await readResponse();
    }

    await readResponse();
    await sendCommand('EHLO localhost');
    await sendCommand('STARTTLS');
    
    const authString = btoa(`\0${username}\0${password}`);
    await sendCommand('AUTH PLAIN');
    await sendCommand(authString);
    
    await sendCommand(`MAIL FROM:<${username}>`);
    await sendCommand(`RCPT TO:<${to}>`);
    await sendCommand('DATA');
    await conn.write(encoder.encode(message + '\r\n.\r\n'));
    await readResponse();
    await sendCommand('QUIT');

    conn.close();
    return true;
  } catch (error) {
    console.error('SMTP Error:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let emailRequest: EmailRequest;
    try {
      emailRequest = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { to, templateKey, templateData, subject, htmlBody, textBody } = emailRequest;

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient email is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let finalSubject = subject || '';
    let finalHtmlBody = htmlBody || '';
    let finalTextBody = textBody || '';

    if (templateKey) {
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_key', templateKey)
        .maybeSingle();

      if (templateError || !template) {
        return new Response(
          JSON.stringify({ error: `Template not found: ${templateKey}` }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const data = templateData || {};
      finalSubject = renderTemplate(template.subject_template, data);
      finalHtmlBody = renderTemplate(template.body_html, data);
      finalTextBody = template.body_text
        ? renderTemplate(template.body_text, data)
        : finalHtmlBody.replace(/<[^>]*>/g, '');
    }

    if (!finalSubject || !finalHtmlBody) {
      return new Response(
        JSON.stringify({ error: 'Subject and body are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const success = await sendEmailViaSMTP(to, finalSubject, finalHtmlBody, finalTextBody);

    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Failed to send email - please check SMTP configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});