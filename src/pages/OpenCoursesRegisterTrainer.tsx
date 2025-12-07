import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  User,
  Save,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notification from '../components/Notification';
import { RegisterHeader, TrainerDeclaration, AttendanceIcons } from '../components/open-courses';
import { useAuth } from '../contexts/AuthContext';
import {
  OpenCourseSessionWithDetails,
  OpenCourseDelegateWithDetails,
  getSessionForRegister,
  getDelegatesForRegister,
  updateDelegateFields,
  signTrainerDeclaration,
  updateSessionSchedule,
  isCPCCourse,
  getDelegateRowColor,
  AttendanceDetail,
  IdType,
  LicenceCategory,
} from '../lib/open-courses';

interface OpenCoursesRegisterTrainerProps {
  currentPage: string;
  onNavigate: (page: string, data?: any) => void;
  sessionId?: string;
}

const LICENCE_CATEGORIES: LicenceCategory[] = ['C', 'CE', 'C1', 'C1E', 'D', 'DE', 'D1', 'D1E', 'C+E', 'D+E'];
const ID_TYPES: { value: IdType; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'DL', label: 'Driving Licence' },
  { value: 'DQC', label: 'DQC Card' },
  { value: 'Digitaco', label: 'Digitaco' },
  { value: 'Passport', label: 'Passport' },
  { value: 'Other', label: 'Other' },
];

export default function OpenCoursesRegisterTrainer({
  currentPage,
  onNavigate,
  sessionId,
}: OpenCoursesRegisterTrainerProps) {
  const { profile } = useAuth();
  const [session, setSession] = useState<OpenCourseSessionWithDetails | null>(null);
  const [delegates, setDelegates] = useState<OpenCourseDelegateWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedDelegateId, setExpandedDelegateId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Debounce timers
  const saveTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const userId = profile?.id;
  const isAdmin = profile?.role === 'admin' || profile?.super_admin;

  // Load session and delegates
  const loadData = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const [sessionData, delegatesData] = await Promise.all([
        getSessionForRegister(sessionId),
        getDelegatesForRegister(sessionId),
      ]);

      if (!sessionData) {
        setNotification({ type: 'error', message: 'Session not found' });
        return;
      }

      setSession(sessionData);
      setDelegates(delegatesData);
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to load session data',
      });
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounced save for delegate fields
  const debouncedSave = useCallback(
    (delegateId: string, updates: any) => {
      // Clear existing timer
      if (saveTimers.current[delegateId]) {
        clearTimeout(saveTimers.current[delegateId]);
      }

      // Set new timer
      saveTimers.current[delegateId] = setTimeout(async () => {
        try {
          setSaving(true);
          await updateDelegateFields(delegateId, updates, userId);
        } catch (error: any) {
          setNotification({
            type: 'error',
            message: error.message || 'Failed to save changes',
          });
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [userId]
  );

  // Update delegate locally and trigger save
  const updateDelegate = useCallback(
    (delegateId: string, field: string, value: any) => {
      setDelegates((prev) =>
        prev.map((d) =>
          d.id === delegateId ? { ...d, [field]: value } : d
        )
      );

      debouncedSave(delegateId, { [field]: value });
    },
    [debouncedSave]
  );

  // Handle attendance change
  const handleAttendanceChange = useCallback(
    (delegateId: string, attendance: AttendanceDetail) => {
      updateDelegate(delegateId, 'attendance_detail', attendance);
    },
    [updateDelegate]
  );

  // Handle ID checked toggle
  const handleIdCheckedToggle = useCallback(
    (delegateId: string, currentValue: boolean) => {
      updateDelegate(delegateId, 'id_checked', !currentValue);
    },
    [updateDelegate]
  );

  // Handle trainer declaration toggle
  const handleDeclarationToggle = async (signed: boolean) => {
    if (!session || !userId) return;

    try {
      setSaving(true);
      await signTrainerDeclaration(session.id, signed, userId);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              trainer_declaration_signed: signed,
              trainer_declaration_at: signed ? new Date().toISOString() : undefined,
              trainer_declaration_by: signed ? userId : undefined,
            }
          : null
      );
      setNotification({
        type: 'success',
        message: signed ? 'Declaration signed' : 'Declaration unsigned',
      });
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to update declaration',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle schedule updates
  const handleScheduleUpdate = async (
    field: 'start_time' | 'end_time' | 'break_time',
    value: string
  ) => {
    if (!session) return;

    try {
      await updateSessionSchedule(session.id, { [field]: value });
      setSession((prev) => (prev ? { ...prev, [field]: value } : null));
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to update schedule',
      });
    }
  };

  const isCPC = session ? isCPCCourse(session) : false;

  // Calculate stats
  const presentCount = delegates.filter((d) =>
    ['attended', 'late', 'left_early'].includes(d.attendance_detail || '')
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <PageHeader currentPage={currentPage} onNavigate={onNavigate} onEditProfile={() => {}} />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Session Not Found</h1>
            <p className="text-slate-400 mb-4">
              The requested session could not be found.
            </p>
            <button
              onClick={() => onNavigate('open-courses-registers')}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
            >
              Back to Registers
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} onEditProfile={() => {}} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Back Button */}
        <button
          onClick={() => onNavigate('open-courses-registers')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Registers
        </button>

        {/* Saving Indicator */}
        {saving && (
          <div className="fixed top-4 right-4 flex items-center gap-2 px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm z-50">
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </div>
        )}

        {/* Register Header */}
        <RegisterHeader
          session={session}
          editable={true}
          onStartTimeChange={(time) => handleScheduleUpdate('start_time', time)}
          onEndTimeChange={(time) => handleScheduleUpdate('end_time', time)}
          onBreakTimeChange={(time) => handleScheduleUpdate('break_time', time)}
          showStats={true}
          presentCount={presentCount}
          totalCount={delegates.length}
        />

        {/* Trainer Declaration */}
        <div className="mb-6">
          <TrainerDeclaration
            signed={session.trainer_declaration_signed}
            onToggle={handleDeclarationToggle}
            signedAt={session.trainer_declaration_at}
          />
        </div>

        {/* Delegates Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Learner
                  </th>
                  {isCPC && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Driver Number
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Categories
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    ID Type
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Attendance
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    ID Checked
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide w-10">
                    {/* Expand */}
                  </th>
                </tr>
              </thead>
              <tbody>
                {delegates.map((delegate) => {
                  const rowColor = getDelegateRowColor(delegate);
                  const isExpanded = expandedDelegateId === delegate.id;

                  return (
                    <>
                      <tr
                        key={delegate.id}
                        className={`border-b border-slate-800 transition-colors ${rowColor}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">
                                {delegate.delegate_name}
                              </p>
                              {delegate.delegate_company && (
                                <p className="text-xs text-slate-400">
                                  {delegate.delegate_company}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {isCPC && (
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={delegate.driver_number || ''}
                              onChange={(e) =>
                                updateDelegate(delegate.id, 'driver_number', e.target.value)
                              }
                              placeholder="Enter driver number"
                              className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                          </td>
                        )}

                        <td className="px-4 py-3">
                          <select
                            value={delegate.licence_category || ''}
                            onChange={(e) =>
                              updateDelegate(
                                delegate.id,
                                'licence_category',
                                e.target.value || null
                              )
                            }
                            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="">--</option>
                            {LICENCE_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          <select
                            value={delegate.id_type || ''}
                            onChange={(e) =>
                              updateDelegate(delegate.id, 'id_type', e.target.value)
                            }
                            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="">--</option>
                            {ID_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <AttendanceIcons
                              value={delegate.attendance_detail}
                              onChange={(value) =>
                                handleAttendanceChange(delegate.id, value)
                              }
                            />
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <button
                              onClick={() =>
                                handleIdCheckedToggle(delegate.id, delegate.id_checked)
                              }
                              className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                delegate.id_checked
                                  ? 'bg-green-500 text-white'
                                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                              }`}
                            >
                              <Check className="w-5 h-5" />
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              setExpandedDelegateId(isExpanded ? null : delegate.id)
                            }
                            className="p-1 hover:bg-slate-700 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Comments Row */}
                      {isExpanded && (
                        <tr key={`${delegate.id}-comments`} className={rowColor}>
                          <td
                            colSpan={isCPC ? 7 : 6}
                            className="px-4 py-3 border-b border-slate-800"
                          >
                            <div className="pl-11">
                              <label className="block text-xs text-slate-400 mb-1">
                                Additional Comments
                              </label>
                              <textarea
                                value={delegate.additional_comments || ''}
                                onChange={(e) =>
                                  updateDelegate(
                                    delegate.id,
                                    'additional_comments',
                                    e.target.value
                                  )
                                }
                                placeholder="Add any notes about this delegate..."
                                rows={2}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {delegates.length === 0 && (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No delegates registered for this session</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500/10 rounded" />
            <span>Attended + ID Checked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500/10 rounded" />
            <span>Attended, ID Not Checked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500/10 rounded" />
            <span>Absent</span>
          </div>
        </div>
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
