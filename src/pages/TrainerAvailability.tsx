import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, AlertTriangle, CalendarRange, Check } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notification from '../components/Notification';
import { supabase } from '../lib/supabase';
import {
  getAllTrainersUnavailability,
  setDateAvailabilityStatus,
  markDateRangeUnavailable,
  markDateRangeProvisionallyBooked,
  removeDateRangeUnavailability,
  removeDateUnavailability,
  getBookingConflicts,
  TrainerUnavailability,
  AvailabilityStatus,
} from '../lib/trainer-availability';
import { getTrainerTypesForMultipleTrainers, type TrainerType as LibTrainerType } from '../lib/trainer-types';

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

interface TrainerAvailabilityProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

type NotificationState = {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
} | null;

export default function TrainerAvailability({ currentPage, onNavigate }: TrainerAvailabilityProps) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainerTypes, setTrainerTypes] = useState<TrainerType[]>([]);
  const [selectedTrainerType, setSelectedTrainerType] = useState<string | null>(null);
  const [unavailability, setUnavailability] = useState<TrainerUnavailability[]>([]);
  const [notification, setNotification] = useState<NotificationState>(null);
  const [loading, setLoading] = useState(true);

  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayReason, setDayReason] = useState('');

  const [showRangeModal, setShowRangeModal] = useState(false);
  const [rangeTrainerId, setRangeTrainerId] = useState('');
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');
  const [rangeReason, setRangeReason] = useState('');
  const [rangeAction, setRangeAction] = useState<'mark' | 'remove' | 'provisional'>('mark');
  const [processingRange, setProcessingRange] = useState(false);

  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflictingBookings, setConflictingBookings] = useState<Array<{ id: string; title: string; booking_date: string }>>([]);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // State for hover interaction on grid cells
  const [hoveredCell, setHoveredCell] = useState<{ trainerId: string; date: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [currentYear, currentMonth]);

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([loadTrainerTypes(), loadTrainers()]);
      await loadUnavailability();
    } catch (error) {
      console.error('Error loading data:', error);
      setNotification({ type: 'error', message: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }

  async function loadTrainerTypes() {
    const { data, error } = await supabase
      .from('trainer_types')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading trainer types:', error);
      return;
    }

    setTrainerTypes(data || []);
  }

  async function loadTrainers() {
    const { data, error } = await supabase
      .from('trainers')
      .select('*')
      .order('display_order', { ascending: true });

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

  async function loadUnavailability() {
    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${daysInMonth(currentYear, currentMonth)}`;

    const data = await getAllTrainersUnavailability(startDate, endDate);
    setUnavailability(data);
  }

  function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  function isWeekend(year: number, month: number, day: number): boolean {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  function changeMonth(delta: number) {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  }

  function formatMonthLabel(): string {
    const date = new Date(currentYear, currentMonth - 1, 1);
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function isTrainerUnavailable(trainerId: string, date: string): TrainerUnavailability | undefined {
    return unavailability.find(u => u.trainer_id === trainerId && u.unavailable_date === date);
  }

  // Handle clicking the provisionally book (tick) button
  async function handleProvisionallyBook(trainer: Trainer, dateStr: string) {
    const unavailableRecord = isTrainerUnavailable(trainer.id, dateStr);

    // If already provisionally booked, clicking tick again removes it
    if (unavailableRecord?.status === 'provisionally_booked') {
      const result = await removeDateUnavailability(unavailableRecord.id);
      if (result.success) {
        setNotification({
          type: 'success',
          message: `${trainer.name} provisional booking removed for ${new Date(dateStr).toLocaleDateString('en-GB')}`,
        });
        await loadUnavailability();
      } else {
        setNotification({ type: 'error', message: result.error || 'Failed to remove provisional booking' });
      }
      return;
    }

    // Check for booking conflicts before setting provisionally booked
    const conflicts = await getBookingConflicts(trainer.id, dateStr, dateStr);
    if (conflicts.length > 0) {
      setConflictingBookings(conflicts);
      setShowConflictWarning(true);
      setPendingAction(() => () => performSetStatus(trainer, dateStr, 'provisionally_booked'));
      return;
    }

    await performSetStatus(trainer, dateStr, 'provisionally_booked');
  }

  // Handle clicking the unavailable (cross) button
  async function handleMarkUnavailable(trainer: Trainer, dateStr: string) {
    const unavailableRecord = isTrainerUnavailable(trainer.id, dateStr);

    // If already unavailable, clicking cross again removes it
    if (unavailableRecord?.status === 'unavailable') {
      const result = await removeDateUnavailability(unavailableRecord.id);
      if (result.success) {
        setNotification({
          type: 'success',
          message: `${trainer.name} marked available on ${new Date(dateStr).toLocaleDateString('en-GB')}`,
        });
        await loadUnavailability();
      } else {
        setNotification({ type: 'error', message: result.error || 'Failed to mark available' });
      }
      return;
    }

    // Check for booking conflicts before marking unavailable
    const conflicts = await getBookingConflicts(trainer.id, dateStr, dateStr);
    if (conflicts.length > 0) {
      setConflictingBookings(conflicts);
      setShowConflictWarning(true);
      setPendingAction(() => () => performSetStatus(trainer, dateStr, 'unavailable'));
      return;
    }

    await performSetStatus(trainer, dateStr, 'unavailable');
  }

  // Perform the status change
  async function performSetStatus(trainer: Trainer, dateStr: string, status: AvailabilityStatus, reason?: string) {
    const result = await setDateAvailabilityStatus(trainer.id, dateStr, status, reason);

    if (result.success) {
      const statusLabel = status === 'provisionally_booked' ? 'provisionally booked' : 'unavailable';
      setNotification({
        type: 'success',
        message: `${trainer.name} marked ${statusLabel} on ${new Date(dateStr).toLocaleDateString('en-GB')}`,
      });
      await loadUnavailability();
    } else {
      setNotification({ type: 'error', message: result.error || 'Failed to update availability' });
    }
  }

  async function handleDayClick(trainer: Trainer, dateStr: string) {
    const unavailableRecord = isTrainerUnavailable(trainer.id, dateStr);

    // If there's an existing record, open modal to edit/remove
    if (unavailableRecord) {
      setSelectedTrainer(trainer);
      setSelectedDate(dateStr);
      setDayReason(unavailableRecord?.reason || '');
      setShowDayModal(true);
      return;
    }

    // For empty cells, the hover UI handles the action selection
    // This fallback opens the modal if clicked directly (not via hover buttons)
    setSelectedTrainer(trainer);
    setSelectedDate(dateStr);
    setDayReason('');
    setShowDayModal(true);
  }

  async function handleDayModalConfirm(status: AvailabilityStatus) {
    if (!selectedTrainer || !selectedDate) return;

    const unavailableRecord = isTrainerUnavailable(selectedTrainer.id, selectedDate);

    // If there's no existing record and we're setting a status, check for conflicts
    if (!unavailableRecord) {
      const conflicts = await getBookingConflicts(selectedTrainer.id, selectedDate, selectedDate);
      if (conflicts.length > 0) {
        setShowDayModal(false);
        setConflictingBookings(conflicts);
        setShowConflictWarning(true);
        setPendingAction(() => () => confirmDayAction(status));
        return;
      }
    }

    await confirmDayAction(status);
  }

  async function confirmDayAction(status: AvailabilityStatus) {
    if (!selectedTrainer || !selectedDate) return;

    await performSetStatus(selectedTrainer, selectedDate, status, dayReason);
    setShowDayModal(false);
    setSelectedTrainer(null);
    setSelectedDate(null);
    setDayReason('');
  }

  async function handleRemoveAvailabilityRecord() {
    if (!selectedTrainer || !selectedDate) return;

    const unavailableRecord = isTrainerUnavailable(selectedTrainer.id, selectedDate);
    if (!unavailableRecord) return;

    const result = await removeDateUnavailability(unavailableRecord.id);
    if (result.success) {
      setNotification({
        type: 'success',
        message: `${selectedTrainer.name} marked available on ${new Date(selectedDate).toLocaleDateString('en-GB')}`,
      });
      await loadUnavailability();
    } else {
      setNotification({ type: 'error', message: result.error || 'Failed to mark available' });
    }

    setShowDayModal(false);
    setSelectedTrainer(null);
    setSelectedDate(null);
    setDayReason('');
  }

  function handleOpenRangeModal(action: 'mark' | 'remove' | 'provisional') {
    setRangeAction(action);
    setRangeTrainerId('');
    setRangeStartDate('');
    setRangeEndDate('');
    setRangeReason('');
    setShowRangeModal(true);
  }

  async function handleRangeSubmit() {
    if (!rangeTrainerId || !rangeStartDate || !rangeEndDate) {
      setNotification({ type: 'warning', message: 'Please fill in all required fields' });
      return;
    }

    const start = new Date(rangeStartDate);
    const end = new Date(rangeEndDate);

    if (start > end) {
      setNotification({ type: 'error', message: 'Start date must be before or equal to end date' });
      return;
    }

    // Check for booking conflicts when marking unavailable or provisional
    if (rangeAction === 'mark' || rangeAction === 'provisional') {
      const conflicts = await getBookingConflicts(rangeTrainerId, rangeStartDate, rangeEndDate);
      if (conflicts.length > 0) {
        setShowRangeModal(false);
        setConflictingBookings(conflicts);
        setShowConflictWarning(true);
        setPendingAction(() => () => confirmRangeAction());
        return;
      }
    }

    await confirmRangeAction();
  }

  async function confirmRangeAction() {
    setProcessingRange(true);

    try {
      const trainer = trainers.find(t => t.id === rangeTrainerId);
      if (!trainer) return;

      let result;
      if (rangeAction === 'mark') {
        result = await markDateRangeUnavailable(rangeTrainerId, rangeStartDate, rangeEndDate, rangeReason);
      } else if (rangeAction === 'provisional') {
        result = await markDateRangeProvisionallyBooked(rangeTrainerId, rangeStartDate, rangeEndDate, rangeReason);
      } else {
        result = await removeDateRangeUnavailability(rangeTrainerId, rangeStartDate, rangeEndDate);
      }

      if (result.success) {
        const start = new Date(rangeStartDate).toLocaleDateString('en-GB');
        const end = new Date(rangeEndDate).toLocaleDateString('en-GB');
        let message = '';
        if (rangeAction === 'mark') {
          message = `${trainer.name} marked unavailable from ${start} to ${end}`;
        } else if (rangeAction === 'provisional') {
          message = `${trainer.name} provisionally booked from ${start} to ${end}`;
        } else {
          message = `${trainer.name} availability restored from ${start} to ${end}`;
        }
        setNotification({ type: 'success', message });
        await loadUnavailability();
        setShowRangeModal(false);
      } else {
        setNotification({ type: 'error', message: result.error || 'Failed to update availability' });
      }
    } catch (error) {
      console.error('Error updating range:', error);
      setNotification({ type: 'error', message: 'Failed to update availability' });
    } finally {
      setProcessingRange(false);
    }
  }

  function handleConflictProceed() {
    setShowConflictWarning(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
    setConflictingBookings([]);
  }

  function handleConflictCancel() {
    setShowConflictWarning(false);
    setPendingAction(null);
    setConflictingBookings([]);
  }

  const days = daysInMonth(currentYear, currentMonth);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const filteredTrainers = trainers.filter(
    trainer => !selectedTrainerType || trainer.assigned_types?.some(at => at.id === selectedTrainerType)
  );

  const totalUnavailableDays = unavailability.length;

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
                  Trainer Availability Management
                </h2>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Manage trainer availability by marking days as unavailable. Click any day to toggle availability,
                or use the range tools to manage multiple days at once.
              </p>

              <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
                <span className="text-xs text-slate-500 uppercase tracking-wider">
                  Calendar View
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
                    <option value="">All Types</option>
                    {trainerTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                <span className="text-sm text-slate-400">
                  {filteredTrainers.length} trainer(s) - {days} day(s)
                </span>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => handleOpenRangeModal('provisional')}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-green-500/20 text-green-400 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors"
                >
                  <CalendarRange className="w-4 h-4" />
                  Provisionally Book Range
                </button>
                <button
                  onClick={() => handleOpenRangeModal('mark')}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
                >
                  <CalendarRange className="w-4 h-4" />
                  Mark Range Unavailable
                </button>
                <button
                  onClick={() => handleOpenRangeModal('remove')}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded hover:bg-slate-500/30 transition-colors"
                >
                  <CalendarRange className="w-4 h-4" />
                  Clear Date Range
                </button>
              </div>
            </div>

            <div className="text-right text-sm space-y-2">
              <div className="flex items-center justify-end gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">
                  System Status
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
                <span>{totalUnavailableDays} unavailable day(s)</span>
              </div>
              <div className="flex items-center justify-end gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-900/40 border border-green-700/50 rounded"></div>
                  <span>Provisionally Booked</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-900/40 border border-red-700/50 rounded"></div>
                  <span>Unavailable</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-slate-900/50 border border-slate-800 rounded"></div>
                  <span>Weekend</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-slate-950 border border-slate-800 rounded"></div>
                  <span>Available</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[500px]">
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
                  {filteredTrainers.map((trainer, trainerIndex) => (
                    <div
                      key={trainer.id}
                      className={`flex ${trainerIndex % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-900/80'}`}
                    >
                      <div className="w-40 px-3 py-2 border-r border-b border-slate-800 font-medium text-sm sticky left-0 bg-inherit">
                        {trainer.name}
                      </div>
                      <div className="flex relative">
                        {Array.from({ length: days }, (_, i) => {
                          const day = i + 1;
                          const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const weekend = isWeekend(currentYear, currentMonth, day);
                          const unavailableRecord = isTrainerUnavailable(trainer.id, dateStr);
                          const isUnavailable = unavailableRecord?.status === 'unavailable';
                          const isProvisionallyBooked = unavailableRecord?.status === 'provisionally_booked';
                          const hasRecord = !!unavailableRecord;
                          const isToday = dateStr === todayStr;
                          const isHovered = hoveredCell?.trainerId === trainer.id && hoveredCell?.date === dateStr;

                          return (
                            <div
                              key={day}
                              className={`w-[120px] min-h-[60px] border-r border-b relative ${
                                isUnavailable
                                  ? 'bg-red-900/40 border-red-700/50'
                                  : isProvisionallyBooked
                                  ? 'bg-green-900/40 border-green-700/50'
                                  : weekend
                                  ? 'bg-slate-900/50 border-slate-800'
                                  : 'border-slate-800'
                              } ${isToday ? 'ring-1 ring-blue-500 ring-inset' : ''} ${
                                !hasRecord && !isHovered ? 'hover:bg-slate-800/50' : ''
                              } cursor-pointer transition-colors`}
                              onMouseEnter={() => setHoveredCell({ trainerId: trainer.id, date: dateStr })}
                              onMouseLeave={() => setHoveredCell(null)}
                              onClick={() => hasRecord && handleDayClick(trainer, dateStr)}
                              title={
                                isUnavailable && unavailableRecord?.reason
                                  ? `Unavailable: ${unavailableRecord.reason}`
                                  : isUnavailable
                                  ? 'Unavailable - Click to edit'
                                  : isProvisionallyBooked && unavailableRecord?.reason
                                  ? `Provisionally Booked: ${unavailableRecord.reason}`
                                  : isProvisionallyBooked
                                  ? 'Provisionally Booked - Click to edit'
                                  : 'Hover to set availability'
                              }
                            >
                              {/* Show icon for existing records */}
                              {isUnavailable && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <X className="w-10 h-10 text-red-400 stroke-[3]" />
                                </div>
                              )}
                              {isProvisionallyBooked && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <Check className="w-10 h-10 text-green-400 stroke-[3]" />
                                </div>
                              )}

                              {/* Hover UI with tick/cross buttons */}
                              {isHovered && !hasRecord && (
                                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-800/80">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleProvisionallyBook(trainer, dateStr);
                                    }}
                                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-green-500/20 hover:bg-green-500/40 border border-green-500/50 transition-colors"
                                    title="Provisionally book"
                                  >
                                    <Check className="w-6 h-6 text-green-400" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkUnavailable(trainer, dateStr);
                                    }}
                                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 transition-colors"
                                    title="Mark unavailable"
                                  >
                                    <X className="w-6 h-6 text-red-400" />
                                  </button>
                                </div>
                              )}

                              {/* Hover UI for existing records - show option to toggle or edit */}
                              {isHovered && hasRecord && (
                                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-800/80">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleProvisionallyBook(trainer, dateStr);
                                    }}
                                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                                      isProvisionallyBooked
                                        ? 'bg-green-500/40 border-2 border-green-400'
                                        : 'bg-green-500/20 hover:bg-green-500/40 border border-green-500/50'
                                    }`}
                                    title={isProvisionallyBooked ? "Remove provisional booking" : "Change to provisionally booked"}
                                  >
                                    <Check className="w-6 h-6 text-green-400" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkUnavailable(trainer, dateStr);
                                    }}
                                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                                      isUnavailable
                                        ? 'bg-red-500/40 border-2 border-red-400'
                                        : 'bg-red-500/20 hover:bg-red-500/40 border border-red-500/50'
                                    }`}
                                    title={isUnavailable ? "Mark available" : "Change to unavailable"}
                                  >
                                    <X className="w-6 h-6 text-red-400" />
                                  </button>
                                </div>
                              )}
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
        </div>
      </main>

      {showDayModal && selectedTrainer && selectedDate && (() => {
        const record = isTrainerUnavailable(selectedTrainer.id, selectedDate);
        const currentStatus = record?.status;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-semibold text-white">Manage Availability</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {selectedTrainer.name} - {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDayModal(false);
                    setSelectedTrainer(null);
                    setSelectedDate(null);
                    setDayReason('');
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Current status indicator */}
                {currentStatus && (
                  <div className={`p-3 rounded border ${
                    currentStatus === 'unavailable'
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-green-500/10 border-green-500/30 text-green-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      {currentStatus === 'unavailable' ? (
                        <X className="w-5 h-5" />
                      ) : (
                        <Check className="w-5 h-5" />
                      )}
                      <span className="font-medium">
                        Currently: {currentStatus === 'unavailable' ? 'Unavailable' : 'Provisionally Booked'}
                      </span>
                    </div>
                    {record?.reason && (
                      <p className="mt-1 text-sm opacity-80">Reason: {record.reason}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={dayReason}
                    onChange={(e) => setDayReason(e.target.value)}
                    placeholder="e.g., Holiday, Sick Leave, Reserved for client"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 p-6 border-t border-slate-800">
                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDayModalConfirm('provisionally_booked')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded transition-colors ${
                      currentStatus === 'provisionally_booked'
                        ? 'bg-green-500/30 text-green-300 border-2 border-green-400'
                        : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Provisionally Book
                  </button>
                  <button
                    onClick={() => handleDayModalConfirm('unavailable')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded transition-colors ${
                      currentStatus === 'unavailable'
                        ? 'bg-red-500/30 text-red-300 border-2 border-red-400'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                    }`}
                  >
                    <X className="w-4 h-4" />
                    Mark Unavailable
                  </button>
                </div>

                {/* Bottom row: Cancel and Clear */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDayModal(false);
                      setSelectedTrainer(null);
                      setSelectedDate(null);
                      setDayReason('');
                    }}
                    className="flex-1 px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  {currentStatus && (
                    <button
                      onClick={handleRemoveAvailabilityRecord}
                      className="flex-1 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded transition-colors"
                    >
                      Clear (Mark Available)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showRangeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-white">
                {rangeAction === 'provisional' ? 'Provisionally Book Date Range' : rangeAction === 'mark' ? 'Mark Date Range Unavailable' : 'Clear Date Range'}
              </h2>
              <button
                onClick={() => setShowRangeModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Trainer *
                </label>
                <select
                  value={rangeTrainerId}
                  onChange={(e) => setRangeTrainerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white focus:border-blue-500 outline-none"
                >
                  <option value="">Select a trainer</option>
                  {trainers.map(trainer => (
                    <option key={trainer.id} value={trainer.id}>{trainer.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={rangeStartDate}
                  onChange={(e) => setRangeStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  value={rangeEndDate}
                  onChange={(e) => setRangeEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white focus:border-blue-500 outline-none"
                />
              </div>

              {(rangeAction === 'mark' || rangeAction === 'provisional') && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={rangeReason}
                    onChange={(e) => setRangeReason(e.target.value)}
                    placeholder={rangeAction === 'provisional' ? "e.g., Reserved for client, Tentative booking" : "e.g., Holiday, Training"}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}

              {rangeStartDate && rangeEndDate && new Date(rangeStartDate) <= new Date(rangeEndDate) && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-blue-400">
                  {(() => {
                    const start = new Date(rangeStartDate);
                    const end = new Date(rangeEndDate);
                    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    return `${dayCount} day(s) will be affected`;
                  })()}
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-800">
              <button
                onClick={() => setShowRangeModal(false)}
                disabled={processingRange}
                className="flex-1 px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleRangeSubmit}
                disabled={processingRange || !rangeTrainerId || !rangeStartDate || !rangeEndDate}
                className={`flex-1 px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  rangeAction === 'mark'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                    : rangeAction === 'provisional'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                    : 'bg-slate-500/20 text-slate-300 border border-slate-500/30 hover:bg-slate-500/30'
                }`}
              >
                {processingRange ? 'Processing...' : rangeAction === 'mark' ? 'Mark Unavailable' : rangeAction === 'provisional' ? 'Provisionally Book' : 'Clear Range'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConflictWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-md w-full">
            <div className="flex items-center gap-3 p-6 border-b border-slate-800">
              <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-semibold text-white">Booking Conflicts Detected</h2>
                <p className="text-sm text-slate-400 mt-1">
                  The following bookings exist on the selected date(s)
                </p>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-2 mb-4">
                {conflictingBookings.map(booking => (
                  <div key={booking.id} className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm">
                    <div className="font-medium text-yellow-400">{booking.title}</div>
                    <div className="text-slate-400">
                      {new Date(booking.booking_date).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-400">
                Do you want to proceed with marking these dates as unavailable despite the conflicts?
              </p>
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-800">
              <button
                onClick={handleConflictCancel}
                className="flex-1 px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConflictProceed}
                className="flex-1 px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded hover:bg-yellow-500/30 transition-colors"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
