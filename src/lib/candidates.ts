import { supabase } from './supabase';

export type CandidateWithDetails = {
  id: string;
  candidate_name: string;
  email: string;
  telephone: string;
  client_id: string | null;
  client_name: string | null;
  booking_id: string;
  booking_title: string;
  booking_date: string;
  course_date_end: string;
  course_type_id: string | null;
  course_type_name: string | null;
  course_type_code: string | null;
  trainer_name: string;
  passed: boolean;
  certificate_id: string | null;
  certificate_number: string | null;
  certificate_status: string | null;
  certificate_issue_date: string | null;
  certificate_expiry_date: string | null;
  created_at: string;
};

export type BookingInfo = {
  id: string;
  title: string;
  booking_date: string;
  course_date_end: string;
  course_type_name: string;
  trainer_name: string;
  passed: boolean;
  certificate?: {
    id: string;
    certificate_number: string;
    status: string;
    issue_date: string;
    expiry_date: string | null;
    certificate_pdf_url: string;
  };
};

export type CandidateHistory = {
  candidate_id: string;
  candidate_name: string;
  email: string;
  telephone: string;
  client_id: string | null;
  client_name: string | null;
  completedBookings: BookingInfo[];
  upcomingBookings: BookingInfo[];
};

export type ExpiryStatus = 'valid' | 'expiring_soon' | 'urgent' | 'expired' | 'no_certificate';

export type CompletionStatus = 'fresh' | 'recent' | 'aging' | 'old';

export async function getAllCandidates(filters?: {
  searchTerm?: string;
  clientId?: string;
  courseTypeId?: string;
  expiryStatus?: ExpiryStatus;
  completionStatus?: CompletionStatus;
}): Promise<CandidateWithDetails[]> {
  let query = supabase
    .from('booking_candidates')
    .select(`
      id,
      candidate_name,
      email,
      telephone,
      client_id,
      booking_id,
      passed,
      created_at,
      bookings!inner (
        id,
        title,
        booking_date,
        num_days,
        course_type_id,
        client_id,
        client_name,
        trainers!inner (
          name
        ),
        course_types (
          name,
          code
        )
      )
    `)
    .order('candidate_name');

  if (filters?.searchTerm) {
    query = query.or(`candidate_name.ilike.%${filters.searchTerm}%,email.ilike.%${filters.searchTerm}%`);
  }

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId);
  }

  if (filters?.courseTypeId) {
    query = query.eq('bookings.course_type_id', filters.courseTypeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading candidates:', error);
    return [];
  }

  const candidateIds = data.map((c: any) => c.id);

  const { data: certificates } = await supabase
    .from('certificates')
    .select('id, candidate_id, certificate_number, status, issue_date, expiry_date')
    .in('candidate_id', candidateIds)
    .order('issue_date', { ascending: false });

  const certificateMap = new Map();
  certificates?.forEach((cert: any) => {
    if (!certificateMap.has(cert.candidate_id)) {
      certificateMap.set(cert.candidate_id, cert);
    }
  });

  const candidates: CandidateWithDetails[] = data.map((c: any) => {
    const booking = c.bookings;
    const courseEndDate = calculateCourseEndDate(booking.booking_date, booking.num_days);
    const certificate = certificateMap.get(c.id) || null;

    return {
      id: c.id,
      candidate_name: c.candidate_name,
      email: c.email,
      telephone: c.telephone,
      client_id: c.client_id || booking?.client_id || null,
      client_name: booking?.client_name || null,
      booking_id: c.booking_id,
      booking_title: booking?.title || '',
      booking_date: booking?.booking_date || '',
      course_date_end: courseEndDate,
      course_type_id: booking?.course_type_id || null,
      course_type_name: booking?.course_types?.name || null,
      course_type_code: booking?.course_types?.code || null,
      trainer_name: booking?.trainers?.name || '',
      passed: c.passed,
      certificate_id: certificate?.id || null,
      certificate_number: certificate?.certificate_number || null,
      certificate_status: certificate?.status || null,
      certificate_issue_date: certificate?.issue_date || null,
      certificate_expiry_date: certificate?.expiry_date || null,
      created_at: c.created_at,
    };
  });

  let filteredCandidates = candidates;

  if (filters?.expiryStatus) {
    filteredCandidates = filteredCandidates.filter(c =>
      getExpiryStatus(c.certificate_expiry_date) === filters.expiryStatus
    );
  }

  if (filters?.completionStatus) {
    filteredCandidates = filteredCandidates.filter(c =>
      getCompletionStatus(c.course_date_end) === filters.completionStatus
    );
  }

  return filteredCandidates;
}

export async function getCandidateHistory(candidateEmail: string, candidateName: string): Promise<CandidateHistory | null> {
  const { data, error } = await supabase
    .from('booking_candidates')
    .select(`
      id,
      candidate_name,
      email,
      telephone,
      client_id,
      booking_id,
      passed,
      bookings!inner (
        id,
        title,
        booking_date,
        num_days,
        client_name,
        trainers!inner (
          name
        ),
        course_types (
          name,
          code
        )
      ),
      clients (
        name
      )
    `)
    .eq('email', candidateEmail)
    .eq('candidate_name', candidateName)
    .order('bookings(booking_date)', { ascending: false });

  if (error) {
    console.error('Error loading candidate history:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const candidateIds = data.map((c: any) => c.id);

  const { data: certificates } = await supabase
    .from('certificates')
    .select('id, candidate_id, certificate_number, status, issue_date, expiry_date, certificate_pdf_url')
    .in('candidate_id', candidateIds);

  const certificateMap = new Map();
  certificates?.forEach((cert: any) => {
    certificateMap.set(cert.candidate_id, cert);
  });

  const firstRecord = data[0] as any;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allBookings = data.map((c: any) => {
    const booking = c.bookings;
    const courseEndDate = calculateCourseEndDate(booking.booking_date, booking.num_days);
    const certificate = certificateMap.get(c.id);

    return {
      id: booking.id,
      title: booking.title,
      booking_date: booking.booking_date,
      course_date_end: courseEndDate,
      course_type_name: booking.course_types?.name || 'Unknown',
      trainer_name: booking.trainers?.name || '',
      passed: c.passed,
      certificate: certificate ? {
        id: certificate.id,
        certificate_number: certificate.certificate_number,
        status: certificate.status,
        issue_date: certificate.issue_date,
        expiry_date: certificate.expiry_date,
        certificate_pdf_url: certificate.certificate_pdf_url,
      } : undefined,
    };
  });

  const completedBookings = allBookings.filter(b => new Date(b.course_date_end) < today);
  const upcomingBookings = allBookings.filter(b => new Date(b.course_date_end) >= today);

  return {
    candidate_id: firstRecord.id,
    candidate_name: firstRecord.candidate_name,
    email: firstRecord.email,
    telephone: firstRecord.telephone,
    client_id: firstRecord.client_id,
    client_name: firstRecord.clients?.name || null,
    completedBookings,
    upcomingBookings,
  };
}

export async function updateCandidateDetails(candidateId: string, updates: {
  candidate_name?: string;
  email?: string;
  telephone?: string;
  client_id?: string | null;
}) {
  const { error } = await supabase
    .from('booking_candidates')
    .update(updates)
    .eq('id', candidateId);

  if (error) {
    console.error('Error updating candidate:', error);
    throw error;
  }
}

export async function linkCandidateToClient(candidateId: string, clientId: string | null) {
  const { error } = await supabase
    .from('booking_candidates')
    .update({ client_id: clientId })
    .eq('id', candidateId);

  if (error) {
    console.error('Error linking candidate to client:', error);
    throw error;
  }
}

export async function updateCandidateCourseData(candidateId: string, courseData: Record<string, any>) {
  const { error } = await supabase
    .from('booking_candidates')
    .update({ candidate_course_data: courseData })
    .eq('id', candidateId);

  if (error) {
    console.error('Error updating candidate course data:', error);
    throw error;
  }
}

export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, contact_name, email, telephone')
    .order('name');

  if (error) {
    console.error('Error loading clients:', error);
    return [];
  }

  return data;
}

function calculateCourseEndDate(startDate: string, numDays: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + (numDays - 1));
  return date.toISOString().split('T')[0];
}

export function getDaysSinceCompletion(courseEndDate: string): number {
  const today = new Date();
  const endDate = new Date(courseEndDate);
  const diffTime = today.getTime() - endDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;

  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function getExpiryStatus(expiryDate: string | null): ExpiryStatus {
  if (!expiryDate) return 'no_certificate';

  const daysUntilExpiry = getDaysUntilExpiry(expiryDate);

  if (daysUntilExpiry === null) return 'no_certificate';
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'urgent';
  if (daysUntilExpiry <= 90) return 'expiring_soon';
  return 'valid';
}

export function getCompletionStatus(courseEndDate: string): CompletionStatus {
  const daysSince = getDaysSinceCompletion(courseEndDate);

  if (daysSince <= 30) return 'fresh';
  if (daysSince <= 90) return 'recent';
  if (daysSince <= 365) return 'aging';
  return 'old';
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
