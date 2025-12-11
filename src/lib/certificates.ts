import { supabase } from './supabase';
import { generateCertificatePDF } from './pdf-generator';

export type CourseFieldDefinition = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'dropdown';
  required: boolean;
  scope: 'course' | 'candidate';
  placeholder?: string;
  options?: string[];
  unit?: 'hours' | 'days';
};

export type CourseType = {
  id: string;
  name: string;
  code: string;
  trainer_type_id: string | null;
  description: string;
  duration_days: number | null;
  duration_unit: 'hours' | 'days';
  certificate_validity_months: number | null;
  sort_order: number;
  active: boolean;
  required_fields: CourseFieldDefinition[];
  certificate_field_mappings: Record<string, string>;
  default_course_data: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type CertificateField = {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'date' | 'number';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
};

export type CertificateTemplate = {
  id: string;
  course_type_id: string;
  name: string;
  background_image_url: string;
  page_width: number;
  page_height: number;
  fields_config: CertificateField[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Certificate = {
  id: string;
  certificate_number: string;
  course_type_id: string;
  booking_id: string | null;
  candidate_id: string | null;
  open_course_session_id: string | null;
  open_course_delegate_id: string | null;
  candidate_name: string;
  candidate_email: string;
  trainer_id: string | null;
  trainer_name: string;
  course_date_start: string;
  course_date_end: string;
  issue_date: string;
  expiry_date: string | null;
  certificate_pdf_url: string;
  status: 'issued' | 'revoked' | 'expired';
  revoked_at: string | null;
  revoked_reason: string;
  sent_at: string | null;
  course_specific_data: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type BookingWithCandidates = {
  id: string;
  title: string;
  booking_date: string;
  num_days: number;
  course_type_id: string | null;
  trainer_id: string;
  trainer_name: string;
  client_name: string;
  course_date_end: string;
  candidates: {
    id: string;
    candidate_name: string;
    email: string;
    passed: boolean;
    certificate_id?: string;
  }[];
  course_types?: CourseType;
  trainers?: { name: string };
};

export type OpenCourseSessionWithDelegates = {
  id: string;
  event_title: string;
  session_date: string;
  end_date: string | null;
  course_type_id: string | null;
  trainer_id: string | null;
  trainer_name: string;
  venue_name: string | null;
  status: string;
  session_end_date: string;
  course_level_data?: Record<string, any>;
  delegates: {
    id: string;
    delegate_name: string;
    delegate_email: string;
    attendance_status: string | null;
    attendance_detail: string | null;
    certificate_issued: boolean;
    certificate?: {
      id: string;
      certificate_number: string;
      certificate_pdf_url: string;
      status: string;
    } | null;
  }[];
  course_types?: CourseType;
  trainers?: { name: string };
  venue?: { name: string };
};

export async function getCourseTypes() {
  const { data, error } = await supabase
    .from('course_types')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error loading course types:', error);
    return [];
  }

  return data as CourseType[];
}

export async function getCourseType(id: string) {
  const { data, error } = await supabase
    .from('course_types')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error loading course type:', error);
    return null;
  }

  return data as CourseType;
}

export async function saveCourseType(courseType: Partial<CourseType>) {
  if (courseType.id) {
    const { error } = await supabase
      .from('course_types')
      .update(courseType)
      .eq('id', courseType.id);

    if (error) {
      console.error('Error updating course type:', error);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from('course_types')
      .insert([courseType]);

    if (error) {
      console.error('Error creating course type:', error);
      throw error;
    }
  }
}

export async function deleteCourseType(id: string) {
  const { error } = await supabase
    .from('course_types')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting course type:', error);
    throw error;
  }
}

export async function getCertificateTemplates(courseTypeId?: string) {
  let query = supabase
    .from('certificate_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (courseTypeId) {
    query = query.eq('course_type_id', courseTypeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading certificate templates:', error);
    return [];
  }

  return data as CertificateTemplate[];
}

export async function getCertificateTemplate(id: string) {
  const { data, error } = await supabase
    .from('certificate_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error loading certificate template:', error);
    return null;
  }

  return data as CertificateTemplate;
}

export async function saveCertificateTemplate(template: Partial<CertificateTemplate>) {
  if (template.id) {
    const { error } = await supabase
      .from('certificate_templates')
      .update(template)
      .eq('id', template.id);

    if (error) {
      console.error('Error updating certificate template:', error);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from('certificate_templates')
      .insert([template]);

    if (error) {
      console.error('Error creating certificate template:', error);
      throw error;
    }
  }
}

export async function deleteCertificateTemplate(id: string) {
  const { error } = await supabase
    .from('certificate_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting certificate template:', error);
    throw error;
  }
}

export async function duplicateCertificateTemplate(id: string) {
  const template = await getCertificateTemplate(id);
  if (!template) {
    throw new Error('Template not found');
  }

  const duplicatedTemplate: Partial<CertificateTemplate> = {
    course_type_id: template.course_type_id,
    name: `${template.name} (Copy)`,
    background_image_url: template.background_image_url,
    page_width: template.page_width,
    page_height: template.page_height,
    fields_config: template.fields_config,
    is_active: true
  };

  const { data, error } = await supabase
    .from('certificate_templates')
    .insert([duplicatedTemplate])
    .select()
    .single();

  if (error) {
    console.error('Error duplicating certificate template:', error);
    throw error;
  }

  return data as CertificateTemplate;
}

export async function uploadCertificateBackground(file: File, courseTypeCode: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${courseTypeCode}_${Date.now()}.${fileExt}`;
  const filePath = `certificate-backgrounds/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('certificates')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Error uploading file:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('certificates')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function getCertificates(filters?: {
  courseTypeId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  expiryStatus?: 'valid' | 'expiring_soon' | 'expired';
  searchTerm?: string;
}) {
  let query = supabase
    .from('certificates')
    .select('*, course_types(name, code), bookings(title), open_course_sessions(event_title)')
    .order('issue_date', { ascending: false });

  if (filters?.courseTypeId) {
    query = query.eq('course_type_id', filters.courseTypeId);
  }

  if (filters?.startDate) {
    query = query.gte('issue_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('issue_date', filters.endDate);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.searchTerm) {
    query = query.or(`candidate_name.ilike.%${filters.searchTerm}%,certificate_number.ilike.%${filters.searchTerm}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading certificates:', error);
    return [];
  }

  let certificates = data as Certificate[];

  if (filters?.expiryStatus) {
    certificates = certificates.filter(cert =>
      getExpiryStatus(cert.expiry_date) === filters.expiryStatus
    );
  }

  return certificates;
}

export async function getCertificate(id: string) {
  const { data, error } = await supabase
    .from('certificates')
    .select('*, course_types(name, code, required_fields)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error loading certificate:', error);
    return null;
  }

  return data as Certificate;
}

export async function getCertificateByCertificateNumber(certificateNumber: string) {
  const { data, error } = await supabase
    .from('certificates')
    .select('*, course_types(name, code)')
    .eq('certificate_number', certificateNumber)
    .maybeSingle();

  if (error) {
    console.error('Error loading certificate:', error);
    return null;
  }

  return data as Certificate | null;
}

export async function generateCertificateNumber(courseTypeCode: string) {
  const year = new Date().getFullYear();
  const prefix = `${courseTypeCode}-${year}-`;

  const { data, error } = await supabase
    .from('certificates')
    .select('certificate_number')
    .like('certificate_number', `${prefix}%`)
    .order('certificate_number', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error generating certificate number:', error);
    throw error;
  }

  let nextNumber = 1;
  if (data && data.length > 0) {
    const lastNumber = data[0].certificate_number.split('-').pop();
    nextNumber = parseInt(lastNumber || '0', 10) + 1;
  }

  return `${prefix}${String(nextNumber).padStart(5, '0')}`;
}

export async function saveCertificate(certificate: Partial<Certificate>) {
  if (certificate.id) {
    const { error } = await supabase
      .from('certificates')
      .update(certificate)
      .eq('id', certificate.id);

    if (error) {
      console.error('Error updating certificate:', error);
      throw error;
    }
  } else {
    const { data, error } = await supabase
      .from('certificates')
      .insert([certificate])
      .select()
      .single();

    if (error) {
      console.error('Error creating certificate:', error);
      throw error;
    }

    return data as Certificate;
  }
}

export async function issueCertificate({
  bookingId,
  candidateId,
  candidateName,
  candidateEmail,
  courseTypeId,
  trainerId,
  trainerName,
  courseStartDate,
  courseEndDate,
  courseSpecificData,
  templateId,
}: {
  bookingId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  courseTypeId: string;
  trainerId: string;
  trainerName: string;
  courseStartDate: string;
  courseEndDate: string;
  courseSpecificData: Record<string, any>;
  templateId: string;
}) {
  const courseType = await getCourseType(courseTypeId);
  if (!courseType) {
    throw new Error('Course type not found');
  }

  const certificateNumber = await generateCertificateNumber(courseType.code);
  const issueDate = new Date().toISOString().split('T')[0];
  const expiryDate = calculateExpiryDate(issueDate, courseType.certificate_validity_months);

  const certificate = await saveCertificate({
    certificate_number: certificateNumber,
    course_type_id: courseTypeId,
    booking_id: bookingId,
    candidate_id: candidateId,
    candidate_name: candidateName,
    candidate_email: candidateEmail,
    trainer_id: trainerId,
    trainer_name: trainerName,
    course_date_start: courseStartDate,
    course_date_end: courseEndDate,
    issue_date: issueDate,
    expiry_date: expiryDate,
    certificate_pdf_url: '',
    status: 'issued',
    course_specific_data: courseSpecificData,
    certificate_template_id: templateId
  });

  if (!certificate) {
    throw new Error('Failed to create certificate');
  }

  try {
    await generateCertificatePDF(
      certificate.id,
      {
        certificate_number: certificateNumber,
        candidate_name: candidateName,
        trainer_name: trainerName,
        course_name: courseType.name,
        course_date_start: courseStartDate,
        course_date_end: courseEndDate,
        issue_date: issueDate,
        expiry_date: expiryDate,
        course_specific_data: courseSpecificData,
      },
      templateId
    );
  } catch (error) {
    console.error('Error generating certificate PDF:', error);
  }

  return certificate;
}

export async function regenerateCertificatePDF(certificateId: string) {
  const certificate = await getCertificate(certificateId);

  if (!certificate) {
    throw new Error('Certificate not found');
  }

  const templateId = (certificate as any).certificate_template_id;

  if (!templateId) {
    throw new Error('Certificate template not found');
  }

  const courseName = (certificate as any).course_types?.name || '';

  const pdfUrl = await generateCertificatePDF(
    certificate.id,
    {
      certificate_number: certificate.certificate_number,
      candidate_name: certificate.candidate_name,
      trainer_name: certificate.trainer_name,
      course_name: courseName,
      course_date_start: certificate.course_date_start,
      course_date_end: certificate.course_date_end,
      issue_date: certificate.issue_date,
      expiry_date: certificate.expiry_date,
      course_specific_data: certificate.course_specific_data,
    },
    templateId
  );

  return pdfUrl;
}

export async function revokeCertificate(id: string, reason: string) {
  // First get the certificate to find out if it's for an open course delegate
  const { data: certificate, error: fetchError } = await supabase
    .from('certificates')
    .select('open_course_delegate_id, candidate_id')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Error fetching certificate:', fetchError);
    throw fetchError;
  }

  // Update the certificate status to revoked
  const { error } = await supabase
    .from('certificates')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_reason: reason
    })
    .eq('id', id);

  if (error) {
    console.error('Error revoking certificate:', error);
    throw error;
  }

  // If this was an open course delegate certificate, reset their certificate_issued flag
  if (certificate?.open_course_delegate_id) {
    const { error: delegateError } = await supabase
      .from('open_course_delegates')
      .update({
        certificate_issued: false,
        certificate_number: null
      })
      .eq('id', certificate.open_course_delegate_id);

    if (delegateError) {
      console.error('Error resetting delegate certificate status:', delegateError);
      // Don't throw - the certificate is already revoked, this is a secondary update
    }
  }
}

export async function logCertificateVerification(
  certificateNumber: string,
  certificateId: string | null,
  result: 'valid' | 'invalid' | 'revoked' | 'expired',
  ipAddress: string = ''
) {
  const { error } = await supabase
    .from('certificate_verification_log')
    .insert([{
      certificate_number: certificateNumber,
      certificate_id: certificateId,
      ip_address: ipAddress,
      result
    }]);

  if (error) {
    console.error('Error logging verification:', error);
  }
}

export async function getBookingsWithCourseTypes(filters?: {
  courseTypeId?: string;
  trainerId?: string;
  startDate?: string;
  endDate?: string;
}) {
  let query = supabase
    .from('bookings')
    .select(`
      id,
      title,
      booking_date,
      num_days,
      course_type_id,
      trainer_id,
      client_name,
      course_level_data,
      certificate_template_id,
      duration_value,
      duration_unit,
      course_types(id, name, code, required_fields, certificate_validity_months, duration_days, duration_unit, default_course_data),
      trainers(name),
      candidates:booking_candidates(
        id,
        candidate_name,
        email,
        passed,
        candidate_course_data
      )
    `)
    .not('course_type_id', 'is', null)
    .order('booking_date', { ascending: true });

  if (filters?.courseTypeId) {
    query = query.eq('course_type_id', filters.courseTypeId);
  }

  if (filters?.trainerId) {
    query = query.eq('trainer_id', filters.trainerId);
  }

  if (filters?.startDate) {
    query = query.gte('booking_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('booking_date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading bookings:', error);
    return [];
  }

  const bookingsWithEndDate = (data || []).map(booking => {
    const startDate = new Date(booking.booking_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (booking.num_days - 1));

    return {
      ...booking,
      course_date_end: endDate.toISOString().split('T')[0],
      trainer_name: (booking as any).trainers?.name || 'Unknown',
      candidates: (booking as any).candidates || []
    };
  });

  const { data: certificates } = await supabase
    .from('certificates')
    .select('id, candidate_id, certificate_number, certificate_pdf_url, status, created_at')
    .in('booking_id', bookingsWithEndDate.map(b => b.id))
    .order('created_at', { ascending: true });

  // Build certificate map - prefer 'issued' certificates, otherwise use the most recent one
  const certificateMap = new Map<string, any>();
  (certificates || []).forEach(c => {
    const existing = certificateMap.get(c.candidate_id);
    // Always prefer 'issued' status, or take newer certificate if neither is issued
    if (!existing || c.status === 'issued' || (existing.status !== 'issued' && c.created_at > existing.created_at)) {
      certificateMap.set(c.candidate_id, c);
    }
  });

  return bookingsWithEndDate.map(booking => ({
    ...booking,
    candidates: booking.candidates.map((c: any) => ({
      ...c,
      certificate: certificateMap.get(c.id) || null
    }))
  })) as BookingWithCandidates[];
}

export async function getBookingsWithPendingCertificates(filters?: {
  courseTypeId?: string;
  trainerId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const allBookings = await getBookingsWithCourseTypes(filters);
  return allBookings.filter(booking =>
    booking.candidates.some((c: any) => c.passed && (!c.certificate || c.certificate?.status === 'revoked'))
  );
}

export async function updateCandidatePassStatus(candidateId: string, passed: boolean) {
  const { error } = await supabase
    .from('booking_candidates')
    .update({ passed })
    .eq('id', candidateId);

  if (error) {
    console.error('Error updating candidate pass status:', error);
    throw error;
  }
}

export async function getCertificateByCandidate(candidateId: string) {
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('candidate_id', candidateId)
    .maybeSingle();

  if (error) {
    console.error('Error loading certificate:', error);
    return null;
  }

  return data as Certificate | null;
}

export async function updateBookingCourseLevelData(bookingId: string, courseLevelData: Record<string, any>) {
  const { error } = await supabase
    .from('bookings')
    .update({ course_level_data: courseLevelData })
    .eq('id', bookingId);

  if (error) {
    console.error('Error updating booking course-level data:', error);
    throw error;
  }
}

export async function getBookingCourseLevelData(bookingId: string): Promise<Record<string, any>> {
  const { data, error } = await supabase
    .from('bookings')
    .select('course_level_data')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) {
    console.error('Error loading booking course-level data:', error);
    return {};
  }

  return (data?.course_level_data || {}) as Record<string, any>;
}

export async function updateOpenCourseSessionData(sessionId: string, courseLevelData: Record<string, any>) {
  const { error } = await supabase
    .from('open_course_sessions')
    .update({ course_level_data: courseLevelData })
    .eq('id', sessionId);

  if (error) {
    console.error('Error updating open course session data:', error);
    throw error;
  }
}

export function calculateExpiryDate(issueDate: string, validityMonths: number | null): string | null {
  if (!validityMonths) return null;

  const issue = new Date(issueDate);
  issue.setMonth(issue.getMonth() + validityMonths);
  return issue.toISOString().split('T')[0];
}

export function getExpiryStatus(expiryDate: string | null): 'valid' | 'expiring_soon' | 'expired' {
  if (!expiryDate) return 'valid';

  const today = new Date();
  const expiry = new Date(expiryDate);
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(today.getMonth() + 3);

  if (expiry < today) return 'expired';
  if (expiry <= threeMonthsFromNow) return 'expiring_soon';
  return 'valid';
}

export function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;

  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

// ============================================================================
// Open Course Certificate Functions
// ============================================================================

export async function getOpenCourseSessionsWithDelegates(filters?: {
  courseTypeId?: string;
  trainerId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<OpenCourseSessionWithDelegates[]> {
  let query = supabase
    .from('open_course_sessions')
    .select(`
      id,
      event_title,
      session_date,
      end_date,
      course_type_id,
      trainer_id,
      status,
      course_level_data,
      course_types(id, name, code, required_fields, certificate_validity_months, duration_days, duration_unit, default_course_data),
      trainers(name),
      venue:venues(name)
    `)
    .order('session_date', { ascending: true });

  if (filters?.courseTypeId) {
    query = query.eq('course_type_id', filters.courseTypeId);
  }

  if (filters?.trainerId) {
    query = query.eq('trainer_id', filters.trainerId);
  }

  if (filters?.startDate) {
    query = query.gte('session_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('session_date', filters.endDate);
  }

  const { data: sessions, error: sessionsError } = await query;

  if (sessionsError) {
    console.error('Error loading open course sessions:', sessionsError);
    return [];
  }

  if (!sessions || sessions.length === 0) {
    return [];
  }

  // Get all delegates for these sessions in batches to avoid URL length limits
  const sessionIds = sessions.map(s => s.id);
  const BATCH_SIZE = 30;
  let allDelegates: any[] = [];

  for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
    const batchIds = sessionIds.slice(i, i + BATCH_SIZE);
    const { data: batchDelegates, error: delegatesError } = await supabase
      .from('open_course_delegates')
      .select('*')
      .in('session_id', batchIds);

    if (delegatesError) {
      console.error('Error loading delegates batch:', delegatesError);
      continue;
    }

    if (batchDelegates) {
      allDelegates = allDelegates.concat(batchDelegates);
    }
  }

  // Filter to only show delegates marked as attended (awaiting certification)
  // Attendance can be in either attendance_status or attendance_detail field
  const filteredDelegates = allDelegates.filter(d =>
    d.attendance_status === 'attended' || d.attendance_detail === 'attended'
  );

  // Get certificates for these delegates - order by created_at so newest is last
  const delegateIds = filteredDelegates.map(d => d.id);
  const { data: certificates } = await supabase
    .from('certificates')
    .select('id, open_course_delegate_id, certificate_number, certificate_pdf_url, status, created_at')
    .in('open_course_delegate_id', delegateIds.length > 0 ? delegateIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: true });

  // Build certificate map - prefer 'issued' certificates, otherwise use the most recent one
  const certificateMap = new Map<string, any>();
  (certificates || []).forEach(c => {
    const existing = certificateMap.get(c.open_course_delegate_id);
    // Always prefer 'issued' status, or take newer certificate if neither is issued
    if (!existing || c.status === 'issued' || (existing.status !== 'issued' && c.created_at > existing.created_at)) {
      certificateMap.set(c.open_course_delegate_id, c);
    }
  });

  // Map delegates to their sessions
  const delegatesBySession = new Map<string, any[]>();
  filteredDelegates.forEach(delegate => {
    if (!delegatesBySession.has(delegate.session_id)) {
      delegatesBySession.set(delegate.session_id, []);
    }
    const cert = certificateMap.get(delegate.id);
    delegatesBySession.get(delegate.session_id)!.push({
      id: delegate.id,
      delegate_name: delegate.delegate_name,
      delegate_email: delegate.delegate_email,
      attendance_status: delegate.attendance_status,
      attendance_detail: delegate.attendance_detail,
      certificate_issued: delegate.certificate_issued || !!cert,
      certificate: cert || null
    });
  });

  // Build the final result - only include sessions with attended delegates
  return sessions
    .map(session => {
      const startDate = new Date(session.session_date);
      const endDate = session.end_date ? new Date(session.end_date) : startDate;

      return {
        id: session.id,
        event_title: session.event_title,
        session_date: session.session_date,
        end_date: session.end_date,
        course_type_id: session.course_type_id,
        trainer_id: session.trainer_id,
        trainer_name: (session as any).trainers?.name || 'Unknown',
        venue_name: (session as any).venue?.name || null,
        status: session.status,
        session_end_date: endDate.toISOString().split('T')[0],
        course_level_data: (session as any).course_level_data || {},
        delegates: delegatesBySession.get(session.id) || [],
        course_types: (session as any).course_types,
        trainers: (session as any).trainers,
        venue: (session as any).venue
      };
    })
    .filter(session => session.delegates.length > 0);
}

export async function issueOpenCourseCertificate({
  sessionId,
  delegateId,
  delegateName,
  delegateEmail,
  courseTypeId,
  trainerId,
  trainerName,
  courseStartDate,
  courseEndDate,
  courseSpecificData,
  templateId,
}: {
  sessionId: string;
  delegateId: string;
  delegateName: string;
  delegateEmail: string;
  courseTypeId: string;
  trainerId: string | null;
  trainerName: string;
  courseStartDate: string;
  courseEndDate: string;
  courseSpecificData: Record<string, any>;
  templateId: string;
}) {
  const courseType = await getCourseType(courseTypeId);
  if (!courseType) {
    throw new Error('Course type not found');
  }

  const certificateNumber = await generateCertificateNumber(courseType.code);
  const issueDate = new Date().toISOString().split('T')[0];
  const expiryDate = calculateExpiryDate(issueDate, courseType.certificate_validity_months);

  const { data: certificate, error } = await supabase
    .from('certificates')
    .insert([{
      certificate_number: certificateNumber,
      course_type_id: courseTypeId,
      open_course_session_id: sessionId,
      open_course_delegate_id: delegateId,
      booking_id: null,
      candidate_id: null,
      candidate_name: delegateName,
      candidate_email: delegateEmail,
      trainer_id: trainerId,
      trainer_name: trainerName,
      course_date_start: courseStartDate,
      course_date_end: courseEndDate,
      issue_date: issueDate,
      expiry_date: expiryDate,
      certificate_pdf_url: '',
      status: 'issued',
      course_specific_data: courseSpecificData,
      certificate_template_id: templateId
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating certificate:', error);
    throw error;
  }

  // Update delegate to mark certificate as issued
  await supabase
    .from('open_course_delegates')
    .update({
      certificate_issued: true,
      certificate_number: certificateNumber
    })
    .eq('id', delegateId);

  // Generate PDF
  try {
    await generateCertificatePDF(
      certificate.id,
      {
        certificate_number: certificateNumber,
        candidate_name: delegateName,
        trainer_name: trainerName,
        course_name: courseType.name,
        course_date_start: courseStartDate,
        course_date_end: courseEndDate,
        issue_date: issueDate,
        expiry_date: expiryDate,
        course_specific_data: courseSpecificData,
      },
      templateId
    );
  } catch (error) {
    console.error('Error generating certificate PDF:', error);
  }

  return certificate as Certificate;
}

export async function updateOpenCourseDelegateAttendance(delegateId: string, attended: boolean) {
  const { error } = await supabase
    .from('open_course_delegates')
    .update({
      attendance_detail: attended ? 'attended' : 'absent',
      attendance_status: attended ? 'attended' : 'no_show'
    })
    .eq('id', delegateId);

  if (error) {
    console.error('Error updating delegate attendance:', error);
    throw error;
  }
}

export async function updateOpenCourseDelegateData(delegateId: string, data: Record<string, any>) {
  const { error } = await supabase
    .from('open_course_delegates')
    .update({
      additional_comments: JSON.stringify(data)
    })
    .eq('id', delegateId);

  if (error) {
    console.error('Error updating delegate data:', error);
    throw error;
  }
}
