import { Calendar, MapPin, User, Clock, Building, FileText } from 'lucide-react';
import { OpenCourseSessionWithDetails, formatTime } from '../../lib/open-courses';

interface RegisterHeaderProps {
  session: OpenCourseSessionWithDetails;
  onStartTimeChange?: (time: string) => void;
  onEndTimeChange?: (time: string) => void;
  onBreakTimeChange?: (minutes: number | null) => void;
  editable?: boolean;
  showStats?: boolean;
  presentCount?: number;
  totalCount?: number;
}

export default function RegisterHeader({
  session,
  onStartTimeChange,
  onEndTimeChange,
  onBreakTimeChange,
  editable = false,
  showStats = false,
  presentCount = 0,
  totalCount = 0,
}: RegisterHeaderProps) {
  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const jauptCode = session.course_type?.jaupt_code;
  const isCPC = !!jauptCode || session.course_type?.name?.toLowerCase().includes('cpc');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
      {/* Title Row */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">
            {session.event_title || session.course_type?.name || 'Untitled Session'}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* JAUPT Code - prominent display for CPC courses */}
          {jauptCode && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-mono font-semibold text-blue-400">
                {jauptCode}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-5 h-5 text-blue-400" />
            <span className="font-medium">{formatDate(session.session_date)}</span>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {/* Centre/Venue */}
        <div className="flex items-start gap-3">
          <Building className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Centre</p>
            <p className="text-sm text-white">
              {session.venue?.name || 'Not assigned'}
            </p>
            {session.venue?.code && (
              <p className="text-xs text-slate-400">{session.venue.code}</p>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Location</p>
            <p className="text-sm text-white">
              {session.is_online ? 'ONLINE REMOTE' : session.venue?.town || 'TBC'}
            </p>
          </div>
        </div>

        {/* Trainer with Course Code */}
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Trainer</p>
            <p className="text-sm text-white">
              {session.trainer?.name || 'Not assigned'}
              {session.course_type?.code && (
                <span className="text-slate-400 ml-2">({session.course_type.code})</span>
              )}
            </p>
          </div>
        </div>

        {/* Stats (if enabled) */}
        {showStats && (
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center text-slate-400 mt-0.5">
              <span className="text-sm font-bold">#</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Delegates</p>
              <p className="text-sm text-white">
                <span className="text-green-400 font-semibold">{presentCount}</span>
                <span className="text-slate-400"> / {totalCount}</span>
              </p>
            </div>
          </div>
        )}

        {/* Course ID */}
        {session.course_id && (
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Course ID</p>
              <p className="text-sm text-white font-mono">{session.course_id}</p>
            </div>
          </div>
        )}
      </div>

      {/* Actual Session Times Row */}
      <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 uppercase">Actual Start:</span>
          {editable && onStartTimeChange ? (
            <input
              type="time"
              value={session.actual_start_time || ''}
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            />
          ) : (
            <span className="text-sm text-white font-medium">
              {session.actual_start_time || '--:--'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase">Actual End:</span>
          {editable && onEndTimeChange ? (
            <input
              type="time"
              value={session.actual_end_time || ''}
              onChange={(e) => onEndTimeChange(e.target.value)}
              className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            />
          ) : (
            <span className="text-sm text-white font-medium">
              {session.actual_end_time || '--:--'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase">Break (mins):</span>
          {editable && onBreakTimeChange ? (
            <input
              type="number"
              min="0"
              max="120"
              value={session.break_duration_minutes ?? ''}
              onChange={(e) => onBreakTimeChange(e.target.value ? parseInt(e.target.value) : null)}
              className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 w-16 text-center"
            />
          ) : (
            <span className="text-sm text-white font-medium">
              {session.break_duration_minutes ?? '--'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
