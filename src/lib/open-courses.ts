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
  address1?: string;
  address2?: string;
  town?: string;
  postcode?: string;
  contact_name?: string;
  contact_email?: string;
  contact_telephone?: string;
  notes?: string;
  is_active: boolean;
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

export interface OpenCourseSession {
  id: string;
  wp_event_id: number | null;
  wp_repeat_interval: string | null;
  course_type_id: string | null;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  venue_id: string | null;
  trainer_id: string | null;
  capacity: number;
  available_spaces: number;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  is_virtual: boolean;
  meeting_url: string | null;
  meeting_id: string | null;
  meeting_password: string | null;
  price: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface OpenCourseSessionWithDetails extends OpenCourseSession {
  venue?: Venue;
  trainer?: {
    id: string;
    name: string;
    email: string | null;
  };
  course_type?: {
    id: string;
    name: string;
    code: string;
  };
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

export interface OpenCourseDelegate {
  id: string;
  order_id: string;
  session_id: string;
  wp_booking_id: number | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  dietary_requirements: string | null;
  special_needs: string | null;
  attendance_status: 'registered' | 'confirmed' | 'attended' | 'no_show' | 'cancelled';
  certificate_issued: boolean;
  certificate_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface OpenCourseDelegateWithDetails extends OpenCourseDelegate {
  order?: OpenCourseOrder;
  session?: OpenCourseSession;
}

export interface OpenCourseCapacityAlert {
  id: string;
  session_id: string;
  alert_type: 'low_capacity' | 'full' | 'overbooked';
  threshold_percentage: number;
  triggered_at: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
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
    .from('training_centres')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getActiveVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('training_centres')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getVenueById(id: string): Promise<Venue | null> {
  const { data, error } = await supabase
    .from('training_centres')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createVenue(venue: Omit<Venue, 'id' | 'created_at' | 'updated_at'>): Promise<Venue> {
  const { data, error } = await supabase
    .from('training_centres')
    .insert([venue])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateVenue(id: string, updates: Partial<Venue>): Promise<Venue> {
  const { data, error } = await supabase
    .from('training_centres')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVenue(id: string): Promise<void> {
  const { error } = await supabase
    .from('training_centres')
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
      venue:training_centres(id, name, town, postcode),
      trainer:trainers(id, name, email),
      course_type:course_types(id, name, code)
    `)
    .order('start_date', { ascending: true });

  if (filters?.startDate) {
    query = query.gte('start_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('start_date', filters.endDate);
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

  if (error) throw error;
  return data || [];
}

export async function getSessionById(id: string): Promise<OpenCourseSessionWithDetails | null> {
  const { data, error } = await supabase
    .from('open_course_sessions')
    .select(`
      *,
      venue:training_centres(id, name, town, postcode),
      trainer:trainers(id, name, email),
      course_type:course_types(id, name, code)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getSessionsForWeek(weekStartDate: string): Promise<OpenCourseSessionWithDetails[]> {
  const weekStart = new Date(weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return getSessions({
    startDate: weekStart.toISOString().split('T')[0],
    endDate: weekEnd.toISOString().split('T')[0],
  });
}

export async function createSession(session: Omit<OpenCourseSession, 'id' | 'created_at' | 'updated_at' | 'synced_at'>): Promise<OpenCourseSession> {
  const { data, error } = await supabase
    .from('open_course_sessions')
    .insert([{
      ...session,
      available_spaces: session.capacity,
    }])
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

export async function duplicateSession(id: string, newStartDate: string, newEndDate?: string): Promise<OpenCourseSession> {
  const original = await getSessionById(id);
  if (!original) throw new Error('Session not found');

  const { id: _, created_at, updated_at, synced_at, wp_event_id, wp_repeat_interval, ...sessionData } = original;

  const newSession = {
    ...sessionData,
    start_date: newStartDate,
    end_date: newEndDate || newStartDate,
    wp_event_id: null,
    wp_repeat_interval: null,
    available_spaces: sessionData.capacity,
    status: 'draft' as const,
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
    .neq('attendance_status', 'cancelled');

  if (countError) throw countError;

  // Get session capacity
  const session = await getSessionById(sessionId);
  if (!session) throw new Error('Session not found');

  const delegateCount = count || 0;
  const availableSpaces = session.capacity - delegateCount;

  // Update available spaces
  await updateSession(sessionId, { available_spaces: availableSpaces });

  // Check for capacity alerts
  const capacityPercentage = (delegateCount / session.capacity) * 100;

  if (capacityPercentage >= 100) {
    await createCapacityAlert(sessionId, 'overbooked', 100);
  } else if (capacityPercentage >= 90) {
    await createCapacityAlert(sessionId, 'full', 90);
  } else if (capacityPercentage >= 75) {
    await createCapacityAlert(sessionId, 'low_capacity', 75);
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
      session:open_course_sessions(*)
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
      session:open_course_sessions(*)
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
    .order('created_at', { ascending: false });

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getUnacknowledgedAlerts(): Promise<OpenCourseCapacityAlert[]> {
  const { data, error } = await supabase
    .from('open_course_capacity_alerts')
    .select('*')
    .eq('acknowledged', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createCapacityAlert(
  sessionId: string,
  alertType: OpenCourseCapacityAlert['alert_type'],
  thresholdPercentage: number
): Promise<OpenCourseCapacityAlert> {
  // Check if similar alert already exists for this session
  const { data: existing } = await supabase
    .from('open_course_capacity_alerts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('alert_type', alertType)
    .eq('acknowledged', false)
    .single();

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from('open_course_capacity_alerts')
    .insert([{
      session_id: sessionId,
      alert_type: alertType,
      threshold_percentage: thresholdPercentage,
      triggered_at: new Date().toISOString(),
      acknowledged: false,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function acknowledgeAlert(id: string, userId: string): Promise<OpenCourseCapacityAlert> {
  const { data, error } = await supabase
    .from('open_course_capacity_alerts')
    .update({
      acknowledged: true,
      acknowledged_by: userId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', id)
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

export function getCapacityColor(availableSpaces: number, capacity: number): string {
  const percentage = ((capacity - availableSpaces) / capacity) * 100;
  if (percentage >= 100) return 'text-red-400';
  if (percentage >= 90) return 'text-orange-400';
  if (percentage >= 75) return 'text-yellow-400';
  return 'text-green-400';
}

export function getCapacityBgColor(availableSpaces: number, capacity: number): string {
  const percentage = ((capacity - availableSpaces) / capacity) * 100;
  if (percentage >= 100) return 'bg-red-500/10 border-red-500/20';
  if (percentage >= 90) return 'bg-orange-500/10 border-orange-500/20';
  if (percentage >= 75) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-green-500/10 border-green-500/20';
}
