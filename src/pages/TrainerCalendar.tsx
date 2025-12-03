import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getTrainerUnavailability, markDateUnavailable, removeDateUnavailability, TrainerUnavailability } from '../lib/trainer-availability';

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  title: string;
  location: string;
  client_name: string;
  client_contact_name: string;
  client_email: string;
  client_telephone: string;
  notes: string;
  status: string;
  in_centre: boolean;
  num_days: number;
  course_type_name?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  bookings: Booking[];
  unavailability?: TrainerUnavailability;
}

export default function TrainerCalendar() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [unavailability, setUnavailability] = useState<TrainerUnavailability[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedUnavailability, setSelectedUnavailability] = useState<TrainerUnavailability | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [showMarkUnavailableModal, setShowMarkUnavailableModal] = useState(false);
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [unavailabilityToRemove, setUnavailabilityToRemove] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [unavailableReason, setUnavailableReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.trainer_id) {
      loadBookings();
      loadUnavailability();
    }
  }, [profile?.trainer_id, currentDate]);

  useEffect(() => {
    generateCalendar();
  }, [currentDate, bookings, unavailability]);

  async function loadBookings() {
    if (!profile?.trainer_id) return;

    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const lookbackDays = 30;
      const extendedStart = new Date(startOfMonth);
      extendedStart.setDate(extendedStart.getDate() - lookbackDays);

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          course_type:course_types(name)
        `)
        .eq('trainer_id', profile.trainer_id)
        .gte('booking_date', extendedStart.toISOString().split('T')[0])
        .lte('booking_date', endOfMonth.toISOString().split('T')[0])
        .order('booking_date', { ascending: true });

      if (error) throw error;

      const formattedBookings = (data || []).map((b: any) => ({
        ...b,
        course_type_name: b.course_type?.name,
      }));

      setBookings(formattedBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUnavailability() {
    if (!profile?.trainer_id) return;

    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const data = await getTrainerUnavailability(
        profile.trainer_id,
        startOfMonth.toISOString().split('T')[0],
        endOfMonth.toISOString().split('T')[0]
      );

      setUnavailability(data);
    } catch (error) {
      console.error('Error loading unavailability:', error);
    }
  }

  function generateCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const startingDayOfWeek = firstDay.getDay();

    const days: CalendarDay[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -startingDayOfWeek + i + 1);
      days.push({
        date: prevMonthDay,
        isCurrentMonth: false,
        bookings: [],
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split('T')[0];

      const dayBookings = bookings.filter(b => {
        const bookingStart = new Date(b.booking_date);
        const bookingEnd = new Date(bookingStart);
        bookingEnd.setDate(bookingEnd.getDate() + (b.num_days - 1));

        return date >= bookingStart && date <= bookingEnd;
      });

      const dayUnavailability = unavailability.find(u => u.unavailable_date === dateString);

      days.push({
        date,
        isCurrentMonth: true,
        bookings: dayBookings,
        unavailability: dayUnavailability,
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonthDay = new Date(year, month + 1, i);
      days.push({
        date: nextMonthDay,
        isCurrentMonth: false,
        bookings: [],
      });
    }

    setCalendarDays(days);
  }

  function previousMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function getBookingColor(index: number): string {
    const colors = [
      'bg-cyan-500/90',
      'bg-blue-500/90',
      'bg-emerald-500/90',
      'bg-amber-500/90',
      'bg-red-500/90',
      'bg-purple-500/90',
      'bg-pink-500/90',
    ];
    return colors[index % colors.length];
  }

  function handleMarkUnavailableClick(date: Date) {
    setSelectedDate(date);
    setUnavailableReason('');
    setShowMarkUnavailableModal(true);
  }

  async function handleMarkUnavailable() {
    if (!selectedDate || !profile?.trainer_id) return;

    setSubmitting(true);
    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      const result = await markDateUnavailable(profile.trainer_id, dateString, unavailableReason);

      if (result.success) {
        await loadUnavailability();
        setShowMarkUnavailableModal(false);
        setSelectedDate(null);
        setUnavailableReason('');
      } else {
        alert(result.error || 'Failed to mark date as unavailable');
      }
    } catch (error) {
      console.error('Error marking date unavailable:', error);
      alert('Failed to mark date as unavailable');
    } finally {
      setSubmitting(false);
    }
  }

  function promptRemoveUnavailability(unavailabilityId: string) {
    setUnavailabilityToRemove(unavailabilityId);
    setShowRemoveConfirmModal(true);
  }

  async function confirmRemoveUnavailability() {
    if (!unavailabilityToRemove) return;

    setSubmitting(true);
    try {
      const result = await removeDateUnavailability(unavailabilityToRemove);

      if (result.success) {
        await loadUnavailability();
        setSelectedUnavailability(null);
        setShowRemoveConfirmModal(false);
        setUnavailabilityToRemove(null);
      } else {
        alert(result.error || 'Failed to remove unavailability');
      }
    } catch (error) {
      console.error('Error removing unavailability:', error);
      alert('Failed to remove unavailability');
    } finally {
      setSubmitting(false);
    }
  }

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const today = new Date();
  const isToday = (date: Date) => {
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Calendar Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={previousMonth}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextMonth}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={goToToday}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                Today
              </button>
            </div>

            <h2 className="text-2xl font-bold text-white">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>

            <div className="flex items-center gap-2">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
                Month
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading calendar...</div>
          ) : (
            <>
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-sm font-semibold text-slate-400 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  const dateKey = day.date.toISOString().split('T')[0];
                  const isHovered = hoveredDay === dateKey;
                  const hasBookings = day.bookings.length > 0;
                  const isUnavailable = !!day.unavailability;
                  const canManageAvailability = profile?.can_manage_availability && day.isCurrentMonth;

                  return (
                    <div
                      key={index}
                      onMouseEnter={() => setHoveredDay(dateKey)}
                      onMouseLeave={() => setHoveredDay(null)}
                      onClick={() => {
                        if (isUnavailable && canManageAvailability) {
                          setSelectedUnavailability(day.unavailability || null);
                        }
                      }}
                      className={`min-h-[120px] p-2 rounded-lg border relative ${
                        isUnavailable
                          ? 'bg-red-900/40 border-red-700/50'
                          : day.isCurrentMonth
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-900/50 border-slate-800/50'
                      } ${isToday(day.date) ? 'ring-2 ring-blue-500' : ''} ${
                        isUnavailable && canManageAvailability ? 'cursor-pointer hover:bg-red-900/50' : ''
                      }`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        isUnavailable
                          ? 'text-red-400'
                          : day.isCurrentMonth ? 'text-white' : 'text-slate-600'
                      } ${isToday(day.date) ? 'text-blue-400' : ''}`}>
                        {day.date.getDate()}
                      </div>

                      <div className="space-y-1">
                        {day.bookings.map((booking, bookingIndex) => (
                          <button
                            key={booking.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBooking(booking);
                            }}
                            className={`w-full text-left px-2 py-1 rounded text-xs font-medium text-white truncate ${getBookingColor(bookingIndex)} hover:opacity-80 transition-opacity`}
                          >
                            {booking.title}
                          </button>
                        ))}

                        {isUnavailable && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <X className="w-16 h-16 text-red-400 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {canManageAvailability && !hasBookings && !isUnavailable && isHovered && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkUnavailableClick(day.date);
                          }}
                          className="absolute bottom-2 left-2 right-2 text-xs text-slate-400 hover:text-white transition-colors uppercase tracking-wide font-medium"
                        >
                          Mark Unavailable
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Booking Details</h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-slate-400">Title</label>
                <p className="text-white font-medium mt-1">{selectedBooking.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Date</label>
                  <p className="text-white font-medium mt-1">
                    {new Date(selectedBooking.booking_date).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Start Time</label>
                  <p className="text-white font-medium mt-1">{selectedBooking.start_time}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Duration</label>
                  <p className="text-white font-medium mt-1">{selectedBooking.num_days} day(s)</p>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Course Type</label>
                  <p className="text-white font-medium mt-1">{selectedBooking.course_type_name || 'N/A'}</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400">Location</label>
                <p className="text-white font-medium mt-1">{selectedBooking.location || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm text-slate-400">Venue Type</label>
                <p className="text-white font-medium mt-1">
                  {selectedBooking.in_centre ? 'In Centre' : 'On-site'}
                </p>
              </div>

              {selectedBooking.client_name && (
                <div className="border-t border-slate-800 pt-4 mt-4">
                  <h3 className="text-lg font-semibold text-white mb-3">Client Information</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-slate-400">Client Name</label>
                      <p className="text-white font-medium mt-1">{selectedBooking.client_name}</p>
                    </div>

                    {selectedBooking.client_contact_name && (
                      <div>
                        <label className="text-sm text-slate-400">Contact Name</label>
                        <p className="text-white font-medium mt-1">{selectedBooking.client_contact_name}</p>
                      </div>
                    )}

                    {selectedBooking.client_email && (
                      <div>
                        <label className="text-sm text-slate-400">Contact Email</label>
                        <p className="text-white font-medium mt-1">{selectedBooking.client_email}</p>
                      </div>
                    )}

                    {selectedBooking.client_telephone && (
                      <div>
                        <label className="text-sm text-slate-400">Contact Telephone</label>
                        <p className="text-white font-medium mt-1">{selectedBooking.client_telephone}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedBooking.notes && (
                <div className="border-t border-slate-800 pt-4 mt-4">
                  <label className="text-sm text-slate-400">Notes</label>
                  <p className="text-white mt-1 whitespace-pre-wrap">{selectedBooking.notes}</p>
                </div>
              )}

              <div className="border-t border-slate-800 pt-4 mt-4">
                <label className="text-sm text-slate-400">Status</label>
                <p className="text-white font-medium mt-1 capitalize">{selectedBooking.status}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark Unavailable Modal */}
      {showMarkUnavailableModal && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-md">
            <div className="border-b border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Mark Date Unavailable</h2>
              <button
                onClick={() => {
                  setShowMarkUnavailableModal(false);
                  setSelectedDate(null);
                  setUnavailableReason('');
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-slate-400">Date</label>
                <p className="text-white font-medium mt-1">
                  {selectedDate.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={unavailableReason}
                  onChange={(e) => setUnavailableReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-white resize-none"
                  rows={3}
                  placeholder="e.g., Personal time off, Holiday, etc."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowMarkUnavailableModal(false);
                    setSelectedDate(null);
                    setUnavailableReason('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkUnavailable}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Marking...' : 'Mark Unavailable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unavailability Details Modal */}
      {selectedUnavailability && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-md">
            <div className="border-b border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Unavailable Date</h2>
              <button
                onClick={() => setSelectedUnavailability(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-slate-400">Date</label>
                <p className="text-white font-medium mt-1">
                  {new Date(selectedUnavailability.unavailable_date).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              {selectedUnavailability.reason && (
                <div>
                  <label className="text-sm text-slate-400">Reason</label>
                  <p className="text-white mt-1">{selectedUnavailability.reason}</p>
                </div>
              )}

              <div>
                <label className="text-sm text-slate-400">Marked On</label>
                <p className="text-white mt-1">
                  {new Date(selectedUnavailability.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>

              {profile?.can_manage_availability && (
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setSelectedUnavailability(null)}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => promptRemoveUnavailability(selectedUnavailability.id)}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                  >
                    Remove Unavailability
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Unavailability Confirmation Modal */}
      {showRemoveConfirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Remove Unavailability</h2>
              <p className="text-slate-300 mb-6">
                Are you sure you want to remove this unavailability?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRemoveConfirmModal(false);
                    setUnavailabilityToRemove(null);
                  }}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveUnavailability}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  {submitting ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
