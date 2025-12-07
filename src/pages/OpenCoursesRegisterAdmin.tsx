import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  User,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Upload,
  FileText,
  Calendar,
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
  updateDelegateDVSAUpload,
  signTrainerDeclaration,
  updateSessionSchedule,
  getUserInitialsBatch,
  isCPCCourse,
  getDelegateRowColor,
  AttendanceDetail,
  IdType,
  LicenceCategory,
} from '../lib/open-courses';

interface OpenCoursesRegisterAdminProps {
  currentPage: string;
  onNavigate: (page: string, data?: any) => void;
  sessionId?: string;
}

const LICENCE_CATEGORIES: LicenceCategory[] = ['C', 'CE', 'C1', 'C1E', 'D', 'DE', 'D1', 'D1E', 'C+E', 'D+E'];
const ID_TYPES: { value: IdType; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'DL', label: 'DL' },
  { value: 'DQC', label: 'DQC' },
  { value: 'Digitaco', label: 'Digi' },
  { value: 'Passport', label: 'Pass' },
  { value: 'Other', label: 'Other' },
];

export default function OpenCoursesRegisterAdmin({
  currentPage,
  onNavigate,
  sessionId,
}: OpenCoursesRegisterAdminProps) {
  const { profile } = useAuth();
  const [session, setSession] = useState<OpenCourseSessionWithDetails | null>(null);
  const [delegates, setDelegates] = useState<OpenCourseDelegateWithDetails[]>([]);
  const [userInitials, setUserInitials] = useState<Record<string, string>>({});
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

      // Load user initials for attendance_marked_by
      const userIds = delegatesData
        .map((d) => d.attendance_marked_by)
        .filter((id): id is string => !!id);

      if (userIds.length > 0) {
        const initials = await getUserInitialsBatch(userIds);
        setUserInitials(initials);
      }
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
      setDelegates((prev) =>
        prev.map((d) =>
          d.id === delegateId
            ? { ...d, attendance_detail: attendance, attendance_marked_by: userId }
            : d
        )
      );

      debouncedSave(delegateId, { attendance_detail: attendance });

      // Update user initials if needed
      if (userId && !userInitials[userId]) {
        getUserInitialsBatch([userId]).then((initials) => {
          setUserInitials((prev) => ({ ...prev, ...initials }));
        });
      }
    },
    [debouncedSave, userId, userInitials]
  );

  // Handle ID checked toggle
  const handleIdCheckedToggle = useCallback(
    (delegateId: string, currentValue: boolean) => {
      updateDelegate(delegateId, 'id_checked', !currentValue);
    },
    [updateDelegate]
  );

  // Handle DVSA upload toggle
  const handleDVSAUploadToggle = async (delegateId: string, currentValue: boolean) => {
    if (!userId) return;

    try {
      setSaving(true);
      await updateDelegateDVSAUpload(delegateId, !currentValue, userId);
      setDelegates((prev) =>
        prev.map((d) =>
          d.id === delegateId
            ? {
                ...d,
                dvsa_uploaded: !currentValue,
                dvsa_uploaded_at: !currentValue ? new Date().toISOString() : undefined,
                dvsa_uploaded_by: !currentValue ? userId : undefined,
              }
            : d
        )
      );
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to update DVSA status',
      });
    } finally {
      setSaving(false);
    }
  };

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

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

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

        {/* Admin Title Bar */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-blue-400">
                CPC TRAINING REGISTER REVIEWER
              </h1>
              {session.course_type?.jaupt_code && (
                <p className="text-sm text-blue-300 font-mono mt-1">
                  {session.course_type.jaupt_code}
                </p>
              )}
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-white">{formatDate(session.session_date)}</span>
              </div>
              <div>
                <span className="text-slate-400">Present:</span>{' '}
                <span className="text-green-400 font-semibold">{presentCount}</span>
              </div>
              <div>
                <span className="text-slate-400">On Register:</span>{' '}
                <span className="text-white font-semibold">{delegates.length}</span>
              </div>
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-400 rounded cursor-not-allowed"
                title="Certificate export coming in Stage 4"
              >
                <FileText className="w-4 h-4" />
                Export Certs
              </button>
            </div>
          </div>
        </div>

        {/* Register Header */}
        <RegisterHeader
          session={session}
          editable={true}
          onStartTimeChange={(time) => handleScheduleUpdate('start_time', time)}
          onEndTimeChange={(time) => handleScheduleUpdate('end_time', time)}
          onBreakTimeChange={(time) => handleScheduleUpdate('break_time', time)}
        />

        {/* Trainer Declaration */}
        <div className="mb-6">
          <TrainerDeclaration
            signed={session.trainer_declaration_signed}
            onToggle={handleDeclarationToggle}
            signedAt={session.trainer_declaration_at}
          />
        </div>

        {/* Delegates Table - Admin View */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800/50">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Learner
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Driver Number
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Licence
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    ID Type
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    ID Ver
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Attend
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Reg
                  </th>
                  {isCPC && (
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      R&E Up
                    </th>
                  )}
                  <th className="px-3 py-3 w-10">
                    {/* Expand */}
                  </th>
                </tr>
              </thead>
              <tbody>
                {delegates.map((delegate) => {
                  const rowColor = getDelegateRowColor(delegate);
                  const isExpanded = expandedDelegateId === delegate.id;
                  const markedByInitials = delegate.attendance_marked_by
                    ? userInitials[delegate.attendance_marked_by] || '?'
                    : '';

                  return (
                    <>
                      <tr
                        key={delegate.id}
                        className={`border-b border-slate-800 transition-colors ${rowColor}`}
                      >
                        {/* Editable Name */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                              <User className="w-3 h-3 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={delegate.delegate_name || ''}
                                onChange={(e) =>
                                  updateDelegate(delegate.id, 'delegate_name', e.target.value)
                                }
                                placeholder="Delegate Name"
                                className="w-40 px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </td>

                        {/* Driver Number */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={delegate.driver_number || ''}
                            onChange={(e) =>
                              updateDelegate(delegate.id, 'driver_number', e.target.value)
                            }
                            placeholder="Driver #"
                            className="w-28 px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </td>

                        {/* Licence Category */}
                        <td className="px-3 py-2">
                          <select
                            value={delegate.licence_category || ''}
                            onChange={(e) =>
                              updateDelegate(
                                delegate.id,
                                'licence_category',
                                e.target.value || null
                              )
                            }
                            className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="">--</option>
                            {LICENCE_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* ID Type */}
                        <td className="px-3 py-2">
                          <select
                            value={delegate.id_type || ''}
                            onChange={(e) =>
                              updateDelegate(delegate.id, 'id_type', e.target.value)
                            }
                            className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="">--</option>
                            {ID_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* ID Verified */}
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() =>
                              handleIdCheckedToggle(delegate.id, delegate.id_checked)
                            }
                            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                              delegate.id_checked
                                ? 'bg-green-500 text-white'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            }`}
                            title={delegate.id_checked ? 'ID Verified' : 'Mark ID as verified'}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </td>

                        {/* Attendance */}
                        <td className="px-3 py-2">
                          <div className="flex justify-center">
                            <AttendanceIcons
                              value={delegate.attendance_detail}
                              onChange={(value) =>
                                handleAttendanceChange(delegate.id, value)
                              }
                              size="sm"
                            />
                          </div>
                        </td>

                        {/* Registered By (Initials) */}
                        <td className="px-3 py-2 text-center">
                          {markedByInitials ? (
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-700 text-xs font-medium text-slate-300"
                              title="Marked by"
                            >
                              {markedByInitials}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* DVSA Upload (CPC only) */}
                        {isCPC && (
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() =>
                                handleDVSAUploadToggle(delegate.id, delegate.dvsa_uploaded)
                              }
                              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                                delegate.dvsa_uploaded
                                  ? 'bg-green-500 text-white'
                                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                              }`}
                              title={
                                delegate.dvsa_uploaded
                                  ? 'Uploaded to DVSA'
                                  : 'Mark as uploaded'
                              }
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          </td>
                        )}

                        {/* Expand */}
                        <td className="px-3 py-2">
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

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr key={`${delegate.id}-details`} className={rowColor}>
                          <td
                            colSpan={isCPC ? 9 : 8}
                            className="px-4 py-4 border-b border-slate-800"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-9">
                              {/* Email */}
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">
                                  Email
                                </label>
                                <input
                                  type="email"
                                  value={delegate.delegate_email || ''}
                                  onChange={(e) =>
                                    updateDelegate(delegate.id, 'delegate_email', e.target.value)
                                  }
                                  placeholder="email@example.com"
                                  className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                              </div>

                              {/* Company */}
                              {delegate.delegate_company && (
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">
                                    Company
                                  </label>
                                  <p className="text-sm text-white py-1">
                                    {delegate.delegate_company}
                                  </p>
                                </div>
                              )}

                              {/* Additional Comments */}
                              <div className="md:col-span-3">
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
