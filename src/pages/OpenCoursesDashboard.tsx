/**
 * Open Courses Dashboard
 *
 * Week grid view for managing public course sessions, delegates, and capacity.
 * Features:
 * - Week navigation with capacity indicators
 * - Drag-and-drop delegate transfers between sessions
 * - Session creation, editing, and duplication
 * - Real-time capacity monitoring
 */

import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Users,
  MapPin,
  Clock,
  Copy,
  Edit,
  Trash2,
  Video,
  X,
  Save,
  UserCog,
  MoveRight,
  Calendar,
  Mail,
  Send,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notification from '../components/Notification';
import { useAuth } from '../contexts/AuthContext';
import {
  getSessions,
  getSessionsForWeek,
  createSession,
  updateSession,
  duplicateSession,
  deleteSession,
  transferDelegate,
  getActiveVenues,
  formatDate,
  formatTime,
  getCapacityColor,
  getCapacityBgColor,
  OpenCourseSession,
  OpenCourseSessionWithDetails,
  Venue,
} from '../lib/open-courses';
import { supabase } from '../lib/supabase';

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

interface PageProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface SessionFormData {
  event_title: string;
  event_subtitle: string;
  event_description: string;
  session_date: string;
  start_time: string;
  end_time: string;
  venue_id: string;
  trainer_id: string;
  capacity_limit: number;
  course_type_id: string;
  status: string;
  is_online: boolean;
  meeting_url: string;
  meeting_id: string;
  meeting_password: string;
  price: number;
  notes: string;
}

interface DraggedDelegate {
  delegate: OpenCourseDelegateWithDetails;
  fromSessionId: string;
}

export default function OpenCoursesDashboard({ currentPage, onNavigate }: PageProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(today.setDate(diff));
  });

  const [sessions, setSessions] = useState<OpenCourseSessionWithDetails[]>([]);
  const [sessionDelegates, setSessionDelegates] = useState<Record<string, any[]>>({});
  const [venues, setVenues] = useState<Venue[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [courseTypes, setCourseTypes] = useState<any[]>([]);

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<OpenCourseSessionWithDetails | null>(null);
  const [sessionFormData, setSessionFormData] = useState<SessionFormData>(getEmptyFormData());

  const [draggedDelegate, setDraggedDelegate] = useState<DraggedDelegate | null>(null);
  const [dragOverSessionId, setDragOverSessionId] = useState<string | null>(null);

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [delegateToMove, setDelegateToMove] = useState<{
    delegate: OpenCourseDelegateWithDetails;
    currentSessionId: string;
    courseTypeId: string;
  } | null>(null);
  const [availableSessions, setAvailableSessions] = useState<OpenCourseSessionWithDetails[]>([]);

  const [showMoveConfirmModal, setShowMoveConfirmModal] = useState(false);
  const [selectedTargetSession, setSelectedTargetSession] = useState<OpenCourseSessionWithDetails | null>(null);
  const [sendMoveNotification, setSendMoveNotification] = useState(true);

  const [showEditDelegateModal, setShowEditDelegateModal] = useState(false);
  const [editingDelegate, setEditingDelegate] = useState<any | null>(null);
  const [delegateFormData, setDelegateFormData] = useState({
    delegate_name: '',
    delegate_email: '',
    delegate_phone: '',
    delegate_company: '',
    dietary_requirements: '',
    special_requirements: '',
    attendance_status: 'registered' as string,
    notes: '',
  });

  const [showAddDelegateModal, setShowAddDelegateModal] = useState(false);
  const [addDelegateStep, setAddDelegateStep] = useState(1);
  const [newDelegateData, setNewDelegateData] = useState({
    delegate_name: '',
    delegate_email: '',
    delegate_phone: '',
    delegate_company: '',
    dietary_requirements: '',
    special_requirements: '',
    notes: '',
  });
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [availableSessionsForBooking, setAvailableSessionsForBooking] = useState<OpenCourseSessionWithDetails[]>([]);
  const [delegateSuggestions, setDelegateSuggestions] = useState<any[]>([]);
  const [showDelegateSuggestions, setShowDelegateSuggestions] = useState(false);
  const [selectedExistingDelegateId, setSelectedExistingDelegateId] = useState<string | null>(null);
  const [delegateBookingHistory, setDelegateBookingHistory] = useState<any[]>([]);

  const [showResendModal, setShowResendModal] = useState(false);
  const [resendDelegate, setResendDelegate] = useState<any | null>(null);
  const [resendCurrentSession, setResendCurrentSession] = useState<any | null>(null);
  const [resendUpcomingBookings, setResendUpcomingBookings] = useState<any[]>([]);
  const [resendingSingle, setResendingSingle] = useState(false);
  const [resendingAll, setResendingAll] = useState(false);

  const [showTrainerAssignModal, setShowTrainerAssignModal] = useState(false);
  const [sessionToAssignTrainer, setSessionToAssignTrainer] = useState<OpenCourseSessionWithDetails | null>(null);
  const [availableTrainers, setAvailableTrainers] = useState<any[]>([]);
  const [assigningTrainer, setAssigningTrainer] = useState(false);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  function getEmptyFormData(): SessionFormData {
    return {
      event_title: '',
      event_subtitle: '',
      event_description: '',
      session_date: '',
      start_time: '09:00',
      end_time: '17:00',
      venue_id: '',
      trainer_id: '',
      capacity_limit: 12,
      course_type_id: '',
      status: 'draft',
      is_online: false,
      meeting_url: '',
      meeting_id: '',
      meeting_password: '',
      price: 0,
      notes: '',
    };
  }

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  async function loadData() {
    try {
      setLoading(true);

      // Diagnostic: Check what sessions exist in database (first 5)
      const { data: allSessions } = await supabase
        .from('open_course_sessions')
        .select('id, event_title, session_date, status')
        .order('session_date', { ascending: true })
        .limit(5);
      console.log('First 5 sessions in database:', allSessions);

      // Load sessions for the week
      const weekStart = currentWeekStart.toISOString().split('T')[0];
      console.log('Loading sessions for week starting:', weekStart);
      const sessionsData = await getSessionsForWeek(weekStart);
      console.log('Sessions loaded:', sessionsData.length, sessionsData);
      setSessions(sessionsData);

      // Load delegates for each session
      const delegatesMap: Record<string, any[]> = {};
      await Promise.all(
        sessionsData.map(async (session) => {
          const { data } = await supabase
            .from('open_course_delegates')
            .select('*')
            .eq('session_id', session.id)
            .neq('status', 'cancelled');
          delegatesMap[session.id] = data || [];
        })
      );
      setSessionDelegates(delegatesMap);

      // Load venues
      const venuesData = await getActiveVenues();
      setVenues(venuesData);

      // Load trainers
      const { data: trainersData } = await supabase
        .from('trainers')
        .select('id, name, email')
        .eq('active', true)
        .order('name');
      setTrainers(trainersData || []);

      // Load course types
      const { data: courseTypesData } = await supabase
        .from('course_types')
        .select('id, name, code')
        .order('name');
      setCourseTypes(courseTypesData || []);

    } catch (error: any) {
      console.error('Error loading data:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  }

  function navigateWeek(direction: 'prev' | 'next') {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  }

  function navigateMonth(direction: 'prev' | 'next') {
    const newDate = new Date(currentWeekStart);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentWeekStart(newDate);
  }

  function goToToday() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(today.setDate(diff)));
  }

  function jumpToDate(dateString: string) {
    const selectedDate = new Date(dateString);
    const day = selectedDate.getDay();
    const diff = selectedDate.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(selectedDate.setDate(diff)));
  }

  function getWeekDates(): Date[] {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }

  // Check if a session is multi-day
  function isMultiDaySession(session: OpenCourseSessionWithDetails): boolean {
    return !!(session.end_date && session.end_date !== session.session_date);
  }

  // Get single-day sessions for a specific date
  function getSessionsForDate(date: string): OpenCourseSessionWithDetails[] {
    return sessions.filter(session =>
      session.session_date === date && !isMultiDaySession(session)
    );
  }

  // Get multi-day sessions that overlap with the current week
  function getMultiDaySessions(): OpenCourseSessionWithDetails[] {
    const weekStart = weekDates[0]?.toISOString().split('T')[0];
    const weekEnd = weekDates[6]?.toISOString().split('T')[0];

    if (!weekStart || !weekEnd) return [];

    return sessions.filter(session => {
      if (!isMultiDaySession(session)) return false;

      const sessionStart = session.session_date;
      const sessionEnd = session.end_date!;

      // Check if the multi-day session overlaps with the current week
      return sessionStart <= weekEnd && sessionEnd >= weekStart;
    });
  }

  // Calculate the span of a multi-day session within the current week (returns column indices)
  function getMultiDaySpan(session: OpenCourseSessionWithDetails): { startCol: number; endCol: number } {
    const weekStart = weekDates[0]?.toISOString().split('T')[0] || '';
    const weekEnd = weekDates[6]?.toISOString().split('T')[0] || '';

    const sessionStart = session.session_date;
    const sessionEnd = session.end_date || session.session_date;

    // Clamp to week boundaries
    const visibleStart = sessionStart < weekStart ? weekStart : sessionStart;
    const visibleEnd = sessionEnd > weekEnd ? weekEnd : sessionEnd;

    // Find column indices
    let startCol = 0;
    let endCol = 6;

    weekDates.forEach((date, index) => {
      const dateStr = date.toISOString().split('T')[0];
      if (dateStr === visibleStart) startCol = index;
      if (dateStr === visibleEnd) endCol = index;
    });

    return { startCol, endCol };
  }

  function handleCreateSession() {
    setEditingSession(null);
    setSessionFormData(getEmptyFormData());
    setShowSessionModal(true);
  }

  function handleEditSession(session: OpenCourseSessionWithDetails) {
    setEditingSession(session);
    setSessionFormData({
      event_title: session.event_title,
      event_subtitle: session.event_subtitle || '',
      event_description: session.event_description || '',
      session_date: session.session_date,
      start_time: session.start_time || '09:00',
      end_time: session.end_time || '17:00',
      venue_id: session.venue_id || '',
      trainer_id: session.trainer_id || '',
      capacity_limit: session.capacity_limit,
      course_type_id: session.course_type_id || '',
      status: session.status,
      is_online: session.is_online,
      meeting_url: session.meeting_url || '',
      meeting_id: session.meeting_id || '',
      meeting_password: session.meeting_password || '',
      price: session.price || 0,
      notes: session.notes || '',
    });
    setShowSessionModal(true);
  }

  async function handleDuplicateSession(session: OpenCourseSessionWithDetails) {
    try {
      // Calculate next week's date
      const nextWeekDate = new Date(session.session_date);
      nextWeekDate.setDate(nextWeekDate.getDate() + 7);
      const newSessionDate = nextWeekDate.toISOString().split('T')[0];

      await duplicateSession(session.id, newSessionDate);

      setNotification({
        type: 'success',
        message: `Session duplicated successfully for ${formatDate(newSessionDate)}`,
      });

      loadData();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to duplicate session',
      });
    }
  }

  async function handleDeleteSession(session: OpenCourseSessionWithDetails) {
    const delegates = sessionDelegates[session.id] || [];

    if (delegates.length > 0) {
      if (!confirm(`This session has ${delegates.length} delegate(s). Are you sure you want to delete it?`)) {
        return;
      }
    }

    if (!confirm(`Are you sure you want to delete "${decodeHtmlEntities(session.event_title)}"?`)) {
      return;
    }

    try {
      await deleteSession(session.id);
      setNotification({
        type: 'success',
        message: 'Session deleted successfully',
      });
      loadData();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to delete session',
      });
    }
  }

  async function handleSaveSession() {
    try {
      if (!sessionFormData.event_title || !sessionFormData.session_date) {
        setNotification({
          type: 'error',
          message: 'Please fill in required fields (Title, Date)',
        });
        return;
      }

      const finalStatus = sessionFormData.trainer_id
        ? 'confirmed'
        : sessionFormData.status;

      const sessionData: Partial<OpenCourseSession> = {
        event_title: sessionFormData.event_title,
        event_subtitle: sessionFormData.event_subtitle || null,
        event_description: sessionFormData.event_description || null,
        session_date: sessionFormData.session_date,
        start_time: sessionFormData.start_time || null,
        end_time: sessionFormData.end_time || null,
        venue_id: sessionFormData.venue_id || null,
        trainer_id: sessionFormData.trainer_id || null,
        course_type_id: sessionFormData.course_type_id || null,
        capacity_limit: sessionFormData.capacity_limit,
        is_online: sessionFormData.is_online,
        meeting_url: sessionFormData.is_online ? sessionFormData.meeting_url || null : null,
        meeting_id: sessionFormData.is_online ? sessionFormData.meeting_id || null : null,
        meeting_password: sessionFormData.is_online ? sessionFormData.meeting_password || null : null,
        price: sessionFormData.price,
        status: finalStatus,
        notes: sessionFormData.notes || null,
        website_visible: true,
        allow_overbooking: false,
      };

      if (editingSession) {
        const oldTrainerId = editingSession.trainer_id;
        const newTrainerId = sessionData.trainer_id;

        await updateSession(editingSession.id, sessionData);

        if (!oldTrainerId && newTrainerId) {
          try {
            const { sendOpenCourseAssignmentNotification } = await import('../lib/booking-notifications');
            await sendOpenCourseAssignmentNotification(editingSession.id, newTrainerId);
          } catch (error) {
            console.error('Failed to send trainer notification:', error);
          }
        }

        setNotification({
          type: 'success',
          message: 'Session updated successfully',
        });
      } else {
        const newSession = await createSession(sessionData);

        if (newSession && sessionData.trainer_id) {
          try {
            const { sendOpenCourseAssignmentNotification } = await import('../lib/booking-notifications');
            await sendOpenCourseAssignmentNotification(newSession.id, sessionData.trainer_id);
          } catch (error) {
            console.error('Failed to send trainer notification:', error);
          }
        }

        setNotification({
          type: 'success',
          message: 'Session created successfully',
        });
      }

      setShowSessionModal(false);
      loadData();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to save session',
      });
    }
  }

  async function handleCancelSession() {
    if (!editingSession) return;

    if (!confirm(`Are you sure you want to cancel "${decodeHtmlEntities(editingSession.event_title)}"?`)) {
      return;
    }

    try {
      await updateSession(editingSession.id, { status: 'cancelled' });
      setNotification({
        type: 'success',
        message: 'Session cancelled successfully',
      });
      setShowSessionModal(false);
      loadData();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to cancel session',
      });
    }
  }

  // Search for existing delegates by name
  async function searchDelegatesByName(searchTerm: string) {
    if (!searchTerm || searchTerm.length < 2) {
      setDelegateSuggestions([]);
      setShowDelegateSuggestions(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('open_course_delegates')
        .select('id, delegate_name, delegate_email, delegate_phone, delegate_company, dietary_requirements, special_requirements')
        .ilike('delegate_name', `%${searchTerm}%`)
        .order('delegate_name')
        .limit(10);

      if (error) throw error;

      // Group by unique delegate (by email)
      const uniqueDelegates = data?.reduce((acc: any[], curr) => {
        const existing = acc.find(d => d.delegate_email === curr.delegate_email);
        if (!existing) {
          acc.push(curr);
        }
        return acc;
      }, []) || [];

      setDelegateSuggestions(uniqueDelegates);
      setShowDelegateSuggestions(uniqueDelegates.length > 0);
    } catch (error: any) {
      console.error('Error searching delegates:', error);
    }
  }

  // Fetch booking history for a delegate
  async function fetchDelegateBookingHistory(delegateEmail: string) {
    try {
      const { data, error } = await supabase
        .from('open_course_delegates')
        .select(`
          id,
          session_id,
          attendance_status,
          created_at,
          session:open_course_sessions!session_id(
            id,
            event_title,
            event_subtitle,
            session_date,
            start_time,
            end_time,
            is_online,
            status,
            venue_id,
            venues:venues!venue_id(
              name,
              town
            )
          )
        `)
        .eq('delegate_email', delegateEmail)
        .order('session(session_date)', { ascending: true });

      if (error) throw error;
      setDelegateBookingHistory(data || []);
    } catch (error: any) {
      console.error('Error fetching delegate booking history:', error);
      setDelegateBookingHistory([]);
    }
  }

  // Handle selecting an existing delegate from suggestions
  async function handleSelectExistingDelegate(delegate: any) {
    setNewDelegateData({
      delegate_name: delegate.delegate_name,
      delegate_email: delegate.delegate_email,
      delegate_phone: delegate.delegate_phone || '',
      delegate_company: delegate.delegate_company || '',
      dietary_requirements: delegate.dietary_requirements || '',
      special_requirements: delegate.special_requirements || '',
      notes: '',
    });
    setSelectedExistingDelegateId(delegate.id);
    setShowDelegateSuggestions(false);
    setDelegateSuggestions([]);
    await fetchDelegateBookingHistory(delegate.delegate_email);
  }

  // Drag and Drop Handlers
  function handleDragStart(delegate: OpenCourseDelegateWithDetails, fromSessionId: string) {
    setDraggedDelegate({ delegate, fromSessionId });
  }

  function handleDragOver(e: React.DragEvent, sessionId: string) {
    e.preventDefault();
    setDragOverSessionId(sessionId);
  }

  function handleDragLeave() {
    setDragOverSessionId(null);
  }

  async function handleDrop(e: React.DragEvent, toSessionId: string) {
    e.preventDefault();
    setDragOverSessionId(null);

    if (!draggedDelegate) return;
    if (draggedDelegate.fromSessionId === toSessionId) {
      setDraggedDelegate(null);
      return;
    }

    const targetSession = sessions.find(s => s.id === toSessionId);
    if (!targetSession) {
      setDraggedDelegate(null);
      return;
    }

    setSelectedTargetSession(targetSession);
    setDelegateToMove({
      delegate: draggedDelegate.delegate,
      currentSessionId: draggedDelegate.fromSessionId,
      courseTypeId: targetSession.course_type_id || '',
    });
    setShowMoveConfirmModal(true);
    setDraggedDelegate(null);
  }

  async function handleOpenMoveModal(delegate: OpenCourseDelegateWithDetails, currentSessionId: string, courseTypeId: string) {
    setDelegateToMove({ delegate, currentSessionId, courseTypeId });

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('open_course_sessions')
        .select(`
          *,
          venue:venues(name, town, postcode),
          trainer:trainers(name),
          course_type:course_types(name, duration_days)
        `)
        .eq('course_type_id', courseTypeId)
        .neq('id', currentSessionId)
        .gte('session_date', today.toISOString().split('T')[0])
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      setAvailableSessions(data || []);
      setShowMoveModal(true);
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to load available sessions',
      });
    }
  }

  function handleMoveDelegate(toSessionId: string) {
    const targetSession = availableSessions.find(s => s.id === toSessionId);
    if (!targetSession) return;

    setSelectedTargetSession(targetSession);
    setShowMoveConfirmModal(true);
  }

  async function confirmMoveDelegate() {
    if (!delegateToMove || !selectedTargetSession) return;

    try {
      await transferDelegate(delegateToMove.delegate.id, selectedTargetSession.id);

      if (sendMoveNotification) {
        const { queueEmail } = await import('../lib/email-queue');

        const sessionDate = new Date(selectedTargetSession.session_date).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        const venueName = selectedTargetSession.venue?.name || 'TBC';
        const venueAddress = [
          selectedTargetSession.venue?.address1,
          selectedTargetSession.venue?.town,
          selectedTargetSession.venue?.postcode
        ].filter(Boolean).join(', ') || 'Address TBC';

        const delegateFirstName = delegateToMove.delegate.delegate_name.split(' ')[0];

        await queueEmail({
          recipientEmail: delegateToMove.delegate.delegate_email,
          recipientName: delegateToMove.delegate.delegate_name,
          subject: `Course Session Change - ${selectedTargetSession.event_title}`,
          htmlBody: `
            <p>Dear ${delegateFirstName},</p>

            <p>Your course session has been moved to a new date.</p>

            <h3>New Course Details:</h3>
            <p><strong>Course:</strong> ${selectedTargetSession.event_title}</p>
            ${selectedTargetSession.event_subtitle ? `<p><strong>Details:</strong> ${decodeHtmlEntities(selectedTargetSession.event_subtitle)}</p>` : ''}
            <p><strong>Date:</strong> ${sessionDate}</p>
            <p><strong>Time:</strong> ${selectedTargetSession.start_time} - ${selectedTargetSession.end_time}</p>
            ${selectedTargetSession.is_online ? `
              <p><strong>Location:</strong> Online</p>
              ${selectedTargetSession.meeting_url ? `<p><strong>Meeting Link:</strong> <a href="${selectedTargetSession.meeting_url}">${selectedTargetSession.meeting_url}</a></p>` : ''}
            ` : `
              <p><strong>Venue:</strong> ${venueName}</p>
              <p><strong>Address:</strong> ${venueAddress}</p>
            `}

            <p>If you have any questions about this change, please don't hesitate to contact us.</p>

            <p>Best regards,<br>The Training Team</p>
          `,
          textBody: `Dear ${delegateFirstName},

Your course session has been moved to a new date.

New Course Details:
Course: ${selectedTargetSession.event_title}
${selectedTargetSession.event_subtitle ? `Details: ${decodeHtmlEntities(selectedTargetSession.event_subtitle)}\n` : ''}Date: ${sessionDate}
Time: ${selectedTargetSession.start_time} - ${selectedTargetSession.end_time}
${selectedTargetSession.is_online ? `Location: Online${selectedTargetSession.meeting_url ? `\nMeeting Link: ${selectedTargetSession.meeting_url}` : ''}` : `Venue: ${venueName}\nAddress: ${venueAddress}`}

If you have any questions about this change, please don't hesitate to contact us.

Best regards,
The Training Team`,
          priority: 5
        });
      }

      setNotification({
        type: 'success',
        message: `Delegate moved successfully${sendMoveNotification ? ' and notification email queued' : ''}`,
      });

      setShowMoveModal(false);
      setShowMoveConfirmModal(false);
      setDelegateToMove(null);
      setSelectedTargetSession(null);
      setSendMoveNotification(true);
      loadData();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to move delegate',
      });
    }
  }

  function handleOpenEditDelegate(delegate: any) {
    setEditingDelegate(delegate);
    setDelegateFormData({
      delegate_name: delegate.delegate_name || '',
      delegate_email: delegate.delegate_email || '',
      delegate_phone: delegate.delegate_phone || '',
      delegate_company: delegate.delegate_company || '',
      dietary_requirements: delegate.dietary_requirements || '',
      special_requirements: delegate.special_requirements || '',
      attendance_status: delegate.attendance_status || 'registered',
      notes: delegate.notes || '',
    });
    setShowEditDelegateModal(true);
  }

  async function handleSaveDelegate() {
    if (!editingDelegate) return;

    try {
      const { error } = await supabase
        .from('open_course_delegates')
        .update({
          delegate_name: delegateFormData.delegate_name,
          delegate_email: delegateFormData.delegate_email,
          delegate_phone: delegateFormData.delegate_phone || null,
          delegate_company: delegateFormData.delegate_company || null,
          dietary_requirements: delegateFormData.dietary_requirements || null,
          special_requirements: delegateFormData.special_requirements || null,
          attendance_status: delegateFormData.attendance_status,
          notes: delegateFormData.notes || null,
        })
        .eq('id', editingDelegate.id);

      if (error) throw error;

      setNotification({
        type: 'success',
        message: 'Delegate updated successfully',
      });

      setShowEditDelegateModal(false);
      setEditingDelegate(null);
      loadData();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to update delegate',
      });
    }
  }

  async function handleOpenAddDelegate() {
    setNewDelegateData({
      delegate_name: '',
      delegate_email: '',
      delegate_phone: '',
      delegate_company: '',
      dietary_requirements: '',
      special_requirements: '',
      notes: '',
    });
    setSelectedSessions(new Set());
    setAddDelegateStep(1);
    setShowAddDelegateModal(true);
  }

  async function handleNextStep() {
    if (!newDelegateData.delegate_name || !newDelegateData.delegate_email) {
      setNotification({
        type: 'error',
        message: 'Name and email are required',
      });
      return;
    }

    const allSessions = await getSessions();
    const futureSessions = allSessions.filter(s => {
      const sessionDate = new Date(s.session_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return sessionDate >= today && s.status === 'confirmed';
    }).sort((a, b) => {
      const dateCompare = a.session_date.localeCompare(b.session_date);
      if (dateCompare !== 0) return dateCompare;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });

    setAvailableSessionsForBooking(futureSessions);
    setAddDelegateStep(2);
  }

  function handleBackStep() {
    setAddDelegateStep(1);
  }

  async function handleConfirmBooking() {
    if (selectedSessions.size === 0) {
      setNotification({
        type: 'error',
        message: 'Please select at least one session',
      });
      return;
    }

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('open_course_orders')
        .insert({
          woocommerce_order_id: `MANUAL-${Date.now()}`,
          order_number: `MANUAL-${Date.now()}`,
          order_date: new Date().toISOString(),
          customer_name: newDelegateData.delegate_name,
          customer_email: newDelegateData.delegate_email,
          payment_status: 'paid',
          total_amount: 0,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const delegatesToInsert = Array.from(selectedSessions).map(sessionId => ({
        session_id: sessionId,
        order_id: orderData.id,
        delegate_name: newDelegateData.delegate_name,
        delegate_email: newDelegateData.delegate_email,
        delegate_phone: newDelegateData.delegate_phone || null,
        delegate_company: newDelegateData.delegate_company || null,
        dietary_requirements: newDelegateData.dietary_requirements || null,
        special_requirements: newDelegateData.special_requirements || null,
        notes: newDelegateData.notes || null,
        status: 'confirmed',
        booking_source: 'admin',
      }));

      const { error: delegatesError } = await supabase
        .from('open_course_delegates')
        .insert(delegatesToInsert);

      if (delegatesError) throw delegatesError;

      setNotification({
        type: 'success',
        message: `Delegate added to ${selectedSessions.size} session(s) successfully`,
      });

      setShowAddDelegateModal(false);
      setAddDelegateStep(1);
      setSelectedSessions(new Set());
      setDelegateSuggestions([]);
      setShowDelegateSuggestions(false);
      setSelectedExistingDelegateId(null);
      setDelegateBookingHistory([]);
      setNewDelegateData({
        delegate_name: '',
        delegate_email: '',
        delegate_phone: '',
        delegate_company: '',
        dietary_requirements: '',
        special_requirements: '',
        notes: '',
      });
      loadData();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to add delegate',
      });
    }
  }

  function toggleSessionSelection(sessionId: string) {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  }

  async function handleOpenResendModal(delegate: any, currentSession: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: allDelegateBookings } = await supabase
      .from('open_course_delegates')
      .select(`
        *,
        session:open_course_sessions!inner(
          id,
          session_date,
          start_time,
          end_time,
          event_title,
          event_subtitle,
          is_online,
          venue_id,
          venues:training_venues(
            id,
            name,
            address_line1,
            city,
            postcode
          )
        )
      `)
      .eq('delegate_email', delegate.delegate_email)
      .gte('session.session_date', today.toISOString().split('T')[0])
      .order('session.session_date', { ascending: true });

    const upcomingBookings = allDelegateBookings || [];

    if (upcomingBookings.length <= 1) {
      await sendSingleBookingEmail(delegate, currentSession);
    } else {
      setResendDelegate(delegate);
      setResendCurrentSession(currentSession);
      setResendUpcomingBookings(upcomingBookings);
      setShowResendModal(true);
    }
  }

  async function sendSingleBookingEmail(delegate: any, session: any) {
    setResendingSingle(true);
    try {
      const { sendTemplateEmail } = await import('../lib/email');

      const templateData = {
        delegate_name: delegate.delegate_name,
        course_name: session.event_title,
        course_subtitle: session.event_subtitle || '',
        session_date: formatDate(session.session_date),
        start_time: session.start_time ? formatTime(session.start_time) : '',
        end_time: session.end_time ? formatTime(session.end_time) : '',
        location: session.is_online ? 'Online' : (session.venue?.name || 'TBA'),
        location_address: session.venue ? `${session.venue.address_line1}, ${session.venue.city}, ${session.venue.postcode}` : '',
        is_online: session.is_online,
      };

      const success = await sendTemplateEmail(
        delegate.delegate_email,
        'open_course_booking_confirmation',
        templateData,
        { recipientName: delegate.delegate_name }
      );

      if (success) {
        setNotification({
          type: 'success',
          message: 'Booking details sent successfully',
        });
      } else {
        setNotification({
          type: 'error',
          message: 'Failed to send booking details',
        });
      }
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to send booking details',
      });
    } finally {
      setResendingSingle(false);
    }
  }

  async function handleResendSingle() {
    if (!resendDelegate || !resendCurrentSession) return;
    await sendSingleBookingEmail(resendDelegate, resendCurrentSession);
    setShowResendModal(false);
  }

  async function handleResendAll() {
    if (!resendDelegate || resendUpcomingBookings.length === 0) return;

    setResendingAll(true);
    try {
      const { sendTemplateEmail } = await import('../lib/email');

      const bookingsList = resendUpcomingBookings.map((booking: any) => {
        const session = booking.session;
        return `
          <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${session.event_title}</h3>
            ${session.event_subtitle ? `<p style="margin: 0 0 10px 0; color: #666;">${session.event_subtitle}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Date:</strong> ${formatDate(session.session_date)}</p>
            ${session.start_time ? `<p style="margin: 5px 0;"><strong>Time:</strong> ${formatTime(session.start_time)} - ${formatTime(session.end_time || '')}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Location:</strong> ${session.is_online ? 'Online' : (session.venues?.name || 'TBA')}</p>
            ${session.venues && !session.is_online ? `<p style="margin: 5px 0; color: #666;">${session.venues.address_line1}, ${session.venues.city}, ${session.venues.postcode}</p>` : ''}
          </div>
        `;
      }).join('');

      const templateData = {
        delegate_name: resendDelegate.delegate_name,
        bookings_count: resendUpcomingBookings.length,
        bookings_list: bookingsList,
      };

      const success = await sendTemplateEmail(
        resendDelegate.delegate_email,
        'open_course_multiple_bookings',
        templateData,
        { recipientName: resendDelegate.delegate_name }
      );

      if (success) {
        setNotification({
          type: 'success',
          message: `Booking details sent for ${resendUpcomingBookings.length} session(s)`,
        });
      } else {
        setNotification({
          type: 'error',
          message: 'Failed to send booking details',
        });
      }
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to send booking details',
      });
    } finally {
      setResendingAll(false);
      setShowResendModal(false);
    }
  }

  async function handleOpenTrainerAssignModal(session: OpenCourseSessionWithDetails) {
    setSessionToAssignTrainer(session);

    try {
      const { data: courseType } = await supabase
        .from('course_types')
        .select('trainer_type_id')
        .eq('id', session.course_type_id)
        .single();

      if (!courseType?.trainer_type_id) {
        setNotification({
          type: 'error',
          message: 'Course type has no trainer type assigned',
        });
        return;
      }

      const { data: trainerIds } = await supabase
        .from('trainer_trainer_types')
        .select('trainer_id')
        .eq('trainer_type_id', courseType.trainer_type_id);

      if (!trainerIds || trainerIds.length === 0) {
        setNotification({
          type: 'warning',
          message: 'No trainers available for this course type',
        });
        setAvailableTrainers([]);
        setShowTrainerAssignModal(true);
        return;
      }

      const trainerIdsList = trainerIds.map(t => t.trainer_id);

      const { data: trainersData, error } = await supabase
        .from('trainers')
        .select('id, name, email, active, suspended')
        .in('id', trainerIdsList)
        .eq('active', true)
        .eq('suspended', false)
        .order('name');

      if (error) throw error;

      setAvailableTrainers(trainersData || []);
      setShowTrainerAssignModal(true);
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to load available trainers',
      });
    }
  }

  async function handleAssignTrainer(trainerId: string) {
    if (!sessionToAssignTrainer) return;

    setAssigningTrainer(true);
    try {
      const { error } = await supabase
        .from('open_course_sessions')
        .update({ trainer_id: trainerId, updated_at: new Date().toISOString() })
        .eq('id', sessionToAssignTrainer.id);

      if (error) throw error;

      setNotification({
        type: 'success',
        message: 'Trainer assigned successfully',
      });

      setShowTrainerAssignModal(false);
      setSessionToAssignTrainer(null);
      loadWeekData();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to assign trainer',
      });
    } finally {
      setAssigningTrainer(false);
    }
  }

  async function handleUnassignTrainer() {
    if (!sessionToAssignTrainer) return;

    setAssigningTrainer(true);
    try {
      const { error } = await supabase
        .from('open_course_sessions')
        .update({ trainer_id: null, updated_at: new Date().toISOString() })
        .eq('id', sessionToAssignTrainer.id);

      if (error) throw error;

      setNotification({
        type: 'success',
        message: 'Trainer unassigned successfully',
      });

      setShowTrainerAssignModal(false);
      setSessionToAssignTrainer(null);
      loadWeekData();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to unassign trainer',
      });
    } finally {
      setAssigningTrainer(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <PageHeader currentPage={currentPage} onNavigate={onNavigate} onEditProfile={() => {}} />
        <div className="flex items-center justify-center h-96">
          <div className="text-slate-400">Loading...</div>
        </div>
      </div>
    );
  }

  const weekDates = getWeekDates();
  const weekDaysLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} onEditProfile={() => {}} />

      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Open Courses Dashboard</h1>
          <p className="text-slate-400">
            Manage public course sessions, delegates, and capacity
          </p>
        </div>

        {/* Week Navigation */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
                  title="Previous Month"
                >
                  <ChevronsLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigateWeek('prev')}
                  className="p-2 hover:bg-slate-800 rounded transition-colors"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>

              <div className="text-lg font-semibold">
                Week of {formatDate(currentWeekStart)}
              </div>

              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => navigateWeek('next')}
                  className="p-2 hover:bg-slate-800 rounded transition-colors"
                  title="Next Week"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
                  title="Next Month"
                >
                  <ChevronsRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400">Jump to:</label>
                <input
                  type="date"
                  onChange={(e) => jumpToDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm hover:border-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  title="Jump to date"
                />
              </div>

              <button
                onClick={goToToday}
                className="px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors text-sm"
              >
                Today
              </button>

              <button
                onClick={handleOpenAddDelegate}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded transition-colors text-sm font-medium"
              >
                <UserCog className="w-4 h-4" />
                New Delegate
              </button>

              <button
                onClick={handleCreateSession}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Session
              </button>
            </div>
          </div>
        </div>

        {/* Week Grid Container */}
        <div className="relative">
          {/* Week Grid */}
          <div className="grid grid-cols-7 gap-4">
            {weekDates.map((date, index) => {
              const dateString = date.toISOString().split('T')[0];
              const daySessions = getSessionsForDate(dateString);
              const isToday = dateString === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={dateString}
                  className={`bg-slate-900 border rounded-lg overflow-hidden ${
                    isToday ? 'border-blue-500' : 'border-slate-800'
                  }`}
                >
                  {/* Day Header */}
                  <div className={`p-3 border-b ${isToday ? 'bg-blue-500/10 border-blue-500/20' : 'border-slate-800'}`}>
                    <div className="font-semibold text-sm">{weekDaysLabels[index]}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>

                {/* Sessions */}
                <div className="p-2 space-y-2 min-h-[200px]">
                  {daySessions.length === 0 ? (
                    <div className="text-center text-slate-500 text-xs py-8">
                      No sessions
                    </div>
                  ) : (
                    daySessions.map((session) => {
                      const delegates = sessionDelegates[session.id] || [];
                      const delegateCount = delegates.length;
                      const capacityColor = getCapacityColor(delegateCount, session.capacity_limit);
                      const capacityBg = getCapacityBgColor(delegateCount, session.capacity_limit);
                      const isDragOver = dragOverSessionId === session.id;

                      return (
                        <div
                          key={session.id}
                          className={`border rounded p-2 text-xs transition-all ${capacityBg} ${
                            isDragOver ? 'ring-2 ring-blue-500 scale-105' : ''
                          }`}
                          onDragOver={(e) => handleDragOver(e, session.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, session.id)}
                        >
                          {/* Session Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate" title={decodeHtmlEntities(session.event_title)}>
                                {decodeHtmlEntities(session.event_title)}
                              </div>
                              {session.course_type && (
                                <div className="text-slate-400 text-[10px] truncate">
                                  {session.course_type.code}
                                </div>
                              )}
                            </div>
                            {session.is_online && (
                              <Video className="w-3 h-3 text-blue-400 ml-1 flex-shrink-0" />
                            )}
                          </div>

                          {/* Session Details */}
                          <div className="space-y-1 mb-2">
                            {session.start_time && (
                              <div className="flex items-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3" />
                                <span>{formatTime(session.start_time)} - {formatTime(session.end_time || '')}</span>
                              </div>
                            )}

                            {session.venue && !session.is_online && (
                              <div className="flex items-center gap-1 text-slate-400">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate" title={session.venue.name}>
                                  {session.venue.town || session.venue.name}
                                </span>
                              </div>
                            )}

                            {session.trainer ? (
                              <div
                                className="flex items-center gap-1 text-slate-400 cursor-pointer hover:text-slate-300 transition-colors"
                                onClick={() => handleOpenTrainerAssignModal(session)}
                                title="Click to change trainer"
                              >
                                <UserCog className="w-3 h-3" />
                                <span className="truncate" title={session.trainer.name}>
                                  {session.trainer.name}
                                </span>
                              </div>
                            ) : (
                              <div
                                className="flex items-center gap-1 text-amber-400 cursor-pointer hover:text-amber-300 transition-colors"
                                onClick={() => handleOpenTrainerAssignModal(session)}
                                title="Click to assign trainer"
                              >
                                <UserCog className="w-3 h-3" />
                                <span className="text-xs font-semibold">ASSIGN TRAINER</span>
                              </div>
                            )}

                            <div className="flex items-center gap-1">
                              <Users className={`w-3 h-3 ${capacityColor}`} />
                              <span className={capacityColor}>
                                {delegateCount} / {session.capacity_limit}
                              </span>
                              {delegateCount >= session.capacity_limit && (
                                <span className="ml-1 text-red-400 font-semibold">FULL</span>
                              )}
                            </div>
                          </div>

                          {/* Delegates */}
                          {delegates.length > 0 && (
                            <div className="space-y-1 mb-2 max-h-32 overflow-y-auto overflow-x-hidden">
                              {delegates.map((delegate) => (
                                <div
                                  key={delegate.id}
                                  className="bg-slate-800/50 rounded px-2 py-1 hover:bg-slate-800 transition-colors group"
                                >
                                  <div className="flex items-center gap-1">
                                    <div
                                      draggable
                                      onDragStart={() => handleDragStart(delegate, session.id)}
                                      className="flex-1 cursor-move"
                                      title="Drag to transfer delegate"
                                    >
                                      <div className="text-[10px] font-medium truncate">
                                        {delegate.delegate_name}
                                      </div>
                                      {delegate.delegate_company && (
                                        <div className="text-[9px] text-slate-500 truncate">
                                          {delegate.delegate_company}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenResendModal(delegate, session);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                                      title="Resend booking details"
                                    >
                                      <Mail className="w-3 h-3 text-slate-400" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditDelegate(delegate);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                                      title="Edit delegate details"
                                    >
                                      <Edit className="w-3 h-3 text-slate-400" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenMoveModal(delegate, session.id, session.course_type_id);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                                      title="Move to different session"
                                    >
                                      <MoveRight className="w-3 h-3 text-slate-400" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-1 pt-2 border-t border-slate-700/50">
                            <button
                              onClick={() => handleEditSession(session)}
                              className="p-1 hover:bg-slate-700 rounded transition-colors"
                              title="Edit Session"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDuplicateSession(session)}
                              className="p-1 hover:bg-slate-700 rounded transition-colors"
                              title="Duplicate Session"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteSession(session)}
                              className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                              title="Delete Session"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
          </div>

          {/* Multi-Day Sessions - displayed as full cards spanning multiple columns */}
          {getMultiDaySessions().length > 0 && (
            <>
              <div className="relative mt-4">
                {/* Background columns */}
                <div className="grid grid-cols-7 gap-4 absolute inset-0 pointer-events-none">
                  {weekDates.map((date, index) => {
                    const dateString = date.toISOString().split('T')[0];
                    const isToday = dateString === new Date().toISOString().split('T')[0];
                    return (
                      <div
                        key={`bg-${dateString}`}
                        className={`bg-slate-900 border rounded-lg ${
                          isToday ? 'border-blue-500' : 'border-slate-800'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Multi-day sessions overlay */}
                <div className="grid grid-cols-7 gap-4 relative">
                  {getMultiDaySessions().map((session) => {
                  const { startCol, endCol } = getMultiDaySpan(session);
                  const spanCols = endCol - startCol + 1;
                  const delegates = sessionDelegates[session.id] || [];
                  const delegateCount = delegates.length;
                  const capacityColor = getCapacityColor(delegateCount, session.capacity_limit);
                  const capacityBg = getCapacityBgColor(delegateCount, session.capacity_limit);
                  const isDragOver = dragOverSessionId === session.id;

                  // Calculate days text
                  const startDate = new Date(session.session_date);
                  const endDate = new Date(session.end_date || session.session_date);
                  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                  return (
                  <div
                    key={session.id}
                    className={`border rounded p-2 text-xs transition-all ${capacityBg} ${
                      isDragOver ? 'ring-2 ring-blue-500 scale-105' : ''
                    }`}
                    style={{
                      gridColumn: `${startCol + 1} / span ${spanCols}`,
                    }}
                    onDragOver={(e) => handleDragOver(e, session.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, session.id)}
                  >
                    {/* Session Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate" title={decodeHtmlEntities(session.event_title)}>
                          {decodeHtmlEntities(session.event_title)}
                        </div>
                        <div className="flex items-center gap-2">
                          {session.course_type && (
                            <span className="text-slate-400 text-[10px] truncate">
                              {session.course_type.code}
                            </span>
                          )}
                          <span className="text-purple-400 text-[10px] font-medium">
                            ({daysDiff} day{daysDiff > 1 ? 's' : ''})
                          </span>
                        </div>
                      </div>
                      {session.is_online && (
                        <Video className="w-3 h-3 text-blue-400 ml-1 flex-shrink-0" />
                      )}
                    </div>

                    {/* Session Details */}
                    <div className="space-y-1 mb-2">
                      {session.start_time && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(session.start_time)} - {formatTime(session.end_time || '')}</span>
                        </div>
                      )}

                      {session.venue && !session.is_online && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate" title={session.venue.name}>
                            {session.venue.town || session.venue.name}
                          </span>
                        </div>
                      )}

                      {session.trainer ? (
                        <div
                          className="flex items-center gap-1 text-slate-400 cursor-pointer hover:text-slate-300 transition-colors"
                          onClick={() => handleOpenTrainerAssignModal(session)}
                          title="Click to change trainer"
                        >
                          <UserCog className="w-3 h-3" />
                          <span className="truncate" title={session.trainer.name}>
                            {session.trainer.name}
                          </span>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1 text-amber-400 cursor-pointer hover:text-amber-300 transition-colors"
                          onClick={() => handleOpenTrainerAssignModal(session)}
                          title="Click to assign trainer"
                        >
                          <UserCog className="w-3 h-3" />
                          <span className="text-xs font-semibold">ASSIGN TRAINER</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <Users className={`w-3 h-3 ${capacityColor}`} />
                        <span className={capacityColor}>
                          {delegateCount} / {session.capacity_limit}
                        </span>
                        {delegateCount >= session.capacity_limit && (
                          <span className="ml-1 text-red-400 font-semibold">FULL</span>
                        )}
                      </div>
                    </div>

                    {/* Delegates */}
                    {delegates.length > 0 && (
                      <div className="space-y-1 mb-2 max-h-32 overflow-y-auto overflow-x-hidden">
                        {delegates.map((delegate) => (
                          <div
                            key={delegate.id}
                            className="bg-slate-800/50 rounded px-2 py-1 hover:bg-slate-800 transition-colors group"
                          >
                            <div className="flex items-center gap-1">
                              <div
                                draggable
                                onDragStart={() => handleDragStart(delegate, session.id)}
                                className="flex-1 cursor-move"
                                title="Drag to transfer delegate"
                              >
                                <div className="text-[10px] font-medium truncate">
                                  {delegate.delegate_name}
                                </div>
                                {delegate.delegate_company && (
                                  <div className="text-[9px] text-slate-500 truncate">
                                    {delegate.delegate_company}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenResendModal(delegate, session);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                                title="Resend booking details"
                              >
                                <Mail className="w-3 h-3 text-slate-400" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditDelegate(delegate);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                                title="Edit delegate details"
                              >
                                <Edit className="w-3 h-3 text-slate-400" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenMoveModal(delegate, session.id, session.course_type_id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                                title="Move to different session"
                              >
                                <MoveRight className="w-3 h-3 text-slate-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-2 border-t border-slate-700/50">
                      <button
                        onClick={() => handleEditSession(session)}
                        className="p-1 hover:bg-slate-700 rounded transition-colors"
                        title="Edit Session"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDuplicateSession(session)}
                        className="p-1 hover:bg-slate-700 rounded transition-colors"
                        title="Duplicate Session"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteSession(session)}
                        className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                        title="Delete Session"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  );
                })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm font-semibold mb-3">Capacity Legend</div>
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500/10 border border-green-500/20"></div>
              <span className="text-slate-400">&lt; 75% Full</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-500/10 border border-yellow-500/20"></div>
              <span className="text-slate-400">75-90% Full</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-500/10 border border-orange-500/20"></div>
              <span className="text-slate-400">90-100% Full</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500/10 border border-red-500/20"></div>
              <span className="text-slate-400">Overbooked</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            <strong>Tip:</strong> Drag and drop delegates between sessions to transfer them
          </div>
        </div>
      </div>

      {/* Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-3xl my-8">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex items-start justify-between rounded-t-lg">
              <h2 className="text-xl font-semibold">
                {editingSession ? 'Edit Session' : 'Create New Session'}
              </h2>
              <button
                onClick={() => setShowSessionModal(false)}
                className="p-1 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={sessionFormData.event_title}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, event_title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  placeholder="e.g., Forklift Training - Counterbalance"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={sessionFormData.event_subtitle}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, event_subtitle: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  placeholder="Optional subtitle"
                />
              </div>

              {/* Course Type */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Course Type
                </label>
                <select
                  value={sessionFormData.course_type_id}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, course_type_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                >
                  <option value="">Select course type...</option>
                  {courseTypes.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.code} - {ct.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  value={sessionFormData.event_description}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, event_description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Session Date *
                </label>
                <input
                  type="date"
                  value={sessionFormData.session_date}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, session_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                />
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={sessionFormData.start_time}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={sessionFormData.end_time}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  />
                </div>
              </div>

              {/* Online Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_online"
                  checked={sessionFormData.is_online}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, is_online: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_online" className="text-sm cursor-pointer">
                  Virtual/Online Session
                </label>
              </div>

              {/* Venue (if not online) */}
              {!sessionFormData.is_online && (
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Venue
                  </label>
                  <select
                    value={sessionFormData.venue_id}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, venue_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  >
                    <option value="">Select venue...</option>
                    {venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}{venue.town ? ` - ${venue.town}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Meeting Details (if online) */}
              {sessionFormData.is_online && (
                <>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                      Meeting URL
                    </label>
                    <input
                      type="url"
                      value={sessionFormData.meeting_url}
                      onChange={(e) => setSessionFormData({ ...sessionFormData, meeting_url: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                      placeholder="https://zoom.us/j/..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                        Meeting ID
                      </label>
                      <input
                        type="text"
                        value={sessionFormData.meeting_id}
                        onChange={(e) => setSessionFormData({ ...sessionFormData, meeting_id: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                        Meeting Password
                      </label>
                      <input
                        type="text"
                        value={sessionFormData.meeting_password}
                        onChange={(e) => setSessionFormData({ ...sessionFormData, meeting_password: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Trainer */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Trainer
                </label>
                <select
                  value={sessionFormData.trainer_id}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, trainer_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                >
                  <option value="">Select trainer...</option>
                  {trainers.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Capacity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={sessionFormData.capacity_limit}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, capacity_limit: parseInt(e.target.value) || 12 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Price (£)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sessionFormData.price}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                />
              </div>


              {/* Notes */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Notes
                </label>
                <textarea
                  value={sessionFormData.notes}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  rows={3}
                  placeholder="Internal notes..."
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex items-center justify-between rounded-b-lg">
              <div>
                {editingSession && editingSession.status !== 'cancelled' && (
                  <button
                    onClick={handleCancelSession}
                    className="px-4 py-2 border border-red-700 hover:border-red-600 text-red-400 hover:text-red-300 rounded transition-colors"
                  >
                    Cancel Session
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
                >
                  Close
                </button>
                {(!editingSession || editingSession.status !== 'cancelled') && (
                  <button
                    onClick={handleSaveSession}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {editingSession ? 'Update Session' : 'Create Session'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Delegate Modal */}
      {showMoveModal && delegateToMove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-semibold">Move Delegate</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Move {delegateToMove.delegate.delegate_name} to another session
                </p>
              </div>
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setDelegateToMove(null);
                }}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {availableSessions.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No upcoming sessions available for this course type
                </div>
              ) : (
                <div className="space-y-3">
                  {availableSessions.map((session) => {
                    const delegates = sessionDelegates[session.id] || [];
                    const currentCapacity = delegates.length;
                    const isFull = currentCapacity >= session.capacity_limit;

                    return (
                      <button
                        key={session.id}
                        onClick={() => handleMoveDelegate(session.id)}
                        disabled={isFull}
                        className={`w-full text-left p-4 rounded-lg border transition-all ${
                          isFull
                            ? 'border-slate-700 bg-slate-800/30 opacity-50 cursor-not-allowed'
                            : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{session.event_title}</div>
                            {session.event_subtitle && (
                              <div className="text-sm text-slate-400 truncate">
                                {decodeHtmlEntities(session.event_subtitle)}
                              </div>
                            )}

                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(new Date(session.session_date))}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {session.start_time} - {session.end_time}
                              </div>
                              {session.is_online ? (
                                <div className="flex items-center gap-1">
                                  <Video className="w-3 h-3" />
                                  Online
                                </div>
                              ) : (
                                session.venue && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {session.venue.name}
                                    {session.venue.town && `, ${session.venue.town}`}
                                  </div>
                                )
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className={isFull ? 'text-red-400 font-medium' : ''}>
                              {currentCapacity}/{session.capacity_limit}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Move Confirmation Modal */}
      {showMoveConfirmModal && delegateToMove && selectedTargetSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold">Confirm Move</h2>
              <button
                onClick={() => {
                  setShowMoveConfirmModal(false);
                  setSelectedTargetSession(null);
                  setSendMoveNotification(true);
                }}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-slate-300 mb-4">
                  Move <span className="font-medium text-white">{delegateToMove.delegate.first_name} {delegateToMove.delegate.last_name}</span> to:
                </p>

                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
                  <div className="font-medium">{selectedTargetSession.event_title}</div>
                  {selectedTargetSession.event_subtitle && (
                    <div className="text-sm text-slate-400">
                      {decodeHtmlEntities(selectedTargetSession.event_subtitle)}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(new Date(selectedTargetSession.session_date))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {selectedTargetSession.start_time} - {selectedTargetSession.end_time}
                    </div>
                  </div>
                  {selectedTargetSession.is_online ? (
                    <div className="flex items-center gap-1 text-sm text-slate-400">
                      <Video className="w-4 h-4" />
                      Online
                    </div>
                  ) : (
                    selectedTargetSession.venue && (
                      <div className="flex items-center gap-1 text-sm text-slate-400">
                        <MapPin className="w-4 h-4" />
                        {selectedTargetSession.venue.name}
                        {selectedTargetSession.venue.town && `, ${selectedTargetSession.venue.town}`}
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendMoveNotification}
                    onChange={(e) => setSendMoveNotification(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                  />
                  <div>
                    <div className="font-medium text-sm">Send notification email</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Notify the delegate about their new course session details
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowMoveConfirmModal(false);
                  setSelectedTargetSession(null);
                  setSendMoveNotification(true);
                }}
                className="px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMoveDelegate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
              >
                <MoveRight className="w-4 h-4" />
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Delegate Modal */}
      {showEditDelegateModal && editingDelegate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-semibold">Edit Delegate</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Update delegate information
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditDelegateModal(false);
                  setEditingDelegate(null);
                }}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={delegateFormData.delegate_name}
                    onChange={(e) => setDelegateFormData({ ...delegateFormData, delegate_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={delegateFormData.delegate_email}
                    onChange={(e) => setDelegateFormData({ ...delegateFormData, delegate_email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={delegateFormData.delegate_phone}
                    onChange={(e) => setDelegateFormData({ ...delegateFormData, delegate_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={delegateFormData.delegate_company}
                    onChange={(e) => setDelegateFormData({ ...delegateFormData, delegate_company: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Dietary Requirements
                  </label>
                  <textarea
                    value={delegateFormData.dietary_requirements}
                    onChange={(e) => setDelegateFormData({ ...delegateFormData, dietary_requirements: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                    rows={2}
                    placeholder="Any dietary requirements..."
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Special Requirements
                  </label>
                  <textarea
                    value={delegateFormData.special_requirements}
                    onChange={(e) => setDelegateFormData({ ...delegateFormData, special_requirements: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                    rows={2}
                    placeholder="Any special needs or accessibility requirements..."
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Attendance Status
                  </label>
                  <select
                    value={delegateFormData.attendance_status}
                    onChange={(e) => setDelegateFormData({ ...delegateFormData, attendance_status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  >
                    <option value="registered">Registered</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="attended">Attended</option>
                    <option value="no_show">No Show</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={delegateFormData.notes}
                    onChange={(e) => setDelegateFormData({ ...delegateFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                    rows={3}
                    placeholder="Internal notes..."
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex items-center justify-end gap-3 rounded-b-lg">
              <button
                onClick={() => {
                  setShowEditDelegateModal(false);
                  setEditingDelegate(null);
                }}
                className="px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDelegate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Delegate Modal */}
      {showAddDelegateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`bg-slate-900 border border-slate-800 rounded-lg w-full ${selectedExistingDelegateId ? 'max-w-7xl' : 'max-w-4xl'} max-h-[90vh] flex flex-col`}>
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-semibold">Add New Delegate</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Step {addDelegateStep} of 2: {addDelegateStep === 1 ? 'Delegate Information' : 'Select Sessions'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddDelegateModal(false);
                  setAddDelegateStep(1);
                  setSelectedSessions(new Set());
                  setDelegateSuggestions([]);
                  setShowDelegateSuggestions(false);
                  setSelectedExistingDelegateId(null);
                  setDelegateBookingHistory([]);
                  setNewDelegateData({
                    delegate_name: '',
                    delegate_email: '',
                    delegate_phone: '',
                    delegate_company: '',
                    dietary_requirements: '',
                    special_requirements: '',
                    notes: '',
                  });
                }}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {addDelegateStep === 1 ? (
                <div className={selectedExistingDelegateId ? "grid grid-cols-3 gap-6" : "grid grid-cols-2 gap-4"}>
                  {/* Booking History Column - Only shown for existing delegates */}
                  {selectedExistingDelegateId && (
                    <div className="col-span-1 border-r border-slate-700 pr-6">
                      <h3 className="text-lg font-semibold mb-4">Booking History</h3>
                      <div className="space-y-3">
                        {delegateBookingHistory.length === 0 ? (
                          <p className="text-sm text-slate-400">No previous bookings</p>
                        ) : (
                          delegateBookingHistory.map((booking: any) => (
                            <div
                              key={booking.id}
                              className="p-3 bg-slate-800 rounded border border-slate-700"
                            >
                              <div className="font-medium text-sm mb-1">
                                {decodeHtmlEntities(booking.session.event_title)}
                              </div>
                              {booking.session.event_subtitle && (
                                <div className="text-xs text-slate-400 mb-2">
                                  {decodeHtmlEntities(booking.session.event_subtitle)}
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(booking.session.session_date)} at {formatTime(booking.session.start_time)}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                <MapPin className="w-3 h-3" />
                                {booking.session.is_online ? (
                                  <span className="flex items-center gap-1">
                                    <Video className="w-3 h-3" />
                                    Online
                                  </span>
                                ) : booking.session.venues ? (
                                  `${booking.session.venues.name}, ${booking.session.venues.town}`
                                ) : (
                                  'Location TBC'
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  booking.session.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                  booking.session.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                  'bg-slate-700 text-slate-400'
                                }`}>
                                  {booking.session.status}
                                </span>
                                {booking.attendance_status && (
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    booking.attendance_status === 'attended' ? 'bg-blue-500/20 text-blue-400' :
                                    booking.attendance_status === 'no_show' ? 'bg-orange-500/20 text-orange-400' :
                                    'bg-slate-700 text-slate-400'
                                  }`}>
                                    {booking.attendance_status}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Form Content Column */}
                  <div className={selectedExistingDelegateId ? "col-span-2 grid grid-cols-2 gap-4" : "col-span-2 grid grid-cols-2 gap-4"}>
                  <div className="col-span-2 relative">
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={newDelegateData.delegate_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewDelegateData({ ...newDelegateData, delegate_name: value });
                        setSelectedExistingDelegateId(null);
                        setDelegateBookingHistory([]);
                        searchDelegatesByName(value);
                      }}
                      onFocus={() => {
                        if (newDelegateData.delegate_name.length >= 2 && delegateSuggestions.length > 0) {
                          setShowDelegateSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowDelegateSuggestions(false), 200);
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                      placeholder="Full name"
                      required
                    />

                    {/* Autocomplete Suggestions */}
                    {showDelegateSuggestions && delegateSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg max-h-60 overflow-y-auto">
                        {delegateSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => handleSelectExistingDelegate(suggestion)}
                            className="w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors flex justify-between items-center"
                          >
                            <span className="font-medium">{suggestion.delegate_name}</span>
                            <span className="text-sm text-slate-400">{suggestion.delegate_email}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedExistingDelegateId && (
                      <p className="text-xs text-blue-400 mt-1">
                        Using existing delegate - booking will be added to their profile
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newDelegateData.delegate_email}
                      onChange={(e) => setNewDelegateData({ ...newDelegateData, delegate_email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                      placeholder="email@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={newDelegateData.delegate_phone}
                      onChange={(e) => setNewDelegateData({ ...newDelegateData, delegate_phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                      placeholder="Phone number"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={newDelegateData.delegate_company}
                      onChange={(e) => setNewDelegateData({ ...newDelegateData, delegate_company: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                      placeholder="Company name"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                      Dietary Requirements
                    </label>
                    <textarea
                      value={newDelegateData.dietary_requirements}
                      onChange={(e) => setNewDelegateData({ ...newDelegateData, dietary_requirements: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                      rows={2}
                      placeholder="Any dietary requirements..."
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                      Special Requirements
                    </label>
                    <textarea
                      value={newDelegateData.special_requirements}
                      onChange={(e) => setNewDelegateData({ ...newDelegateData, special_requirements: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                      rows={2}
                      placeholder="Any special needs or accessibility requirements..."
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={newDelegateData.notes}
                      onChange={(e) => setNewDelegateData({ ...newDelegateData, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                      rows={3}
                      placeholder="Internal notes..."
                    />
                  </div>
                  </div>
                </div>
              ) : (
                <div className={selectedExistingDelegateId ? "grid grid-cols-3 gap-6" : ""}>
                  {/* Booking History Column - Only shown for existing delegates */}
                  {selectedExistingDelegateId && (
                    <div className="col-span-1 border-r border-slate-700 pr-6">
                      <h3 className="text-lg font-semibold mb-4">Booking History</h3>
                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {delegateBookingHistory.length === 0 ? (
                          <p className="text-sm text-slate-400">No previous bookings</p>
                        ) : (
                          delegateBookingHistory.map((booking: any) => (
                            <div
                              key={booking.id}
                              className="p-3 bg-slate-800 rounded border border-slate-700"
                            >
                              <div className="font-medium text-sm mb-1">
                                {decodeHtmlEntities(booking.session.event_title)}
                              </div>
                              {booking.session.event_subtitle && (
                                <div className="text-xs text-slate-400 mb-2">
                                  {decodeHtmlEntities(booking.session.event_subtitle)}
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(booking.session.session_date)} at {formatTime(booking.session.start_time)}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                <MapPin className="w-3 h-3" />
                                {booking.session.is_online ? (
                                  <span className="flex items-center gap-1">
                                    <Video className="w-3 h-3" />
                                    Online
                                  </span>
                                ) : booking.session.venues ? (
                                  `${booking.session.venues.name}, ${booking.session.venues.town}`
                                ) : (
                                  'Location TBC'
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  booking.session.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                  booking.session.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                  'bg-slate-700 text-slate-400'
                                }`}>
                                  {booking.session.status}
                                </span>
                                {booking.attendance_status && (
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    booking.attendance_status === 'attended' ? 'bg-blue-500/20 text-blue-400' :
                                    booking.attendance_status === 'no_show' ? 'bg-orange-500/20 text-orange-400' :
                                    'bg-slate-700 text-slate-400'
                                  }`}>
                                    {booking.attendance_status}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Session Selection Column */}
                  <div className={selectedExistingDelegateId ? "col-span-2" : ""}>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">
                          Select the sessions you want to book {newDelegateData.delegate_name} for:
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {selectedSessions.size} session(s) selected
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {availableSessionsForBooking.map((session) => {
                        const isSelected = selectedSessions.has(session.id);
                        const delegateCount = sessionDelegates[session.id]?.length || 0;
                        const isFull = delegateCount >= session.capacity_limit;
                        const isOverbooked = delegateCount > session.capacity_limit;
                        const capacityColor = getCapacityColor(delegateCount, session.capacity_limit);

                        return (
                          <div
                            key={session.id}
                            onClick={() => toggleSessionSelection(session.id)}
                            className={`p-4 rounded-lg border transition-all cursor-pointer ${
                              isSelected
                                ? isFull
                                  ? 'bg-red-500/20 border-red-500'
                                  : 'bg-blue-500/10 border-blue-500'
                                : isFull
                                ? 'bg-red-500/10 border-red-500/50 hover:border-red-500'
                                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected
                                  ? isFull
                                    ? 'bg-red-500 border-red-500'
                                    : 'bg-blue-500 border-blue-500'
                                  : isFull
                                  ? 'border-red-500/50'
                                  : 'border-slate-600'
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>

                              <div className="flex-1">
                                <div className={`font-medium ${isFull ? 'text-red-300' : ''}`}>
                                  {session.event_title}
                                  {isFull && <span className="ml-2 text-xs text-red-400 font-normal">(Overbook)</span>}
                                </div>
                                {session.event_subtitle && (
                                  <div className="text-xs text-slate-400 mt-1">{decodeHtmlEntities(session.event_subtitle)}</div>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(session.session_date)}
                                  </div>
                                  {session.start_time && (
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatTime(session.start_time)} - {formatTime(session.end_time || '')}
                                    </div>
                                  )}
                                  {session.is_online ? (
                                    <div className="flex items-center gap-1">
                                      <Video className="w-3 h-3" />
                                      Online
                                    </div>
                                  ) : session.venue && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {session.venue.name}
                                    </div>
                                  )}
                                  <div className={`flex items-center gap-1 ${isFull ? 'text-red-400' : capacityColor}`}>
                                    <Users className="w-3 h-3" />
                                    {delegateCount} / {session.capacity_limit}
                                    {isFull && <span className="ml-1 font-semibold">FULL</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {availableSessionsForBooking.length === 0 && (
                      <div className="text-center py-12 text-slate-400">
                        No upcoming sessions available
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex items-center justify-end gap-3 rounded-b-lg">
              {addDelegateStep === 1 ? (
                <>
                  <button
                    onClick={() => {
                      setShowAddDelegateModal(false);
                      setAddDelegateStep(1);
                      setSelectedSessions(new Set());
                      setDelegateSuggestions([]);
                      setShowDelegateSuggestions(false);
                      setSelectedExistingDelegateId(null);
                      setDelegateBookingHistory([]);
                      setNewDelegateData({
                        delegate_name: '',
                        delegate_email: '',
                        delegate_phone: '',
                        delegate_company: '',
                        dietary_requirements: '',
                        special_requirements: '',
                        notes: '',
                      });
                    }}
                    className="px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNextStep}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
                  >
                    Next: Select Sessions
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleBackStep}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={handleConfirmBooking}
                    disabled={selectedSessions.size === 0}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                      selectedSessions.size === 0
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    <UserCog className="w-4 h-4" />
                    Confirm Booking ({selectedSessions.size})
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resend Booking Modal */}
      {showResendModal && resendDelegate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-semibold">Resend Booking Details</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {resendDelegate.delegate_name} has {resendUpcomingBookings.length} upcoming booking(s)
                </p>
              </div>
              <button
                onClick={() => setShowResendModal(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-400 mb-4">
                Would you like to send booking details for just this session or all upcoming sessions?
              </p>

              <div className="space-y-3">
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="font-medium mb-2">This Session Only</div>
                  <div className="text-sm text-slate-400">
                    <div>{resendCurrentSession.event_title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(resendCurrentSession.session_date)}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="font-medium mb-2">All Upcoming Sessions ({resendUpcomingBookings.length})</div>
                  <div className="text-xs text-slate-400 space-y-1 max-h-32 overflow-y-auto">
                    {resendUpcomingBookings.map((booking: any) => (
                      <div key={booking.id} className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {formatDate(booking.session.session_date)} - {booking.session.event_title}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex items-center justify-end gap-3 rounded-b-lg">
              <button
                onClick={() => setShowResendModal(false)}
                className="px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResendSingle}
                disabled={resendingSingle}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendingSingle ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    This Session Only
                  </>
                )}
              </button>
              <button
                onClick={handleResendAll}
                disabled={resendingAll}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendingAll ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    All Sessions ({resendUpcomingBookings.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trainer Assignment Modal */}
      {showTrainerAssignModal && sessionToAssignTrainer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-semibold">Assign Trainer</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {sessionToAssignTrainer.event_title}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatDate(sessionToAssignTrainer.session_date)} at {formatTime(sessionToAssignTrainer.start_time)}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTrainerAssignModal(false);
                  setSessionToAssignTrainer(null);
                }}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {availableTrainers.length === 0 ? (
                <div className="text-center py-8">
                  <UserCog className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No trainers available for this course type</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-400 mb-4">
                    Select a trainer qualified to deliver this course:
                  </p>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {availableTrainers.map((trainer) => (
                      <button
                        key={trainer.id}
                        onClick={() => handleAssignTrainer(trainer.id)}
                        disabled={assigningTrainer}
                        className={`w-full text-left p-4 rounded-lg border transition-all ${
                          sessionToAssignTrainer.trainer_id === trainer.id
                            ? 'bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-500/50'
                            : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div className="flex items-center gap-3">
                          <UserCog className="w-5 h-5 text-slate-400" />
                          <div className="flex-1">
                            <div className="font-medium">{trainer.name}</div>
                            {trainer.email && (
                              <div className="text-xs text-slate-400 mt-1">{trainer.email}</div>
                            )}
                          </div>
                          {sessionToAssignTrainer.trainer_id === trainer.id && (
                            <div className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                              Current
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex items-center justify-end gap-3 rounded-b-lg">
              <button
                onClick={() => {
                  setShowTrainerAssignModal(false);
                  setSessionToAssignTrainer(null);
                }}
                className="px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              {sessionToAssignTrainer.trainer_id && (
                <button
                  onClick={handleUnassignTrainer}
                  disabled={assigningTrainer}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigningTrainer ? 'Unassigning...' : 'Unassign Trainer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
