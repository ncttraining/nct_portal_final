import { supabase } from './supabase';

export interface EmailQueueEntry {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  template_key: string | null;
  template_data: Record<string, string> | null;
  attachments: EmailAttachment[] | null;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  scheduled_at: string;
  processing_started_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
}

export interface EmailAttachment {
  url: string;
  filename: string;
}

export interface QueueEmailParams {
  recipientEmail: string;
  recipientName?: string;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  templateKey?: string;
  templateData?: Record<string, string>;
  attachments?: EmailAttachment[];
  priority?: number;
  scheduledAt?: Date;
}

export interface EmailQueueStats {
  pending_count: number;
  processing_count: number;
  sent_count: number;
  failed_count: number;
  cancelled_count: number;
  total_count: number;
  last_sent_at: string | null;
  last_processing_at: string | null;
}

export interface EmailQueueFilters {
  status?: string;
  templateKey?: string;
  searchQuery?: string;
  startDate?: Date;
  endDate?: Date;
}

export async function queueEmail(params: QueueEmailParams): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (params.templateKey && !params.subject) {
      params.subject = 'Email';
    }

    if (!params.subject || (!params.htmlBody && !params.templateKey)) {
      console.error('Either subject and htmlBody, or templateKey must be provided');
      return null;
    }

    const emailData = {
      recipient_email: params.recipientEmail,
      recipient_name: params.recipientName || null,
      subject: params.subject || '',
      html_body: params.htmlBody || '',
      text_body: params.textBody || null,
      template_key: params.templateKey || null,
      template_data: params.templateData || null,
      attachments: params.attachments || null,
      priority: params.priority || 5,
      scheduled_at: params.scheduledAt?.toISOString() || new Date().toISOString(),
      created_by_user_id: user?.id || null,
    };

    const { data, error } = await supabase
      .from('email_queue')
      .insert(emailData)
      .select('id')
      .single();

    if (error) {
      console.error('Error queueing email:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Failed to queue email:', error);
    return null;
  }
}

export async function getEmailQueueEntry(id: string): Promise<EmailQueueEntry | null> {
  try {
    const { data, error } = await supabase
      .from('email_queue')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching email:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch email:', error);
    return null;
  }
}

export async function getEmailQueue(
  filters: EmailQueueFilters = {},
  limit: number = 50,
  offset: number = 0
): Promise<{ emails: EmailQueueEntry[]; total: number }> {
  try {
    let query = supabase
      .from('email_queue')
      .select('*', { count: 'exact' });

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.templateKey && filters.templateKey !== 'all') {
      query = query.eq('template_key', filters.templateKey);
    }

    if (filters.searchQuery) {
      query = query.or(
        `recipient_email.ilike.%${filters.searchQuery}%,` +
        `recipient_name.ilike.%${filters.searchQuery}%,` +
        `subject.ilike.%${filters.searchQuery}%`
      );
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching email queue:', error);
      return { emails: [], total: 0 };
    }

    return { emails: data || [], total: count || 0 };
  } catch (error) {
    console.error('Failed to fetch email queue:', error);
    return { emails: [], total: 0 };
  }
}

export async function getEmailQueueStats(): Promise<EmailQueueStats | null> {
  try {
    const { data, error } = await supabase
      .from('email_queue_stats')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error fetching email queue stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch email queue stats:', error);
    return null;
  }
}

export async function retryEmail(id: string): Promise<boolean> {
  try {
    // Allow retrying both 'failed' and 'cancelled' emails
    const { error } = await supabase
      .from('email_queue')
      .update({
        status: 'pending',
        error_message: null,
        scheduled_at: new Date().toISOString(),
        attempts: 0, // Reset attempts counter
      })
      .eq('id', id)
      .in('status', ['failed', 'cancelled']);

    if (error) {
      console.error('Error retrying email:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to retry email:', error);
    return false;
  }
}

export async function cancelEmail(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('email_queue')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .in('status', ['pending', 'failed']);

    if (error) {
      console.error('Error cancelling email:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to cancel email:', error);
    return false;
  }
}

export async function bulkRetryEmails(ids: string[]): Promise<number> {
  try {
    // Allow retrying both 'failed' and 'cancelled' emails
    const { data, error } = await supabase
      .from('email_queue')
      .update({
        status: 'pending',
        error_message: null,
        scheduled_at: new Date().toISOString(),
        attempts: 0, // Reset attempts counter for cancelled emails
      })
      .in('id', ids)
      .in('status', ['failed', 'cancelled'])
      .select('id');

    if (error) {
      console.error('Error bulk retrying emails:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Failed to bulk retry emails:', error);
    return 0;
  }
}

export async function bulkCancelEmails(ids: string[]): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('email_queue')
      .update({ status: 'cancelled' })
      .in('id', ids)
      .in('status', ['pending', 'failed'])
      .select('id');

    if (error) {
      console.error('Error bulk cancelling emails:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Failed to bulk cancel emails:', error);
    return 0;
  }
}

export async function getUniqueTemplateKeys(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('email_queue')
      .select('template_key')
      .not('template_key', 'is', null)
      .order('template_key');

    if (error) {
      console.error('Error fetching template keys:', error);
      return [];
    }

    const uniqueKeys = [...new Set(data.map(item => item.template_key).filter(Boolean))];
    return uniqueKeys as string[];
  } catch (error) {
    console.error('Failed to fetch template keys:', error);
    return [];
  }
}
