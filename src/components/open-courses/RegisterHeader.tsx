import { Calendar, MapPin, User, Clock, Building } from 'lucide-react';
import { OpenCourseSessionWithDetails, formatTime } from '../../lib/open-courses';

interface RegisterHeaderProps {
  session: OpenCourseSessionWithDetails;
  onStartTimeChange?: (time: string) => void;
  onEndTimeChange?: (time: string) => void;
  onBreakTimeChange?: (time: string) => void;
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
  const isCPC = !!jauptCode;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
      {/* Title Row */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isCPC && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                CPC
              </span>
            )}
            {jauptCode && (
              <span className="text-sm text-blue-400 font-mono">
                {jauptCode}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-white">
            {session.event_title || session.course_type?.name || 'Untitled Session'}
          </h1>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <Calendar className="w-5 h-5 text-blue-400" />
          <span className="font-medium">{formatDate(session.session_date)}</span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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

        {/* Trainer */}
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Trainer</p>
            <p className="text-sm text-white">
              {session.trainer?.name || 'Not assigned'}
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
      </div>

      {/* Time Row */}
      <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 uppercase">Start:</span>
          {editable && onStartTimeChange ? (
            <input
              type="time"
              value={session.start_time ? formatTime(session.start_time) : ''}
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            />
          ) : (
            <span className="text-sm text-white font-medium">
              {session.start_time ? formatTime(session.start_time) : '--:--'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase">End:</span>
          {editable && onEndTimeChange ? (
            <input
              type="time"
              value={session.end_time ? formatTime(session.end_time) : ''}
              onChange={(e) => onEndTimeChange(e.target.value)}
              className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            />
          ) : (
            <span className="text-sm text-white font-medium">
              {session.end_time ? formatTime(session.end_time) : '--:--'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase">Break:</span>
          {editable && onBreakTimeChange ? (
            <input
              type="text"
              value={session.break_time || ''}
              onChange={(e) => onBreakTimeChange(e.target.value)}
              placeholder="12:00-13:00"
              className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 w-28"
            />
          ) : (
            <span className="text-sm text-white font-medium">
              {session.break_time || '--:-- to --:--'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
