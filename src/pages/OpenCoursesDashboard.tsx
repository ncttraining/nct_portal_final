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
  Plus,
  Calendar,
  Users,
  MapPin,
  Clock,
  Copy,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Video,
  X,
  Save,
  UserCog,
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
  getDelegates,
  transferDelegate,
  getVenues,
  getActiveVenues,
  getWeekDates,
  formatDate,
  formatTime,
  getCapacityColor,
  getCapacityBgColor,
  OpenCourseSession,
  OpenCourseSessionWithDetails,
  OpenCourseDelegate,
  OpenCourseDelegateWithDetails,
  Venue,
} from '../lib/open-courses';
import { supabase } from '../lib/supabase';

interface PageProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface SessionFormData {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  venue_id: string;
  trainer_id: string;
  capacity: number;
  course_type_id: string;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  is_virtual: boolean;
  meeting_url: string;
  meeting_id: string;
  meeting_password: string;
  price: number;
  currency: string;
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
  const [sessionDelegates, setSessionDelegates] = useState<Record<string, OpenCourseDelegateWithDetails[]>>({});
  const [venues, setVenues] = useState<Venue[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [courseTypes, setCourseTypes] = useState<any[]>([]);

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<OpenCourseSessionWithDetails | null>(null);
  const [sessionFormData, setSessionFormData] = useState<SessionFormData>(getEmptyFormData());

  const [draggedDelegate, setDraggedDelegate] = useState<DraggedDelegate | null>(null);
  const [dragOverSessionId, setDragOverSessionId] = useState<string | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  function getEmptyFormData(): SessionFormData {
    return {
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      start_time: '09:00',
      end_time: '17:00',
      venue_id: '',
      trainer_id: '',
      capacity: 12,
      course_type_id: '',
      status: 'published',
      is_virtual: false,
      meeting_url: '',
      meeting_id: '',
      meeting_password: '',
      price: 0,
      currency: 'GBP',
      notes: '',
    };
  }

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  async function loadData() {
    try {
      setLoading(true);

      // Load sessions for the week
      const weekStart = currentWeekStart.toISOString().split('T')[0];
      const sessionsData = await getSessionsForWeek(weekStart);
      setSessions(sessionsData);

      // Load delegates for each session
      const delegatesMap: Record<string, OpenCourseDelegateWithDetails[]> = {};
      await Promise.all(
        sessionsData.map(async (session) => {
          const delegates = await getDelegates({ sessionId: session.id });
          delegatesMap[session.id] = delegates.filter(d => d.attendance_status !== 'cancelled');
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

  function goToToday() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(today.setDate(diff)));
  }

  function getWeekDateStrings(): string[] {
    return getWeekDates(currentWeekStart).map(date => date.toISOString().split('T')[0]);
  }

  function getSessionsForDate(date: string): OpenCourseSessionWithDetails[] {
    return sessions.filter(session => session.start_date === date);
  }

  function handleCreateSession() {
    setEditingSession(null);
    setSessionFormData(getEmptyFormData());
    setShowSessionModal(true);
  }

  function handleEditSession(session: OpenCourseSessionWithDetails) {
    setEditingSession(session);
    setSessionFormData({
      title: session.title,
      description: session.description || '',
      start_date: session.start_date,
      end_date: session.end_date,
      start_time: session.start_time || '09:00',
      end_time: session.end_time || '17:00',
      venue_id: session.venue_id || '',
      trainer_id: session.trainer_id || '',
      capacity: session.capacity,
      course_type_id: session.course_type_id || '',
      status: session.status,
      is_virtual: session.is_virtual,
      meeting_url: session.meeting_url || '',
      meeting_id: session.meeting_id || '',
      meeting_password: session.meeting_password || '',
      price: session.price || 0,
      currency: session.currency,
      notes: session.notes || '',
    });
    setShowSessionModal(true);
  }

  async function handleDuplicateSession(session: OpenCourseSessionWithDetails) {
    try {
      // Calculate next week's date
      const nextWeekDate = new Date(session.start_date);
      nextWeekDate.setDate(nextWeekDate.getDate() + 7);
      const newStartDate = nextWeekDate.toISOString().split('T')[0];

      const nextWeekEndDate = new Date(session.end_date);
      nextWeekEndDate.setDate(nextWeekEndDate.getDate() + 7);
      const newEndDate = nextWeekEndDate.toISOString().split('T')[0];

      await duplicateSession(session.id, newStartDate, newEndDate);

      setNotification({
        type: 'success',
        message: `Session duplicated successfully for ${formatDate(newStartDate)}`,
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

    if (!confirm(`Are you sure you want to delete "${session.title}"?`)) {
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
      if (!sessionFormData.title || !sessionFormData.start_date) {
        setNotification({
          type: 'error',
          message: 'Please fill in required fields (Title, Start Date)',
        });
        return;
      }

      const sessionData = {
        ...sessionFormData,
        description: sessionFormData.description || null,
        start_time: sessionFormData.start_time || null,
        end_time: sessionFormData.end_time || null,
        venue_id: sessionFormData.venue_id || null,
        trainer_id: sessionFormData.trainer_id || null,
        course_type_id: sessionFormData.course_type_id || null,
        meeting_url: sessionFormData.is_virtual ? sessionFormData.meeting_url || null : null,
        meeting_id: sessionFormData.is_virtual ? sessionFormData.meeting_id || null : null,
        meeting_password: sessionFormData.is_virtual ? sessionFormData.meeting_password || null : null,
        notes: sessionFormData.notes || null,
      };

      if (editingSession) {
        await updateSession(editingSession.id, sessionData);
        setNotification({
          type: 'success',
          message: 'Session updated successfully',
        });
      } else {
        await createSession(sessionData);
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

    try {
      await transferDelegate(draggedDelegate.delegate.id, toSessionId);

      setNotification({
        type: 'success',
        message: `Delegate ${draggedDelegate.delegate.first_name} ${draggedDelegate.delegate.last_name} transferred successfully`,
      });

      loadData();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to transfer delegate',
      });
    } finally {
      setDraggedDelegate(null);
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

  const weekDates = getWeekDateStrings();
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateWeek('prev')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Previous Week"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-lg font-semibold">
                Week of {formatDate(currentWeekStart)}
              </div>

              <button
                onClick={() => navigateWeek('next')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Next Week"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={goToToday}
                className="px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors text-sm"
              >
                Today
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

        {/* Week Grid */}
        <div className="grid grid-cols-7 gap-4">
          {weekDates.map((date, index) => {
            const daySessions = getSessionsForDate(date);
            const isToday = date === new Date().toISOString().split('T')[0];

            return (
              <div
                key={date}
                className={`bg-slate-900 border rounded-lg overflow-hidden ${
                  isToday ? 'border-blue-500' : 'border-slate-800'
                }`}
              >
                {/* Day Header */}
                <div className={`p-3 border-b ${isToday ? 'bg-blue-500/10 border-blue-500/20' : 'border-slate-800'}`}>
                  <div className="font-semibold text-sm">{weekDaysLabels[index]}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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
                      const capacityColor = getCapacityColor(session.available_spaces, session.capacity);
                      const capacityBg = getCapacityBgColor(session.available_spaces, session.capacity);
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
                              <div className="font-semibold truncate" title={session.title}>
                                {session.title}
                              </div>
                              {session.course_type && (
                                <div className="text-slate-400 text-[10px] truncate">
                                  {session.course_type.code}
                                </div>
                              )}
                            </div>
                            {session.is_virtual && (
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

                            {session.venue && (
                              <div className="flex items-center gap-1 text-slate-400">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate" title={session.venue.name}>
                                  {session.venue.town || session.venue.name}
                                </span>
                              </div>
                            )}

                            {session.trainer && (
                              <div className="flex items-center gap-1 text-slate-400">
                                <UserCog className="w-3 h-3" />
                                <span className="truncate" title={session.trainer.name}>
                                  {session.trainer.name}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-1">
                              <Users className={`w-3 h-3 ${capacityColor}`} />
                              <span className={capacityColor}>
                                {delegateCount} / {session.capacity}
                              </span>
                              {session.available_spaces === 0 && (
                                <span className="ml-1 text-red-400 font-semibold">FULL</span>
                              )}
                            </div>
                          </div>

                          {/* Delegates */}
                          {delegates.length > 0 && (
                            <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
                              {delegates.map((delegate) => (
                                <div
                                  key={delegate.id}
                                  draggable
                                  onDragStart={() => handleDragStart(delegate, session.id)}
                                  className="bg-slate-800/50 rounded px-2 py-1 cursor-move hover:bg-slate-800 transition-colors"
                                  title={`Drag to transfer delegate`}
                                >
                                  <div className="text-[10px] font-medium truncate">
                                    {delegate.first_name} {delegate.last_name}
                                  </div>
                                  {delegate.company_name && (
                                    <div className="text-[9px] text-slate-500 truncate">
                                      {delegate.company_name}
                                    </div>
                                  )}
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
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex items-start justify-between">
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

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={sessionFormData.title}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  placeholder="e.g., Forklift Training - Counterbalance"
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
                  value={sessionFormData.description}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={sessionFormData.start_date}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={sessionFormData.end_date}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  />
                </div>
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

              {/* Virtual Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_virtual"
                  checked={sessionFormData.is_virtual}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, is_virtual: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_virtual" className="text-sm cursor-pointer">
                  Virtual/Online Session
                </label>
              </div>

              {/* Venue (if not virtual) */}
              {!sessionFormData.is_virtual && (
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

              {/* Meeting Details (if virtual) */}
              {sessionFormData.is_virtual && (
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
                  value={sessionFormData.capacity}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, capacity: parseInt(e.target.value) || 12 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                />
              </div>

              {/* Price */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Price
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
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                    Currency
                  </label>
                  <select
                    value={sessionFormData.currency}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  >
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={sessionFormData.status}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
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

            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSessionModal(false)}
                className="px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSession}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
              >
                <Save className="w-4 h-4" />
                {editingSession ? 'Update Session' : 'Create Session'}
              </button>
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
