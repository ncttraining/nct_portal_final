import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabase';
import BookingModal from '../components/BookingModal';
import Notification from '../components/Notification';
import { getTrainerUnavailability, TrainerUnavailability } from '../lib/trainer-availability';
import { getTrainerTypesForMultipleTrainers, type TrainerType as LibTrainerType } from '../lib/trainer-types';
import { sendBookingMovedNotification, sendBookingCancelledNotification } from '../lib/booking-notifications';

interface TrainerType {
  id: string;
  name: string;
  description: string;
  sort_order: number;
}

interface Trainer {
  id: string;
  name: string;
  email: string;
  telephone: string;
  postcode: string;
  display_order: number;
  trainer_type_id: string | null;
  assigned_types?: LibTrainerType[];
}

interface Client {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  telephone: string;
}

interface BookingCandidate {
  id?: string;
  booking_id?: string;
  candidate_name: string;
  telephone: string;
  email: string;
  paid: boolean;
  outstanding_balance: number;
}

interface Booking {
  id: string;
  trainer_id: string;
  booking_date: string;
  start_time: string;
  title: string;
  location: string;
  client_id?: string;
  client_name: string;
  client_contact_name: string;
  client_email: string;
  client_telephone: string;
  notes: string;
  status: 'confirmed' | 'provisional' | 'hold' | 'cancelled';
  in_centre: boolean;
  num_days: number;
  candidates?: BookingCandidate[];
  course_type_id?: string;
  centre_id?: string;
  room_id?: string;
  training_centre?: {
    id: string;
    name: string;
  };
  training_centre_room?: {
    id: string;
    room_name: string;
    capacity: number;
  };
  course_type?: {
    id: string;
    name: string;
    trainer_type_id: string | null;
  };
  is_open_course?: boolean;
  open_course_session_id?: string;
}

interface CourseBookingProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function CourseBooking({ currentPage, onNavigate }: CourseBookingProps) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainerTypes, setTrainerTypes] = useState<TrainerType[]>([]);
  const [selectedTrainerType, setSelectedTrainerType] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [draggedBooking, setDraggedBooking] = useState<string | null>(null);
  const [draggedTrainer, setDraggedTrainer] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [unavailability, setUnavailability] = useState<TrainerUnavailability[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentYear, currentMonth]);

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([
        loadTrainerTypes(),
        loadTrainers(),
        loadBookings(),
        loadClients()
      ]);
      await loadUnavailability();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTrainerTypes() {
    const { data, error } = await supabase
      .from('trainer_types')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading trainer types:', error);
      return;
    }

    console.log('Loaded trainer types:', data);
    setTrainerTypes(data || []);
  }

  async function loadTrainers() {
    const { data, error } = await supabase
      .from('trainers')
      .select('*')
      .eq('suspended', false)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading trainers:', error);
      return;
    }

    const trainerIds = (data || []).map(t => t.id);
    const trainerTypesMap = await getTrainerTypesForMultipleTrainers(trainerIds);

    const trainersWithTypes = (data || []).map(trainer => ({
      ...trainer,
      assigned_types: trainerTypesMap[trainer.id] || []
    }));

    setTrainers(trainersWithTypes);
  }

  async function loadBookings() {
    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endDate = new Date(currentYear, currentMonth, 0);
    const endDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${endDate.getDate()}`;

    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        candidates:booking_candidates(*),
        course_type:course_types(
          id,
          name,
          trainer_type_id
        ),
        training_centre:training_centres(
          id,
          name
        ),
        training_centre_room:training_centre_rooms(
          id,
          room_name,
          capacity
        )
      `)
      .gte('booking_date', startDate)
      .lte('booking_date', endDateStr)
      .order('booking_date', { ascending: true });

    if (bookingsError) {
      console.error('Error loading bookings:', bookingsError);
      return;
    }

    const { data: openCoursesData, error: openCoursesError } = await supabase
      .from('open_course_sessions')
      .select(`
        *,
        course_type:course_types(
          id,
          name,
          trainer_type_id
        ),
        venue:venues(
          id,
          name,
          town,
          address1,
          address2,
          postcode
        ),
        trainer:trainers(
          id,
          name,
          email
        ),
        delegates:open_course_delegates!open_course_delegates_session_id_fkey(
          id,
          delegate_name,
          delegate_email,
          delegate_telephone
        )
      `)
      .gte('session_date', startDate)
      .lte('session_date', endDateStr)
      .not('trainer_id', 'is', null)
      .eq('status', 'confirmed')
      .order('session_date', { ascending: true });

    if (openCoursesError) {
      console.error('Error loading open courses:', openCoursesError);
    }

    const transformedOpenCourses = (openCoursesData || []).map(session => ({
      id: `open-${session.id}`,
      trainer_id: session.trainer_id,
      booking_date: session.session_date,
      start_time: session.start_time || '09:00',
      title: `${session.event_title}${session.event_subtitle ? ` - ${session.event_subtitle}` : ''}`,
      location: session.is_online ? 'Online' : (session.venue?.town || session.venue?.name || 'TBA'),
      client_name: 'Open Course',
      client_contact_name: '',
      client_email: '',
      client_telephone: '',
      notes: `Open Course Session\nCapacity: ${session.delegates?.length || 0}/${session.capacity_limit}`,
      status: 'confirmed' as const,
      in_centre: false,
      num_days: 1,
      candidates: (session.delegates || []).map(delegate => ({
        candidate_name: delegate.delegate_name,
        email: delegate.delegate_email,
        telephone: delegate.delegate_telephone,
        paid: true,
        outstanding_balance: 0
      })),
      course_type_id: session.course_type_id,
      course_type: session.course_type,
      is_open_course: true,
      open_course_session_id: session.id
    }));

    setBookings([...(bookingsData || []), ...transformedOpenCourses]);
  }

  async function loadClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading clients:', error);
      return;
    }

    setClients(data || []);
  }

  async function loadUnavailability() {
    try {
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfMonth = new Date(currentYear, currentMonth, 0);

      const startDate = startOfMonth.toISOString().split('T')[0];
      const endDate = endOfMonth.toISOString().split('T')[0];

      const { data: trainersData, error: trainersError } = await supabase
        .from('trainers')
        .select('id')
        .eq('suspended', false);

      if (trainersError) {
        console.error('Error loading trainers for unavailability:', trainersError);
        return;
      }

      const trainerIds = (trainersData || []).map(t => t.id);

      if (trainerIds.length === 0) {
        setUnavailability([]);
        return;
      }

      const { data, error } = await supabase
        .from('trainer_unavailability')
        .select('*')
        .in('trainer_id', trainerIds)
        .gte('unavailable_date', startDate)
        .lte('unavailable_date', endDate)
        .order('unavailable_date', { ascending: true });

      if (error) {
        console.error('Error loading unavailability:', error);
        return;
      }

      setUnavailability(data || []);
    } catch (error) {
      console.error('Error loading unavailability:', error);
    }
  }

  function daysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }

  function isWeekend(year: number, month: number, day: number) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  function formatMonthLabel() {
    const date = new Date(currentYear, currentMonth - 1, 1);
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function changeMonth(delta: number) {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;

    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }

    setCurrentYear(newYear);
    setCurrentMonth(newMonth);
  }

  function isTrainerUnavailable(trainerId: string, date: string): TrainerUnavailability | undefined {
    return unavailability.find(u => u.trainer_id === trainerId && u.unavailable_date === date);
  }

  function bookingOverlapsUnavailability(booking: Booking): boolean {
    const { start, end } = getBookingDateRange(booking);
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      if (isTrainerUnavailable(booking.trainer_id, dateStr)) {
        return true;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return false;
  }

  function openBookingModal(trainer: Trainer, date: string, booking: Booking | null) {
    if (booking?.is_open_course) {
      setNotification({
        message: 'Open course sessions cannot be edited from here. Please manage them from the Open Courses Dashboard.',
        type: 'warning'
      });
      return;
    }

    const unavailable = isTrainerUnavailable(trainer.id, date);

    if (unavailable && !booking) {
      const reason = unavailable.reason ? ` Reason: ${unavailable.reason}` : '';
      setNotification({
        message: `This trainer is unavailable on this date.${reason}`,
        type: 'error'
      });
      return;
    }

    setSelectedTrainer(trainer);
    setSelectedDate(date);
    setSelectedBooking(booking);
    setModalOpen(true);
  }

  async function closeBookingModal() {
    setModalOpen(false);
    setSelectedBooking(null);
    setSelectedTrainer(null);
    setSelectedDate(null);
    await loadBookings();
  }

  async function handleDeleteBooking(bookingId: string) {
    const bookingToDelete = bookings.find(b => b.id === bookingId);

    if (bookingToDelete?.is_open_course) {
      alert('Open course sessions cannot be deleted from here. Please manage them from the Open Courses Dashboard.');
      return;
    }

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (error) {
      console.error('Error deleting booking:', error);
      throw error;
    }

    if (bookingToDelete) {
      await sendBookingCancelledNotification(bookingToDelete as any, bookingToDelete.trainer_id);
    }

    await loadBookings();
    closeBookingModal();
  }

  function getBookingDateRange(booking: Booking) {
    const start = new Date(booking.booking_date + 'T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + (booking.num_days - 1));
    return { start, end };
  }

  function getBookingsForTrainerAndDay(trainerId: string, date: string) {
    return bookings.filter(booking => {
      if (booking.trainer_id !== trainerId) return false;

      const { start, end } = getBookingDateRange(booking);
      const checkDate = new Date(date + 'T00:00:00');

      return checkDate >= start && checkDate <= end;
    });
  }

  function checkBookingClash(booking: Booking, trainerId: string): boolean {
    // Get all bookings for this trainer
    const trainerBookings = bookings.filter(b =>
      b.trainer_id === trainerId && b.id !== booking.id
    );

    const { start: bookingStart, end: bookingEnd } = getBookingDateRange(booking);

    // Check if any other booking overlaps with this one
    return trainerBookings.some(otherBooking => {
      const { start: otherStart, end: otherEnd } = getBookingDateRange(otherBooking);

      // Check for any overlap between date ranges
      return bookingStart <= otherEnd && bookingEnd >= otherStart;
    });
  }

  function checkRoomConflict(booking: Booking): boolean {
    // Only check room conflicts for in-centre bookings with a room assigned
    if (!booking.in_centre || !booking.room_id) return false;

    // Get all other bookings for the same room
    const roomBookings = bookings.filter(b =>
      b.room_id === booking.room_id && b.id !== booking.id && b.status !== 'cancelled'
    );

    const { start: bookingStart, end: bookingEnd } = getBookingDateRange(booking);

    // Check if any other booking overlaps with this one
    return roomBookings.some(otherBooking => {
      const { start: otherStart, end: otherEnd } = getBookingDateRange(otherBooking);

      // Check for any overlap between date ranges
      return bookingStart <= otherEnd && bookingEnd >= otherStart;
    });
  }

  function handleDayClick(trainer: Trainer, date: string, event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('.booking-pill')) return;

    openBookingModal(trainer, date, null);
  }

  function handleBookingDragStart(booking: Booking) {
    setDraggedBooking(booking.id);
  }

  function handleBookingDragEnd() {
    setDraggedBooking(null);
  }

  async function handleBookingDrop(trainerId: string, date: string) {
    if (!draggedBooking) return;

    const booking = bookings.find(b => b.id === draggedBooking);
    if (!booking) return;

    const oldTrainerId = booking.trainer_id;
    const trainerChanged = oldTrainerId !== trainerId;

    let previousTrainerName: string | undefined;
    if (trainerChanged) {
      const oldTrainer = trainers.find(t => t.id === oldTrainerId);
      previousTrainerName = oldTrainer?.name;
    }

    const { error } = await supabase
      .from('bookings')
      .update({
        trainer_id: trainerId,
        booking_date: date
      })
      .eq('id', draggedBooking);

    if (error) {
      console.error('Error moving booking:', error);
      return;
    }

    if (trainerChanged) {
      await sendBookingMovedNotification(
        { ...booking, trainer_id: trainerId, booking_date: date } as any,
        draggedBooking,
        previousTrainerName
      );
    }

    await loadBookings();
    setDraggedBooking(null);
  }

  function handleTrainerDragStart(trainerId: string) {
    setDraggedTrainer(trainerId);
  }

  function handleTrainerDragEnd() {
    setDraggedTrainer(null);
  }

  async function handleTrainerDrop(targetTrainerId: string) {
    if (!draggedTrainer || draggedTrainer === targetTrainerId) {
      setDraggedTrainer(null);
      return;
    }

    const draggedIndex = trainers.findIndex(t => t.id === draggedTrainer);
    const targetIndex = trainers.findIndex(t => t.id === targetTrainerId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const reordered = [...trainers];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    setTrainers(reordered);

    const updates = reordered.map((trainer, index) => ({
      id: trainer.id,
      display_order: index
    }));

    for (const update of updates) {
      await supabase
        .from('trainers')
        .update({ display_order: update.display_order })
        .eq('id', update.id);
    }

    setDraggedTrainer(null);
  }

  const days = daysInMonth(currentYear, currentMonth);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const bookingsThisMonth = bookings.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-semibold tracking-wide uppercase">
                  Course Booking Planner
                </h2>
                <span className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full uppercase">
                  Beta
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Review and schedule training courses across the NCT trainer team. Drag & drop bookings between
                trainers or dates, then click any booking to edit the details.
              </p>

              <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
                <span className="text-xs text-slate-500 uppercase tracking-wider">
                  Schedule Overview
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="px-3 py-1 text-sm border border-slate-700 hover:border-slate-600 rounded transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold min-w-[150px] text-center">
                    {formatMonthLabel()}
                  </span>
                  <button
                    onClick={() => changeMonth(1)}
                    className="px-3 py-1 text-sm border border-slate-700 hover:border-slate-600 rounded transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">
                    Trainer Type
                  </span>
                  <select
                    value={selectedTrainerType || ''}
                    onChange={(e) => setSelectedTrainerType(e.target.value || null)}
                    className="px-3 py-1 text-sm bg-slate-950 border border-slate-700 hover:border-slate-600 rounded transition-colors focus:border-blue-500 outline-none"
                  >
                    <option value="">All Types ({trainerTypes.length})</option>
                    {trainerTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                <span className="text-sm text-slate-400">
                  {trainers.filter(t => !selectedTrainerType || t.assigned_types?.some(at => at.id === selectedTrainerType)).length} trainer(s) - {days} day(s)
                </span>
              </div>
            </div>

            <div className="text-right text-sm space-y-2">
              <div className="flex items-center justify-end gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">
                  Planner Status
                </span>
                <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded">
                  Live & connected
                </span>
              </div>
              <div className="text-slate-400">
                <span className="font-medium text-white">
                  Today {today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <span className="mx-2">·</span>
                <span>{bookingsThisMonth} bookings this month</span>
              </div>
              <div className="flex items-center justify-end gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 border-2 border-green-600 rounded-full"></div>
                  <span>In-centre</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-amber-300 border-2 border-amber-400 rounded-full"></div>
                  <span>Onsite</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-slate-300 border-2 border-slate-500 rounded-full"></div>
                  <span>Provisional</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500/20 border-2 border-red-500/70 rounded-full"></div>
                  <span>Cancelled</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
              <div className="min-w-max">
                <div className="flex bg-slate-900/80 border-b border-slate-800 sticky top-0 z-10">
                  <div className="w-40 px-3 py-2 border-r border-slate-800 font-semibold text-sm">
                    Trainer
                  </div>
                  <div className="flex">
                    {Array.from({ length: days }, (_, i) => {
                      const day = i + 1;
                      const date = new Date(currentYear, currentMonth - 1, day);
                      const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' });
                      const weekend = isWeekend(currentYear, currentMonth, day);

                      return (
                        <div
                          key={day}
                          className={`w-[120px] px-2 py-2 border-r border-slate-800 text-center text-xs ${
                            weekend ? 'bg-blue-900/20' : ''
                          }`}
                        >
                          <div>{day}</div>
                          <div className="text-slate-500">{dayName}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  {trainers
                    .filter(trainer => !selectedTrainerType || trainer.assigned_types?.some(at => at.id === selectedTrainerType))
                    .map((trainer, trainerIndex) => (
                    <div
                      key={trainer.id}
                      className={`flex ${trainerIndex % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-900/80'} ${
                        draggedTrainer === trainer.id ? 'opacity-50' : ''
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedTrainer && draggedTrainer !== trainer.id) {
                          e.currentTarget.classList.add('border-t-2', 'border-t-blue-500');
                        }
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove('border-t-2', 'border-t-blue-500');
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('border-t-2', 'border-t-blue-500');
                        if (draggedTrainer) {
                          handleTrainerDrop(trainer.id);
                        }
                      }}
                    >
                      <div
                        className="w-40 px-3 py-2 border-r border-b border-slate-800 text-sm sticky left-0 bg-inherit cursor-move"
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleTrainerDragStart(trainer.id);
                        }}
                        onDragEnd={handleTrainerDragEnd}
                      >
                        <div className="font-medium">{trainer.name}</div>
                        {trainer.assigned_types && trainer.assigned_types.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {trainer.assigned_types.map((type) => (
                              <span key={type.id} className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 text-blue-300">
                                {type.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex relative">
                        {Array.from({ length: days }, (_, i) => {
                          const day = i + 1;
                          const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const weekend = isWeekend(currentYear, currentMonth, day);
                          const dayBookings = getBookingsForTrainerAndDay(trainer.id, dateStr);
                          const unavailableRecord = isTrainerUnavailable(trainer.id, dateStr);
                          const isUnavailable = !!unavailableRecord;

                          return (
                            <div
                              key={day}
                              className={`w-[120px] min-h-[88px] border-r border-b relative ${
                                isUnavailable
                                  ? 'bg-red-900/40 border-red-700/50'
                                  : weekend
                                  ? 'bg-slate-900/50 border-slate-800'
                                  : 'border-slate-800'
                              } ${isUnavailable ? '' : 'hover:bg-blue-900/10'} cursor-pointer transition-colors`}
                              onClick={(e) => handleDayClick(trainer, dateStr, e)}
                              title={isUnavailable && unavailableRecord?.reason ? `Unavailable: ${unavailableRecord.reason}` : undefined}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (draggedBooking) {
                                  e.currentTarget.classList.add('bg-blue-500/20');
                                }
                              }}
                              onDragLeave={(e) => {
                                e.currentTarget.classList.remove('bg-blue-500/20');
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('bg-blue-500/20');
                                handleBookingDrop(trainer.id, dateStr);
                              }}
                            >
                              {dayBookings.map(booking => {
                                const { start } = getBookingDateRange(booking);
                                const bookingStartDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

                                if (bookingStartDate !== dateStr) return null;

                                const hasUnpaid = booking.candidates?.some(c => !c.paid) || false;
                                const delegateCount = booking.candidates?.length || 0;
                                const overlapsUnavailable = bookingOverlapsUnavailability(booking);
                                const hasClash = checkBookingClash(booking, trainer.id);
                                const hasRoomConflict = checkRoomConflict(booking);

                                // Check if trainer is qualified for this course type
                                const courseRequiresType = booking.course_type?.trainer_type_id;
                                const trainerQualified = !courseRequiresType ||
                                  trainer.assigned_types?.some(t => t.id === courseRequiresType);

                                let statusClass = 'bg-yellow-500/20 border-yellow-500/50';
                                if (booking.status === 'confirmed') {
                                  if (booking.in_centre) {
                                    statusClass = 'bg-green-500 border-green-600 text-slate-950';
                                  } else {
                                    statusClass = 'bg-amber-300 border-amber-400 text-slate-950';
                                  }
                                } else if (booking.status === 'provisional') {
                                  statusClass = 'bg-slate-300 border-slate-500 text-slate-950';
                                } else if (booking.status === 'hold') {
                                  statusClass = 'bg-blue-500/20 border-blue-500/50 text-blue-300';
                                } else if (booking.status === 'cancelled') {
                                  statusClass = 'bg-red-500/20 border-red-500/60 text-red-300 line-through';
                                }

                                return (
                                  <div
                                    key={booking.id}
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      handleBookingDragStart(booking);
                                    }}
                                    onDragEnd={(e) => {
                                      e.stopPropagation();
                                      handleBookingDragEnd();
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openBookingModal(trainer, booking.booking_date, booking);
                                    }}
                                    className={`booking-pill absolute top-1 left-1 right-1 bottom-1 px-2 py-1.5 text-xs border rounded cursor-move ${statusClass} ${overlapsUnavailable ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-slate-950' : ''} ${hasClash || hasRoomConflict ? '!border-red-500 !border-2' : ''}`}
                                    style={{
                                      width: `calc(${booking.num_days * 120}px - 8px)`,
                                      zIndex: 2
                                    }}
                                  >
                                    <div className="font-semibold truncate">
                                      {booking.title}
                                    </div>
                                    {booking.in_centre && booking.training_centre ? (
                                      <div className="text-[10px] opacity-90 truncate">
                                        {booking.num_days > 1 && `[${booking.num_days}d] `}
                                        {booking.training_centre.name}
                                      </div>
                                    ) : booking.location ? (
                                      <div className="text-[10px] opacity-90 truncate">
                                        {booking.num_days > 1 && `[${booking.num_days}d] `}
                                        {booking.location}
                                      </div>
                                    ) : null}
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      {hasClash && (
                                        <span className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] font-semibold">
                                          ⚠ TRAINER CLASH
                                        </span>
                                      )}
                                      {hasRoomConflict && (
                                        <span className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] font-semibold">
                                          ⚠ ROOM CLASH
                                        </span>
                                      )}
                                      {!trainerQualified && (
                                        <span className="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[10px] font-semibold">
                                          ⚠ NOT QUALIFIED
                                        </span>
                                      )}
                                      {delegateCount > 0 && (
                                        <span className="px-1.5 py-0.5 bg-slate-800/80 text-slate-200 rounded text-[10px] font-medium">
                                          {delegateCount} {delegateCount === 1 ? 'delegate' : 'delegates'}
                                        </span>
                                      )}
                                      {hasUnpaid && (
                                        <span className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] font-semibold">
                                          UNPAID
                                        </span>
                                      )}
                                      {overlapsUnavailable && (
                                        <span className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-semibold">
                                          ⚠ UNAVAILABLE
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-3 text-right">
            Multi-day courses appear as a single bar spanning the relevant days. Drag trainer names up/down to reorder, or drag bookings to another trainer/day.
          </p>
        </div>
      </main>

      {modalOpen && (
        <BookingModal
          booking={selectedBooking}
          trainer={selectedTrainer}
          date={selectedDate}
          clients={clients}
          onDelete={handleDeleteBooking}
          onClose={closeBookingModal}
          onClientCreated={loadClients}
        />
      )}
    </div>
  );
}
