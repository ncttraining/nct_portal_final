/**
 * Open Courses Library
 *
 * Functions for managing open courses, sessions, delegates, and bookings.
 * Integrates with WordPress EventON plugin data synced to Supabase.
 */

import { supabase } from './supabase';

// ============================================================================
// Type Definitions
// ============================================================================

export interface Venue {
  id: string;
  name: string;
  code?: string;
  address1?: string;
  address2?: string;
  town?: string;
  postcode?: string;
  default_capacity?: number;
  active: boolean;
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

export interface OpenCourseSession {
  id: string;
  wp_event_id: number | null;
  wp_repeat_interval: number | null;
  course_type_id: string | null;
  venue_id: string | null;
  trainer_id: string | null;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  capacity_limit: number;
  price: number | null;
  early_bird_price: number | null;
  early_bird_cutoff_date: string | null;
  allow_overbooking: boolean;
  overbooking_limit: number | null;
  capacity_threshold_warning: number | null;
  is_online: boolean;
  meeting_url: string | null;
  meeting_id: string | null;
  meeting_password: string | null;
  virtual_type: string | null;
  show_meeting_link_when: string | null;
  event_title: string;
  event_subtitle: string | null;
  event_description: string | null;
  event_image_url: string | null;
  event_color: string | null;
  status: string;
  timezone: string | null;
  website_visible: boolean;
  woocommerce_product_id: string | null;
  eventon_event_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Stage 3: Trainer declaration fields
  trainer_declaration_signed: boolean;
  trainer_declaration_at?: string;
  trainer_declaration_by?: string;
  break_time?: string;
}

export interface CourseType {
  id: string;
  name: string;
  code: string;
  jaupt_code?: string;
  duration_days?: number;
  duration_unit?: string;
}

export interface OpenCourseSessionWithDetails extends OpenCourseSession {
  venue?: Venue;
  trainer?: {
    id: string;
    name: string;
    email: string | null;
  };
  course_type?: CourseType;
  delegate_count?: number;
  order_count?: number;
}

export interface OpenCourseOrder {
  id: string;
  wp_order_id: number | null;
  session_id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  company_name: string | null;
  order_date: string;
  total_amount: number;
  currency: string;
  payment_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  payment_method: string | null;
  number_of_delegates: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

// Attendance detail type for session attendance tracking
export type AttendanceDetail = 'attended' | 'absent' | 'late' | 'left_early';

// ID verification type options
export type IdType = 'NONE' | 'DL' | 'DQC' | 'Digitaco' | 'Passport' | 'Other';

// Licence category options for CPC courses
export type LicenceCategory = 'C' | 'CE' | 'C1' | 'C1E' | 'D' | 'DE' | 'D1' | 'D1E' | 'C+E' | 'D+E';

export interface OpenCourseDelegate {
  id: string;
  order_id: string;
  session_id: string;
  wp_booking_id: number | null;
  // Database uses delegate_name, delegate_email, etc.
  delegate_name: string;
  delegate_email: string;
  delegate_phone: string | null;
  delegate_company: string | null;
  dietary_requirements: string | null;
  special_needs: string | null;
  attendance_status: 'registered' | 'confirmed' | 'attended' | 'no_show' | 'cancelled' | null;
  certificate_issued: boolean;
  certificate_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  // Stage 3: DVSA compliance tracking fields
  driver_number?: string;
  licence_category?: LicenceCategory;
  id_type?: IdType;
  id_checked?: boolean;
  attendance_detail?: AttendanceDetail;
  additional_comments?: string;
  dvsa_uploaded?: boolean;
  dvsa_uploaded_at?: string;
  dvsa_uploaded_by?: string;
  attendance_marked_by?: string;
}

export interface OpenCourseDelegateWithDetails extends OpenCourseDelegate {
  order?: OpenCourseOrder;
  session?: OpenCourseSession;
}

export interface OpenCourseCapacityAlert {
  id: string;
  session_id: string;
  alert_type: string;
  current_count: number;
  capacity_limit: number;
  triggered_at: string;
  actioned_by: string | null;
  actioned_at: string | null;
  action_taken: string | null;
  action_notes: string | null;
  new_session_id: string | null;
}

export interface OpenCourseSyncLog {
  id: string;
  sync_type: 'session' | 'order' | 'delegate';
  wp_entity_id: number;
  wp_entity_type: string;
  action: 'create' | 'update' | 'delete';
  status: 'success' | 'error';
  error_message: string | null;
  data: any;
  created_at: string;
}

export interface OpenCourseSessionSummary {
  session_id: string;
  title: string;
  start_date: string;
  end_date: string;
  venue_name: string | null;
  trainer_name: string | null;
  capacity: number;
  total_delegates: number;
  available_spaces: number;
  total_orders: number;
  total_revenue: number;
  attendance_confirmed: number;
  attendance_attended: number;
  certificates_issued: number;
}

// ============================================================================
// Venue Functions
// ============================================================================

export async function getVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getActiveVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getVenueById(id: string): Promise<Venue | null> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createVenue(venue: Omit<Venue, 'id' | 'created_at' | 'updated_at'>): Promise<Venue> {
  const { data, error } = await supabase
    .from('venues')
    .insert([venue])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateVenue(id: string, updates: Partial<Venue>): Promise<Venue> {
  const { data, error } = await supabase
    .from('venues')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVenue(id: string): Promise<void> {
  const { error } = await supabase
    .from('venues')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// Session Functions
// ============================================================================

export async function getSessions(filters?: {
  startDate?: string;
  endDate?: string;
  status?: OpenCourseSession['status'];
  venueId?: string;
  trainerId?: string;
}): Promise<OpenCourseSessionWithDetails[]> {
  let query = supabase
    .from('open_course_sessions')
    .select(`
      *,
      venue:venues(id, name, code, town, postcode),
      trainer:trainers(id, name, email),
      course_type:course_types(id, name, code)
    `)
    .order('session_date', { ascending: true });

  if (filters?.startDate) {
    console.log('Filtering sessions >= ', filters.startDate);
    query = query.gte('session_date', filters.startDate);
  }
  if (filters?.endDate) {
    console.log('Filtering sessions <= ', filters.endDate);
    query = query.lte('session_date', filters.endDate);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.venueId) {
    query = query.eq('venue_id', filters.venueId);
  }
  if (filters?.trainerId) {
    query = query.eq('trainer_id', filters.trainerId);
  }

  const { data, error } = await query;

  console.log('Supabase query result:', { data, error, filters });

  if (error) throw error;
  return data || [];
}

export async function getSessionById(id: string): Promise<OpenCourseSessionWithDetails | null> {
  const { data, error } = await supabase
    .from('open_course_sessions')
    .select(`
      *,
      venue:venues(id, name, code, town, postcode),
      trainer:trainers(id, name, email),
      course_type:course_types(id, name, code)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getSessionsForWeek(weekStartDate: string): Promise<OpenCourseSessionWithDetails[]> {
  // Calculate end date (7 days later)
  const startParts = weekStartDate.split('-');
  const startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6); // Include the 7th day

  const endDateString = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  console.log('Week range:', weekStartDate, 'to', endDateString);

  return getSessions({
    startDate: weekStartDate,
    endDate: endDateString,
  });
}

export async function createSession(session: Partial<OpenCourseSession>): Promise<OpenCourseSession> {
  const { data, error } = await supabase
    .from('open_course_sessions')
    .insert([session])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSession(id: string, updates: Partial<OpenCourseSession>): Promise<OpenCourseSession> {
  const { data, error } = await supabase
    .from('open_course_sessions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function duplicateSession(id: string, newSessionDate: string): Promise<OpenCourseSession> {
  const original = await getSessionById(id);
  if (!original) throw new Error('Session not found');

  const { id: _, created_at, updated_at, created_by, wp_event_id, wp_repeat_interval, woocommerce_product_id, eventon_event_id, venue, trainer, course_type, ...sessionData } = original as any;

  const newSession = {
    ...sessionData,
    session_date: newSessionDate,
    wp_event_id: null,
    wp_repeat_interval: null,
    status: 'draft',
  };

  return createSession(newSession);
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('open_course_sessions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateSessionCapacity(sessionId: string): Promise<void> {
  // Get current delegate count
  const { count, error: countError } = await supabase
    .from('open_course_delegates')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .in('attendance_status', ['registered', 'confirmed', 'attended']);

  if (countError) throw countError;

  // Get session capacity
  const session = await getSessionById(sessionId);
  if (!session) throw new Error('Session not found');

  const delegateCount = count || 0;
  const capacityPercentage = (delegateCount / session.capacity_limit) * 100;

  // Check for capacity alerts
  if (delegateCount > session.capacity_limit) {
    await createCapacityAlert(sessionId, 'overbooked', delegateCount, session.capacity_limit);
  } else if (capacityPercentage >= 100) {
    await createCapacityAlert(sessionId, 'at_capacity', delegateCount, session.capacity_limit);
  } else if (session.capacity_threshold_warning && capacityPercentage >= session.capacity_threshold_warning) {
    await createCapacityAlert(sessionId, 'approaching_capacity', delegateCount, session.capacity_limit);
  }
}

// ============================================================================
// Order Functions
// ============================================================================

export async function getOrders(filters?: {
  sessionId?: string;
  paymentStatus?: OpenCourseOrder['payment_status'];
}): Promise<OpenCourseOrder[]> {
  let query = supabase
    .from('open_course_orders')
    .select('*')
    .order('order_date', { ascending: false });

  if (filters?.sessionId) {
    query = query.eq('session_id', filters.sessionId);
  }
  if (filters?.paymentStatus) {
    query = query.eq('payment_status', filters.paymentStatus);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getOrderById(id: string): Promise<OpenCourseOrder | null> {
  const { data, error } = await supabase
    .from('open_course_orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createOrder(order: Omit<OpenCourseOrder, 'id' | 'created_at' | 'updated_at' | 'synced_at'>): Promise<OpenCourseOrder> {
  const { data, error } = await supabase
    .from('open_course_orders')
    .insert([order])
    .select()
    .single();

  if (error) throw error;

  // Update session capacity
  await updateSessionCapacity(order.session_id);

  return data;
}

export async function updateOrder(id: string, updates: Partial<OpenCourseOrder>): Promise<OpenCourseOrder> {
  const { data, error } = await supabase
    .from('open_course_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOrder(id: string): Promise<void> {
  const order = await getOrderById(id);
  if (!order) throw new Error('Order not found');

  const { error } = await supabase
    .from('open_course_orders')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Update session capacity
  await updateSessionCapacity(order.session_id);
}

// ============================================================================
// Delegate Functions
// ============================================================================

export async function getDelegates(filters?: {
  sessionId?: string;
  orderId?: string;
  attendanceStatus?: OpenCourseDelegate['attendance_status'];
}): Promise<OpenCourseDelegateWithDetails[]> {
  let query = supabase
    .from('open_course_delegates')
    .select(`
      *,
      order:open_course_orders(*),
      session:open_course_sessions!session_id(*)
    `)
    .order('created_at', { ascending: false });

  if (filters?.sessionId) {
    query = query.eq('session_id', filters.sessionId);
  }
  if (filters?.orderId) {
    query = query.eq('order_id', filters.orderId);
  }
  if (filters?.attendanceStatus) {
    query = query.eq('attendance_status', filters.attendanceStatus);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getDelegateById(id: string): Promise<OpenCourseDelegateWithDetails | null> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .select(`
      *,
      order:open_course_orders(*),
      session:open_course_sessions!session_id(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createDelegate(delegate: Omit<OpenCourseDelegate, 'id' | 'created_at' | 'updated_at' | 'synced_at'>): Promise<OpenCourseDelegate> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .insert([delegate])
    .select()
    .single();

  if (error) throw error;

  // Update session capacity
  await updateSessionCapacity(delegate.session_id);

  return data;
}

export async function updateDelegate(id: string, updates: Partial<OpenCourseDelegate>): Promise<OpenCourseDelegate> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function transferDelegate(delegateId: string, newSessionId: string): Promise<OpenCourseDelegate> {
  const delegate = await getDelegateById(delegateId);
  if (!delegate) throw new Error('Delegate not found');

  const oldSessionId = delegate.session_id;

  // Update delegate's session
  const updated = await updateDelegate(delegateId, { session_id: newSessionId });

  // Update both session capacities
  await updateSessionCapacity(oldSessionId);
  await updateSessionCapacity(newSessionId);

  return updated;
}

export async function deleteDelegate(id: string): Promise<void> {
  const delegate = await getDelegateById(id);
  if (!delegate) throw new Error('Delegate not found');

  const { error } = await supabase
    .from('open_course_delegates')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Update session capacity
  await updateSessionCapacity(delegate.session_id);
}

// ============================================================================
// Capacity Alert Functions
// ============================================================================

export async function getCapacityAlerts(sessionId?: string): Promise<OpenCourseCapacityAlert[]> {
  let query = supabase
    .from('open_course_capacity_alerts')
    .select('*')
    .order('triggered_at', { ascending: false });

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function createCapacityAlert(
  sessionId: string,
  alertType: string,
  currentCount: number,
  capacityLimit: number
): Promise<OpenCourseCapacityAlert> {
  // Check if similar alert already exists for this session
  const { data: existing } = await supabase
    .from('open_course_capacity_alerts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('alert_type', alertType)
    .is('actioned_at', null)
    .single();

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from('open_course_capacity_alerts')
    .insert([{
      session_id: sessionId,
      alert_type: alertType,
      current_count: currentCount,
      capacity_limit: capacityLimit,
      triggered_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// Session Summary Functions
// ============================================================================

export async function getSessionSummaries(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<OpenCourseSessionSummary[]> {
  let query = supabase
    .from('open_course_session_summary')
    .select('*')
    .order('start_date', { ascending: true });

  if (filters?.startDate) {
    query = query.gte('start_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('start_date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getSessionSummary(sessionId: string): Promise<OpenCourseSessionSummary | null> {
  const { data, error } = await supabase
    .from('open_course_session_summary')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getWeekDates(startDate: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(time: string | null): string {
  if (!time) return '';
  return time.substring(0, 5); // Returns HH:MM from HH:MM:SS
}

export function getCapacityColor(registeredCount: number, capacityLimit: number): string {
  const percentage = (registeredCount / capacityLimit) * 100;
  if (percentage >= 100) return 'text-red-400';
  if (percentage >= 90) return 'text-orange-400';
  if (percentage >= 75) return 'text-yellow-400';
  return 'text-green-400';
}

export function getCapacityBgColor(registeredCount: number, capacityLimit: number): string {
  const percentage = (registeredCount / capacityLimit) * 100;
  if (percentage >= 100) return 'bg-red-500/10 border-red-500/20';
  if (percentage >= 90) return 'bg-orange-500/10 border-orange-500/20';
  if (percentage >= 75) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-green-500/10 border-green-500/20';
}

// ============================================================================
// Stage 3: Register Management Functions
// ============================================================================

/**
 * Get user initials from user ID
 */
export async function getUserInitials(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  if (error || !data) return '?';

  if (data.full_name) {
    const parts = data.full_name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return data.full_name.substring(0, 2).toUpperCase();
  }

  // Fallback to email initials
  if (data.email) {
    const localPart = data.email.split('@')[0];
    const parts = localPart.split('.');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return localPart.substring(0, 2).toUpperCase();
  }

  return '?';
}

/**
 * Get multiple user initials in a batch
 */
export async function getUserInitialsBatch(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};

  const uniqueIds = [...new Set(userIds.filter(id => id))];
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email')
    .in('id', uniqueIds);

  if (error || !data) return {};

  const initials: Record<string, string> = {};
  for (const user of data) {
    if (user.full_name) {
      const parts = user.full_name.trim().split(' ');
      if (parts.length >= 2) {
        initials[user.id] = `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      } else {
        initials[user.id] = user.full_name.substring(0, 2).toUpperCase();
      }
    } else if (user.email) {
      const localPart = user.email.split('@')[0];
      const parts = localPart.split('.');
      if (parts.length >= 2) {
        initials[user.id] = `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      } else {
        initials[user.id] = localPart.substring(0, 2).toUpperCase();
      }
    } else {
      initials[user.id] = '?';
    }
  }

  return initials;
}

/**
 * Update delegate attendance
 */
export async function updateDelegateAttendance(
  delegateId: string,
  attendanceDetail: AttendanceDetail,
  userId: string
): Promise<OpenCourseDelegate> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .update({
      attendance_detail: attendanceDetail,
      attendance_marked_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delegateId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update delegate ID check status
 */
export async function updateDelegateIdCheck(
  delegateId: string,
  idChecked: boolean
): Promise<OpenCourseDelegate> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .update({
      id_checked: idChecked,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delegateId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update delegate ID type
 */
export async function updateDelegateIdType(
  delegateId: string,
  idType: IdType
): Promise<OpenCourseDelegate> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .update({
      id_type: idType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delegateId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update delegate licence category
 */
export async function updateDelegateLicenceCategory(
  delegateId: string,
  licenceCategory: LicenceCategory | null
): Promise<OpenCourseDelegate> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .update({
      licence_category: licenceCategory,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delegateId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update delegate driver number
 */
export async function updateDelegateDriverNumber(
  delegateId: string,
  driverNumber: string
): Promise<OpenCourseDelegate> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .update({
      driver_number: driverNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delegateId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update delegate additional comments
 */
export async function updateDelegateComments(
  delegateId: string,
  comments: string
): Promise<OpenCourseDelegate> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .update({
      additional_comments: comments,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delegateId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update delegate DVSA upload status (admin only)
 */
export async function updateDelegateDVSAUpload(
  delegateId: string,
  uploaded: boolean,
  userId: string
): Promise<OpenCourseDelegate> {
  const { data, error } = await supabase
    .from('open_course_delegates')
    .update({
      dvsa_uploaded: uploaded,
      dvsa_uploaded_at: uploaded ? new Date().toISOString() : null,
      dvsa_uploaded_by: uploaded ? userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delegateId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Batch update delegate fields (for efficiency)
 */
export async function updateDelegateFields(
  delegateId: string,
  updates: Partial<Pick<OpenCourseDelegate,
    'driver_number' | 'licence_category' | 'id_type' | 'id_checked' |
    'attendance_detail' | 'additional_comments' | 'delegate_name' | 'delegate_email'
  >>,
  userId?: string
): Promise<OpenCourseDelegate> {
  const updateData: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // Track who marked attendance if attendance_detail is being updated
  if (updates.attendance_detail && userId) {
    updateData.attendance_marked_by = userId;
  }

  const { data, error } = await supabase
    .from('open_course_delegates')
    .update(updateData)
    .eq('id', delegateId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Sign trainer declaration for a session
 */
export async function signTrainerDeclaration(
  sessionId: string,
  signed: boolean,
  userId: string
): Promise<OpenCourseSession> {
  const { data, error } = await supabase
    .from('open_course_sessions')
    .update({
      trainer_declaration_signed: signed,
      trainer_declaration_at: signed ? new Date().toISOString() : null,
      trainer_declaration_by: signed ? userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update session schedule details
 */
export async function updateSessionSchedule(
  sessionId: string,
  updates: Partial<Pick<OpenCourseSession, 'start_time' | 'end_time' | 'break_time'>>
): Promise<OpenCourseSession> {
  const { data, error } = await supabase
    .from('open_course_sessions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get sessions for register list with delegate counts
 */
export async function getSessionsForRegisters(filters?: {
  startDate?: string;
  endDate?: string;
  courseTypeId?: string;
  venueId?: string;
  trainerId?: string;
  searchTerm?: string;
}): Promise<OpenCourseSessionWithDetails[]> {
  let query = supabase
    .from('open_course_sessions')
    .select(`
      *,
      venue:venues(id, name, code, town, postcode),
      trainer:trainers(id, name, email),
      course_type:course_types(id, name, code, jaupt_code)
    `)
    .order('session_date', { ascending: false });

  if (filters?.startDate) {
    query = query.gte('session_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('session_date', filters.endDate);
  }
  if (filters?.courseTypeId) {
    query = query.eq('course_type_id', filters.courseTypeId);
  }
  if (filters?.venueId) {
    query = query.eq('venue_id', filters.venueId);
  }
  if (filters?.trainerId) {
    query = query.eq('trainer_id', filters.trainerId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Apply search filter if provided
  let sessions = data || [];
  if (filters?.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    sessions = sessions.filter(session =>
      session.event_title?.toLowerCase().includes(term) ||
      session.trainer?.name?.toLowerCase().includes(term) ||
      session.venue?.name?.toLowerCase().includes(term) ||
      session.course_type?.name?.toLowerCase().includes(term) ||
      session.course_type?.jaupt_code?.toLowerCase().includes(term)
    );
  }

  return sessions;
}

/**
 * Get delegates for a session with full details for register view
 */
export async function getDelegatesForRegister(sessionId: string): Promise<OpenCourseDelegateWithDetails[]> {
  // Note: We need to include delegates where attendance_status is NULL or not 'cancelled'
  // Using .or() to handle NULL values properly since neq doesn't match NULLs
  const { data, error } = await supabase
    .from('open_course_delegates')
    .select(`
      *,
      order:open_course_orders(*)
    `)
    .eq('session_id', sessionId)
    .or('attendance_status.neq.cancelled,attendance_status.is.null')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get register statistics for a session
 */
export async function getRegisterStats(sessionId: string): Promise<{
  totalDelegates: number;
  presentDelegates: number;
  absentDelegates: number;
  idsChecked: number;
  dvsaUploaded: number;
}> {
  const delegates = await getDelegatesForRegister(sessionId);

  const presentStatuses: AttendanceDetail[] = ['attended', 'late', 'left_early'];

  return {
    totalDelegates: delegates.length,
    presentDelegates: delegates.filter(d => d.attendance_detail && presentStatuses.includes(d.attendance_detail)).length,
    absentDelegates: delegates.filter(d => d.attendance_detail === 'absent').length,
    idsChecked: delegates.filter(d => d.id_checked).length,
    dvsaUploaded: delegates.filter(d => d.dvsa_uploaded).length,
  };
}

/**
 * Check if a course is a CPC course (has JAUPT code)
 */
export function isCPCCourse(session: OpenCourseSessionWithDetails): boolean {
  return !!session.course_type?.jaupt_code;
}

/**
 * Get delegate row color based on attendance and ID check status
 */
export function getDelegateRowColor(delegate: OpenCourseDelegate): string {
  const attendedStatuses: AttendanceDetail[] = ['attended', 'late', 'left_early'];
  const isAttended = delegate.attendance_detail && attendedStatuses.includes(delegate.attendance_detail);

  if (isAttended && delegate.id_checked) {
    return 'bg-green-500/10'; // Green background
  }

  // If absent, show pink/red
  if (delegate.attendance_detail === 'absent') {
    return 'bg-red-500/10';
  }

  // Default - no attendance marked yet or attended but ID not checked
  if (isAttended && !delegate.id_checked) {
    return 'bg-yellow-500/10'; // Yellow - needs attention
  }

  return ''; // No special color for unprocessed
}

/**
 * Get session with full register details
 */
export async function getSessionForRegister(sessionId: string): Promise<OpenCourseSessionWithDetails | null> {
  const { data, error } = await supabase
    .from('open_course_sessions')
    .select(`
      *,
      venue:venues(id, name, code, town, postcode, address1, address2),
      trainer:trainers(id, name, email),
      course_type:course_types(id, name, code, jaupt_code)
    `)
    .eq('id', sessionId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Check if current user has access to a session's register
 * (is the assigned trainer or an admin)
 */
export async function checkRegisterAccess(sessionId: string, userId: string): Promise<{
  hasAccess: boolean;
  isTrainer: boolean;
  isAdmin: boolean;
}> {
  // Check if user is admin
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (userError) throw userError;

  const isAdmin = userData?.role === 'admin';

  // If admin, they have access
  if (isAdmin) {
    return { hasAccess: true, isTrainer: false, isAdmin: true };
  }

  // Check if user is the assigned trainer
  const { data: sessionData, error: sessionError } = await supabase
    .from('open_course_sessions')
    .select(`
      trainer_id,
      trainer:trainers!inner(id, user_id)
    `)
    .eq('id', sessionId)
    .single();

  if (sessionError) throw sessionError;

  const isTrainer = (sessionData?.trainer as any)?.user_id === userId;

  return {
    hasAccess: isTrainer,
    isTrainer,
    isAdmin: false,
  };
}

/**
 * Get trainers list for filtering
 */
export async function getTrainers(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('trainers')
    .select('id, name')
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Get course types list for filtering
 */
export async function getCourseTypes(): Promise<CourseType[]> {
  const { data, error } = await supabase
    .from('course_types')
    .select('id, name, code, jaupt_code')
    .order('name');

  if (error) throw error;
  return data || [];
}
