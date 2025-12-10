/**
 * Open Course Companies Library
 *
 * Functions for managing open course companies and their delegates.
 */

import { supabase } from './supabase';

// ============================================================================
// Type Definitions
// ============================================================================

export interface OpenCourseCompany {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  telephone: string | null;
  address1: string | null;
  address2: string | null;
  town: string | null;
  postcode: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpenCourseCompanyWithStats extends OpenCourseCompany {
  delegate_count: number;
  courses_completed: number;
  certificates_issued: number;
}

export interface CompanyDelegate {
  id: string;
  delegate_name: string;
  delegate_email: string;
  delegate_phone: string | null;
  session_id: string;
  session_date: string;
  course_type_name: string | null;
  course_type_code: string | null;
  venue_name: string | null;
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
}

export interface CompanyCourseSummary {
  course_type_id: string;
  course_type_name: string;
  course_type_code: string;
  sessions_count: number;
  delegates_count: number;
  certificates_issued: number;
}

// ============================================================================
// Company CRUD Functions
// ============================================================================

export async function getOpenCourseCompanies(filters?: {
  searchTerm?: string;
  activeOnly?: boolean;
}): Promise<OpenCourseCompanyWithStats[]> {
  let query = supabase
    .from('open_course_companies')
    .select('*')
    .order('name');

  if (filters?.activeOnly !== false) {
    query = query.eq('active', true);
  }

  if (filters?.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    query = query.or(`name.ilike.%${term}%,contact_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading companies:', error);
    return [];
  }

  // Get stats for each company
  const companyIds = (data || []).map(c => c.id);

  if (companyIds.length === 0) {
    return [];
  }

  // Get delegate counts and attendance stats
  const { data: delegates } = await supabase
    .from('open_course_delegates')
    .select('id, company_id, attendance_detail')
    .in('company_id', companyIds);

  // Get certificate counts from certificates table
  const delegateIds = (delegates || []).map(d => d.id);
  let certificateDelegateIds = new Set<string>();

  // Batch certificate queries to avoid URL length limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < delegateIds.length; i += BATCH_SIZE) {
    const batchIds = delegateIds.slice(i, i + BATCH_SIZE);
    const { data: certs } = await supabase
      .from('certificates')
      .select('open_course_delegate_id')
      .in('open_course_delegate_id', batchIds);

    (certs || []).forEach(c => certificateDelegateIds.add(c.open_course_delegate_id));
  }

  const delegateStats = new Map<string, { delegates: number; completed: number; certificates: number }>();

  (delegates || []).forEach(d => {
    if (!d.company_id) return;

    const stats = delegateStats.get(d.company_id) || { delegates: 0, completed: 0, certificates: 0 };
    stats.delegates++;

    // Count completed courses (attended)
    if (d.attendance_detail === 'attended' || d.attendance_detail === 'late' || d.attendance_detail === 'left_early') {
      stats.completed++;
    }

    if (certificateDelegateIds.has(d.id)) {
      stats.certificates++;
    }

    delegateStats.set(d.company_id, stats);
  });

  return (data || []).map(company => ({
    ...company,
    delegate_count: delegateStats.get(company.id)?.delegates || 0,
    courses_completed: delegateStats.get(company.id)?.completed || 0,
    certificates_issued: delegateStats.get(company.id)?.certificates || 0,
  }));
}

export async function getOpenCourseCompanyById(id: string): Promise<OpenCourseCompanyWithStats | null> {
  const { data, error } = await supabase
    .from('open_course_companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error loading company:', error);
    return null;
  }

  // Get delegate stats for this company
  const { data: delegates } = await supabase
    .from('open_course_delegates')
    .select('id, attendance_detail')
    .eq('company_id', id);

  // Get certificate count from certificates table
  const delegateIds = (delegates || []).map(d => d.id);
  let certificatesIssued = 0;

  if (delegateIds.length > 0) {
    const { count } = await supabase
      .from('certificates')
      .select('*', { count: 'exact', head: true })
      .in('open_course_delegate_id', delegateIds);

    certificatesIssued = count || 0;
  }

  let delegateCount = 0;
  let coursesCompleted = 0;

  (delegates || []).forEach(d => {
    delegateCount++;
    if (d.attendance_detail === 'attended' || d.attendance_detail === 'late' || d.attendance_detail === 'left_early') {
      coursesCompleted++;
    }
  });

  return {
    ...data,
    delegate_count: delegateCount,
    courses_completed: coursesCompleted,
    certificates_issued: certificatesIssued,
  };
}

export async function createOpenCourseCompany(
  company: Omit<OpenCourseCompany, 'id' | 'created_at' | 'updated_at'>
): Promise<OpenCourseCompany> {
  const { data, error } = await supabase
    .from('open_course_companies')
    .insert([company])
    .select()
    .single();

  if (error) {
    console.error('Error creating company:', error);
    throw error;
  }

  return data;
}

export async function updateOpenCourseCompany(
  id: string,
  updates: Partial<OpenCourseCompany>
): Promise<OpenCourseCompany> {
  const { data, error } = await supabase
    .from('open_course_companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating company:', error);
    throw error;
  }

  return data;
}

export async function deleteOpenCourseCompany(id: string): Promise<void> {
  // First, unlink delegates from this company
  await supabase
    .from('open_course_delegates')
    .update({ company_id: null })
    .eq('company_id', id);

  const { error } = await supabase
    .from('open_course_companies')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting company:', error);
    throw error;
  }
}

// ============================================================================
// Company Delegates Functions
// ============================================================================

export async function getCompanyDelegates(companyId: string): Promise<CompanyDelegate[]> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .select(`
      id,
      delegate_name,
      delegate_email,
      delegate_phone,
      session_id,
      attendance_status,
      attendance_detail,
      open_course_sessions!session_id (
        session_date,
        course_types (
          name,
          code
        ),
        venues (
          name
        )
      )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading company delegates:', error);
    return [];
  }

  // Get certificates for these delegates
  const delegateIds = (data || []).map(d => d.id);
  let certificateMap = new Map<string, any>();

  if (delegateIds.length > 0) {
    const { data: certificates } = await supabase
      .from('certificates')
      .select('id, open_course_delegate_id, certificate_number, certificate_pdf_url, status, issue_date, expiry_date')
      .in('open_course_delegate_id', delegateIds);

    certificateMap = new Map(
      (certificates || []).map(c => [c.open_course_delegate_id, c])
    );
  }

  return (data || []).map(delegate => {
    const session = (delegate as any).open_course_sessions;
    const cert = certificateMap.get(delegate.id);

    return {
      id: delegate.id,
      delegate_name: delegate.delegate_name,
      delegate_email: delegate.delegate_email,
      delegate_phone: delegate.delegate_phone,
      session_id: delegate.session_id,
      session_date: session?.session_date || '',
      course_type_name: session?.course_types?.name || null,
      course_type_code: session?.course_types?.code || null,
      venue_name: session?.venues?.name || null,
      attendance_status: delegate.attendance_status,
      attendance_detail: delegate.attendance_detail,
      certificate_issued: !!cert,
      certificate_number: cert?.certificate_number || null,
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
}

export async function getCompanyCourseSummary(companyId: string): Promise<CompanyCourseSummary[]> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .select(`
      id,
      open_course_sessions!session_id (
        course_type_id,
        course_types (
          id,
          name,
          code
        )
      )
    `)
    .eq('company_id', companyId);

  if (error) {
    console.error('Error loading company course summary:', error);
    return [];
  }

  // Get certificates for delegates
  const delegateIds = (data || []).map(d => d.id);
  let certificateDelegateIds = new Set<string>();

  if (delegateIds.length > 0) {
    const { data: certs } = await supabase
      .from('certificates')
      .select('open_course_delegate_id')
      .in('open_course_delegate_id', delegateIds);

    (certs || []).forEach(c => certificateDelegateIds.add(c.open_course_delegate_id));
  }

  const courseMap = new Map<string, CompanyCourseSummary>();

  (data || []).forEach(delegate => {
    const session = (delegate as any).open_course_sessions;
    const courseType = session?.course_types;

    if (!courseType) return;

    const existing = courseMap.get(courseType.id) || {
      course_type_id: courseType.id,
      course_type_name: courseType.name,
      course_type_code: courseType.code,
      sessions_count: 0,
      delegates_count: 0,
      certificates_issued: 0,
    };

    existing.delegates_count++;
    if (certificateDelegateIds.has(delegate.id)) {
      existing.certificates_issued++;
    }

    courseMap.set(courseType.id, existing);
  });

  // Count unique sessions per course type
  const sessionCountQuery = await supabase
    .from('open_course_delegates')
    .select('session_id, open_course_sessions!session_id(course_type_id)')
    .eq('company_id', companyId);

  const sessionsByCourseType = new Map<string, Set<string>>();
  (sessionCountQuery.data || []).forEach(d => {
    const courseTypeId = (d as any).open_course_sessions?.course_type_id;
    if (!courseTypeId) return;

    if (!sessionsByCourseType.has(courseTypeId)) {
      sessionsByCourseType.set(courseTypeId, new Set());
    }
    sessionsByCourseType.get(courseTypeId)!.add(d.session_id);
  });

  sessionsByCourseType.forEach((sessions, courseTypeId) => {
    const summary = courseMap.get(courseTypeId);
    if (summary) {
      summary.sessions_count = sessions.size;
    }
  });

  return Array.from(courseMap.values()).sort((a, b) => a.course_type_name.localeCompare(b.course_type_name));
}

// ============================================================================
// Delegate-Company Linking Functions
// ============================================================================

export async function linkDelegateToCompany(delegateId: string, companyId: string | null): Promise<void> {
  const { error } = await supabase
    .from('open_course_delegates')
    .update({ company_id: companyId })
    .eq('id', delegateId);

  if (error) {
    console.error('Error linking delegate to company:', error);
    throw error;
  }
}

export async function bulkLinkDelegatesToCompany(delegateIds: string[], companyId: string): Promise<void> {
  const { error } = await supabase
    .from('open_course_delegates')
    .update({ company_id: companyId })
    .in('id', delegateIds);

  if (error) {
    console.error('Error bulk linking delegates to company:', error);
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export async function findOrCreateCompanyByName(companyName: string): Promise<OpenCourseCompany> {
  // First try to find existing company (case-insensitive)
  const { data: existing } = await supabase
    .from('open_course_companies')
    .select('*')
    .ilike('name', companyName)
    .limit(1)
    .single();

  if (existing) {
    return existing;
  }

  // Create new company
  return createOpenCourseCompany({
    name: companyName,
    contact_name: null,
    email: null,
    telephone: null,
    address1: null,
    address2: null,
    town: null,
    postcode: null,
    notes: null,
    active: true,
  });
}

export async function getCompaniesForDropdown(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('open_course_companies')
    .select('id, name')
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('Error loading companies for dropdown:', error);
    return [];
  }

  return data || [];
}
