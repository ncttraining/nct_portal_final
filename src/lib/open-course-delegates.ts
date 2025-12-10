/**
 * Open Course Delegates List Library
 *
 * Functions for managing and querying delegates across all open courses
 * for the delegates list view.
 */

import { supabase } from './supabase';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DelegateWithDetails {
  id: string;
  delegate_name: string;
  delegate_email: string;
  delegate_phone: string | null;
  delegate_company: string | null;
  company_id: string | null;
  company_name: string | null;
  session_id: string;
  session_date: string;
  session_end_date: string | null;
  event_title: string;
  course_type_id: string | null;
  course_type_name: string | null;
  course_type_code: string | null;
  venue_id: string | null;
  venue_name: string | null;
  trainer_name: string | null;
  attendance_status: string | null;
  attendance_detail: string | null;
  certificate_issued: boolean;
  certificate_number: string | null;
  certificate?: {
    id: string;
    certificate_number: string;
    certificate_pdf_url: string;
    status: string;
    issue_date: string;
    expiry_date: string | null;
  } | null;
  created_at: string;
}

export interface DelegateHistory {
  delegate_id: string;
  delegate_name: string;
  delegate_email: string;
  delegate_phone: string | null;
  company_name: string | null;
  courses: DelegateCourse[];
}

export interface DelegateCourse {
  session_id: string;
  session_date: string;
  event_title: string;
  course_type_name: string | null;
  venue_name: string | null;
  trainer_name: string | null;
  attendance_status: string | null;
  attendance_detail: string | null;
  certificate_issued: boolean;
  certificate?: {
    id: string;
    certificate_number: string;
    certificate_pdf_url: string;
    status: string;
    issue_date: string;
    expiry_date: string | null;
  } | null;
}

export type AttendanceStatusFilter = 'all' | 'attended' | 'absent' | 'pending';
export type CertificateStatusFilter = 'all' | 'issued' | 'pending' | 'not_applicable';

// ============================================================================
// Main Query Functions
// ============================================================================

export async function getAllDelegates(filters?: {
  searchTerm?: string;
  companyId?: string;
  courseTypeId?: string;
  venueId?: string;
  attendanceStatus?: AttendanceStatusFilter;
  certificateStatus?: CertificateStatusFilter;
  dateFrom?: string;
  dateTo?: string;
}): Promise<DelegateWithDetails[]> {
  let query = supabase
    .from('open_course_delegates')
    .select(`
      id,
      delegate_name,
      delegate_email,
      delegate_phone,
      delegate_company,
      company_id,
      session_id,
      attendance_status,
      attendance_detail,
      certificate_issued,
      certificate_number,
      created_at,
      open_course_sessions!session_id (
        id,
        session_date,
        end_date,
        event_title,
        course_type_id,
        venue_id,
        trainer_id,
        course_types (
          id,
          name,
          code
        ),
        venues (
          id,
          name
        ),
        trainers (
          name
        )
      ),
      open_course_companies (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false });

  // Apply company filter
  if (filters?.companyId) {
    query = query.eq('company_id', filters.companyId);
  }

  // Apply search filter
  if (filters?.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    query = query.or(`delegate_name.ilike.%${term}%,delegate_email.ilike.%${term}%,delegate_company.ilike.%${term}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading delegates:', error);
    return [];
  }

  // Transform and filter the data
  let delegates: DelegateWithDetails[] = (data || []).map(delegate => {
    const session = (delegate as any).open_course_sessions;
    const company = (delegate as any).open_course_companies;

    return {
      id: delegate.id,
      delegate_name: delegate.delegate_name,
      delegate_email: delegate.delegate_email,
      delegate_phone: delegate.delegate_phone,
      delegate_company: delegate.delegate_company,
      company_id: delegate.company_id,
      company_name: company?.name || delegate.delegate_company || null,
      session_id: delegate.session_id,
      session_date: session?.session_date || '',
      session_end_date: session?.end_date || session?.session_date || null,
      event_title: session?.event_title || '',
      course_type_id: session?.course_type_id || null,
      course_type_name: session?.course_types?.name || null,
      course_type_code: session?.course_types?.code || null,
      venue_id: session?.venue_id || null,
      venue_name: session?.venues?.name || null,
      trainer_name: session?.trainers?.name || null,
      attendance_status: delegate.attendance_status,
      attendance_detail: delegate.attendance_detail,
      certificate_issued: delegate.certificate_issued,
      certificate_number: delegate.certificate_number,
      created_at: delegate.created_at,
    };
  });

  // Apply course type filter
  if (filters?.courseTypeId) {
    delegates = delegates.filter(d => d.course_type_id === filters.courseTypeId);
  }

  // Apply venue filter
  if (filters?.venueId) {
    delegates = delegates.filter(d => d.venue_id === filters.venueId);
  }

  // Apply date range filter
  if (filters?.dateFrom) {
    delegates = delegates.filter(d => d.session_date >= filters.dateFrom!);
  }

  if (filters?.dateTo) {
    delegates = delegates.filter(d => d.session_date <= filters.dateTo!);
  }

  // Apply attendance status filter
  if (filters?.attendanceStatus && filters.attendanceStatus !== 'all') {
    delegates = delegates.filter(d => {
      const attended = d.attendance_detail === 'attended' || d.attendance_detail === 'late' || d.attendance_detail === 'left_early';
      const absent = d.attendance_detail === 'absent';

      switch (filters.attendanceStatus) {
        case 'attended':
          return attended;
        case 'absent':
          return absent;
        case 'pending':
          return !attended && !absent;
        default:
          return true;
      }
    });
  }

  // Apply certificate status filter
  if (filters?.certificateStatus && filters.certificateStatus !== 'all') {
    delegates = delegates.filter(d => {
      const attended = d.attendance_detail === 'attended' || d.attendance_detail === 'late' || d.attendance_detail === 'left_early';

      switch (filters.certificateStatus) {
        case 'issued':
          return d.certificate_issued;
        case 'pending':
          return attended && !d.certificate_issued;
        case 'not_applicable':
          return !attended;
        default:
          return true;
      }
    });
  }

  // Now fetch certificates for all delegates
  const delegateIds = delegates.map(d => d.id);

  if (delegateIds.length > 0) {
    const { data: certificates } = await supabase
      .from('certificates')
      .select('id, open_course_delegate_id, certificate_number, certificate_pdf_url, status, issue_date, expiry_date')
      .in('open_course_delegate_id', delegateIds);

    const certificateMap = new Map(
      (certificates || []).map(c => [c.open_course_delegate_id, c])
    );

    delegates = delegates.map(d => ({
      ...d,
      certificate: certificateMap.get(d.id) ? {
        id: certificateMap.get(d.id)!.id,
        certificate_number: certificateMap.get(d.id)!.certificate_number,
        certificate_pdf_url: certificateMap.get(d.id)!.certificate_pdf_url,
        status: certificateMap.get(d.id)!.status,
        issue_date: certificateMap.get(d.id)!.issue_date,
        expiry_date: certificateMap.get(d.id)!.expiry_date,
      } : null,
      certificate_issued: d.certificate_issued || !!certificateMap.get(d.id),
    }));
  }

  return delegates;
}

export async function getDelegateById(delegateId: string): Promise<DelegateWithDetails | null> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .select(`
      id,
      delegate_name,
      delegate_email,
      delegate_phone,
      delegate_company,
      company_id,
      session_id,
      attendance_status,
      attendance_detail,
      certificate_issued,
      certificate_number,
      created_at,
      open_course_sessions!session_id (
        id,
        session_date,
        end_date,
        event_title,
        course_type_id,
        venue_id,
        trainer_id,
        course_types (
          id,
          name,
          code
        ),
        venues (
          id,
          name
        ),
        trainers (
          name
        )
      ),
      open_course_companies (
        id,
        name
      )
    `)
    .eq('id', delegateId)
    .single();

  if (error) {
    console.error('Error loading delegate:', error);
    return null;
  }

  const session = (data as any).open_course_sessions;
  const company = (data as any).open_course_companies;

  // Get certificate if exists
  const { data: certificate } = await supabase
    .from('certificates')
    .select('id, certificate_number, certificate_pdf_url, status, issue_date, expiry_date')
    .eq('open_course_delegate_id', delegateId)
    .maybeSingle();

  return {
    id: data.id,
    delegate_name: data.delegate_name,
    delegate_email: data.delegate_email,
    delegate_phone: data.delegate_phone,
    delegate_company: data.delegate_company,
    company_id: data.company_id,
    company_name: company?.name || data.delegate_company || null,
    session_id: data.session_id,
    session_date: session?.session_date || '',
    session_end_date: session?.end_date || session?.session_date || null,
    event_title: session?.event_title || '',
    course_type_id: session?.course_type_id || null,
    course_type_name: session?.course_types?.name || null,
    course_type_code: session?.course_types?.code || null,
    venue_id: session?.venue_id || null,
    venue_name: session?.venues?.name || null,
    trainer_name: session?.trainers?.name || null,
    attendance_status: data.attendance_status,
    attendance_detail: data.attendance_detail,
    certificate_issued: data.certificate_issued || !!certificate,
    certificate_number: data.certificate_number || certificate?.certificate_number || null,
    certificate: certificate ? {
      id: certificate.id,
      certificate_number: certificate.certificate_number,
      certificate_pdf_url: certificate.certificate_pdf_url,
      status: certificate.status,
      issue_date: certificate.issue_date,
      expiry_date: certificate.expiry_date,
    } : null,
    created_at: data.created_at,
  };
}

export async function getDelegateHistory(delegateEmail: string, delegateName: string): Promise<DelegateHistory | null> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .select(`
      id,
      delegate_name,
      delegate_email,
      delegate_phone,
      delegate_company,
      company_id,
      session_id,
      attendance_status,
      attendance_detail,
      certificate_issued,
      certificate_number,
      open_course_sessions!session_id (
        id,
        session_date,
        event_title,
        course_types (
          name
        ),
        venues (
          name
        ),
        trainers (
          name
        )
      ),
      open_course_companies (
        name
      )
    `)
    .eq('delegate_email', delegateEmail)
    .ilike('delegate_name', delegateName)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    console.error('Error loading delegate history:', error);
    return null;
  }

  // Get certificates for all delegate records
  const delegateIds = data.map(d => d.id);
  const { data: certificates } = await supabase
    .from('certificates')
    .select('id, open_course_delegate_id, certificate_number, certificate_pdf_url, status, issue_date, expiry_date')
    .in('open_course_delegate_id', delegateIds);

  const certificateMap = new Map(
    (certificates || []).map(c => [c.open_course_delegate_id, c])
  );

  const firstRecord = data[0];
  const company = (firstRecord as any).open_course_companies;

  const courses: DelegateCourse[] = data.map(d => {
    const session = (d as any).open_course_sessions;
    const cert = certificateMap.get(d.id);

    return {
      session_id: d.session_id,
      session_date: session?.session_date || '',
      event_title: session?.event_title || '',
      course_type_name: session?.course_types?.name || null,
      venue_name: session?.venues?.name || null,
      trainer_name: session?.trainers?.name || null,
      attendance_status: d.attendance_status,
      attendance_detail: d.attendance_detail,
      certificate_issued: d.certificate_issued || !!cert,
      certificate: cert ? {
        id: cert.id,
        certificate_number: cert.certificate_number,
        certificate_pdf_url: cert.certificate_pdf_url,
        status: cert.status,
        issue_date: cert.issue_date,
        expiry_date: cert.expiry_date,
      } : null,
    };
  });

  return {
    delegate_id: firstRecord.id,
    delegate_name: firstRecord.delegate_name,
    delegate_email: firstRecord.delegate_email,
    delegate_phone: firstRecord.delegate_phone,
    company_name: company?.name || firstRecord.delegate_company || null,
    courses,
  };
}

// ============================================================================
// Update Functions
// ============================================================================

export async function updateDelegateDetails(delegateId: string, updates: {
  delegate_name?: string;
  delegate_email?: string;
  delegate_phone?: string;
  company_id?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('open_course_delegates')
    .update(updates)
    .eq('id', delegateId);

  if (error) {
    console.error('Error updating delegate:', error);
    throw error;
  }
}

// ============================================================================
// Statistics Functions
// ============================================================================

export async function getDelegateStats(): Promise<{
  total: number;
  withCompany: number;
  attended: number;
  certificatesIssued: number;
}> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .select('company_id, attendance_detail, certificate_issued');

  if (error) {
    console.error('Error loading delegate stats:', error);
    return { total: 0, withCompany: 0, attended: 0, certificatesIssued: 0 };
  }

  const total = data?.length || 0;
  const withCompany = data?.filter(d => d.company_id).length || 0;
  const attended = data?.filter(d =>
    d.attendance_detail === 'attended' ||
    d.attendance_detail === 'late' ||
    d.attendance_detail === 'left_early'
  ).length || 0;
  const certificatesIssued = data?.filter(d => d.certificate_issued).length || 0;

  return { total, withCompany, attended, certificatesIssued };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function getAttendanceStatus(delegate: DelegateWithDetails): 'attended' | 'absent' | 'pending' {
  const attended = delegate.attendance_detail === 'attended' ||
    delegate.attendance_detail === 'late' ||
    delegate.attendance_detail === 'left_early';

  if (attended) return 'attended';
  if (delegate.attendance_detail === 'absent') return 'absent';
  return 'pending';
}

export function getCertificateStatus(delegate: DelegateWithDetails): 'issued' | 'pending' | 'not_applicable' {
  const attended = getAttendanceStatus(delegate) === 'attended';

  if (delegate.certificate_issued) return 'issued';
  if (attended) return 'pending';
  return 'not_applicable';
}
