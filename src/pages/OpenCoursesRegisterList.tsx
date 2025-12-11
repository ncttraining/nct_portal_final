import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  Calendar,
  MapPin,
  User,
  Users,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Upload,
  ShieldCheck,
  X,
  Loader2,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notification from '../components/Notification';
import { useAuth } from '../contexts/AuthContext';
import {
  OpenCourseSessionWithDetails,
  getSessionsForRegisters,
  getVenues,
  getTrainers,
  getCourseTypes,
  Venue,
  CourseType,
  isCPCCourse,
} from '../lib/open-courses';
import { supabase } from '../lib/supabase';

interface OpenCoursesRegisterListProps {
  currentPage: string;
  onNavigate: (page: string, data?: any) => void;
}

interface DelegateCounts {
  [sessionId: string]: {
    total: number;
    present: number;
    idsChecked: number;
    dvsaUploaded: number;
  };
}

// Helper to format date as YYYY-MM-DD
function formatDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Get default date range (today to 6 days from now = 7 days)
function getDefaultDateRange(): { start: string; end: string } {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 6);
  return {
    start: formatDateString(today),
    end: formatDateString(endDate),
  };
}

export default function OpenCoursesRegisterList({
  currentPage,
  onNavigate,
}: OpenCoursesRegisterListProps) {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<OpenCourseSessionWithDetails[]>([]);
  const [delegateCounts, setDelegateCounts] = useState<DelegateCounts>({});
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Date range state - default to 7 days from today
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [weekStart, setWeekStart] = useState<Date>(() => new Date());

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState('');
  const [selectedCourseType, setSelectedCourseType] = useState('');

  // Update date range when weekStart changes
  useEffect(() => {
    const start = new Date(weekStart);
    const end = new Date(weekStart);
    end.setDate(start.getDate() + 6);
    setStartDate(formatDateString(start));
    setEndDate(formatDateString(end));
  }, [weekStart]);

  // Navigation functions
  const goToPreviousWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
  };

  const goToToday = () => {
    setWeekStart(new Date());
  };

  // Format the date range for display
  const dateRangeDisplay = useMemo(() => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const startStr = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const endStr = end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }, [startDate, endDate]);

  // Filter options
  const [venues, setVenues] = useState<Venue[]>([]);
  const [trainers, setTrainers] = useState<Array<{ id: string; name: string }>>([]);
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);

  const isAdmin = profile?.role === 'admin' || profile?.super_admin;

  // Load filter options
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [venuesData, trainersData, courseTypesData] = await Promise.all([
          getVenues(),
          getTrainers(),
          getCourseTypes(),
        ]);
        setVenues(venuesData);
        setTrainers(trainersData);
        setCourseTypes(courseTypesData);
      } catch (error) {
        console.error('Error loading filter options:', error);
      }
    }
    loadFilterOptions();
  }, []);

  // Load sessions with filters
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      let filters: any = {
        searchTerm: searchTerm || undefined,
      };

      // Always apply date range filter for performance
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (selectedVenue) filters.venueId = selectedVenue;
      if (selectedCourseType) filters.courseTypeId = selectedCourseType;

      // For trainers, filter by their assigned sessions if not admin
      if (!isAdmin && profile?.trainer_id) {
        filters.trainerId = profile.trainer_id;
      } else if (selectedTrainer) {
        filters.trainerId = selectedTrainer;
      }

      const sessionsData = await getSessionsForRegisters(filters);
      setSessions(sessionsData);

      // Batch load delegate counts for all sessions in one query
      if (sessionsData.length > 0) {
        const sessionIds = sessionsData.map(s => s.id);
        const { data: allDelegates, error } = await supabase
          .from('open_course_delegates')
          .select('session_id, attendance_detail, id_checked, dvsa_uploaded, attendance_status')
          .in('session_id', sessionIds)
          .or('attendance_status.neq.cancelled,attendance_status.is.null');

        if (!error && allDelegates) {
          const counts: DelegateCounts = {};
          const presentStatuses = ['attended', 'late', 'left_early'];

          // Initialize counts for all sessions
          for (const session of sessionsData) {
            counts[session.id] = { total: 0, present: 0, idsChecked: 0, dvsaUploaded: 0 };
          }

          // Aggregate counts from all delegates
          for (const delegate of allDelegates) {
            const sessionCounts = counts[delegate.session_id];
            if (sessionCounts) {
              sessionCounts.total++;
              if (delegate.attendance_detail && presentStatuses.includes(delegate.attendance_detail)) {
                sessionCounts.present++;
              }
              if (delegate.id_checked) {
                sessionCounts.idsChecked++;
              }
              if (delegate.dvsa_uploaded) {
                sessionCounts.dvsaUploaded++;
              }
            }
          }
          setDelegateCounts(counts);
        } else {
          setDelegateCounts({});
        }
      } else {
        setDelegateCounts({});
      }
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to load sessions',
      });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, startDate, endDate, selectedVenue, selectedTrainer, selectedCourseType, isAdmin, profile?.trainer_id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleRowClick = (session: OpenCourseSessionWithDetails) => {
    // Navigate to trainer or admin view based on role
    if (isAdmin) {
      onNavigate('open-courses-register-admin', { sessionId: session.id });
    } else {
      onNavigate('open-courses-register-trainer', { sessionId: session.id });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setWeekStart(new Date()); // Reset to today
    setSelectedVenue('');
    setSelectedTrainer('');
    setSelectedCourseType('');
  };

  // Only count non-date filters as "active" since date range is always set
  const hasActiveFilters = searchTerm || selectedVenue || selectedTrainer || selectedCourseType;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader
        currentPage={currentPage}
        onNavigate={onNavigate}
        onEditProfile={() => {}}
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-semibold">Open Courses Registers</h1>
              <p className="text-slate-400 text-sm">
                {isAdmin
                  ? 'Manage attendance and compliance for all sessions'
                  : 'Manage attendance and compliance for your sessions'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6 bg-slate-900 border border-slate-800 rounded-lg p-3">
          <button
            onClick={goToPreviousWeek}
            className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium">{dateRangeDisplay}</span>
            </div>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors"
            >
              Today
            </button>
          </div>

          <button
            onClick={goToNextWeek}
            className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-sm"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by course name, trainer, venue, or JAUPT code..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Course Type</label>
                <select
                  value={selectedCourseType}
                  onChange={(e) => setSelectedCourseType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Course Types</option>
                  {courseTypes.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.name} {ct.jaupt_code ? `(${ct.jaupt_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Venue</label>
                <select
                  value={selectedVenue}
                  onChange={(e) => setSelectedVenue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Venues</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Trainer</label>
                  <select
                    value={selectedTrainer}
                    onChange={(e) => setSelectedTrainer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Trainers</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {hasActiveFilters && (
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-sm"
                  >
                    <X className="w-4 h-4" />
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sessions Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">
                {hasActiveFilters
                  ? 'No sessions match your filters'
                  : 'No sessions found'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Course
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Venue
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Trainer
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Delegates
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide w-10">
                    {/* Action */}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const counts = delegateCounts[session.id] || {
                    total: 0,
                    present: 0,
                    idsChecked: 0,
                    dvsaUploaded: 0,
                  };
                  const isCPC = isCPCCourse(session);
                  const allIdsChecked = counts.total > 0 && counts.idsChecked === counts.total;
                  const allPresent = counts.total > 0 && counts.present === counts.total;
                  const allDvsaUploaded = isCPC && counts.total > 0 && counts.dvsaUploaded === counts.total;

                  return (
                    <tr
                      key={session.id}
                      onClick={() => handleRowClick(session)}
                      className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-white">
                            {formatDate(session.session_date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-sm text-white font-medium">
                            {session.event_title || 'Untitled'}
                          </p>
                          {session.course_type?.jaupt_code && (
                            <p className="text-xs text-blue-400 font-mono">
                              {session.course_type.jaupt_code}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-300">
                            {session.is_online
                              ? 'ONLINE'
                              : session.venue?.name || 'TBC'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-300">
                            {session.trainer?.name || 'Unassigned'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Users className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-white">
                            <span className="text-green-400">{counts.present}</span>
                            <span className="text-slate-500"> / </span>
                            {counts.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {/* Declaration Status */}
                          <span
                            title={
                              session.trainer_declaration_signed
                                ? 'Declaration signed'
                                : 'Declaration not signed'
                            }
                            className={
                              session.trainer_declaration_signed
                                ? 'text-green-400'
                                : 'text-slate-500'
                            }
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </span>

                          {/* ID Check Status */}
                          <span
                            title={
                              allIdsChecked
                                ? 'All IDs checked'
                                : `${counts.idsChecked}/${counts.total} IDs checked`
                            }
                            className={allIdsChecked ? 'text-green-400' : 'text-slate-500'}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </span>

                          {/* DVSA Upload Status (CPC only) */}
                          {isCPC && (
                            <span
                              title={
                                allDvsaUploaded
                                  ? 'All uploaded to DVSA'
                                  : `${counts.dvsaUploaded}/${counts.total} uploaded`
                              }
                              className={allDvsaUploaded ? 'text-green-400' : 'text-slate-500'}
                            >
                              <Upload className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <ChevronRight className="w-5 h-5 text-slate-500" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Results Count */}
        {!loading && sessions.length > 0 && (
          <div className="mt-4 text-sm text-slate-400 text-center">
            Showing {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </div>
        )}
      </main>

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
