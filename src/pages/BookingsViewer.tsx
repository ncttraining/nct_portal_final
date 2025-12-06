import { useState, useEffect } from 'react';
import { Calendar, MapPin, User, Users, Clock, X, Search, Filter, Eye, History } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { getBookingsForUser, getUserAuthorizedTrainerIds, BookingWithDetails } from '../lib/bookings-permissions';
import { supabase } from '../lib/supabase';

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

interface BookingsViewerProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface Trainer {
  id: string;
  name: string;
}

const STATUS_COLORS = {
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  provisional: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  hold: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function BookingsViewer({ currentPage, onNavigate }: BookingsViewerProps) {
  const { user, profile } = useAuth();
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingWithDetails[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<string>('all');
  const [showHistoric, setShowHistoric] = useState(false);
  const [authorizedTrainerCount, setAuthorizedTrainerCount] = useState(0);

  useEffect(() => {
    if (user?.id && profile?.can_view_bookings) {
      loadData();
    }
  }, [user?.id, profile?.can_view_bookings]);

  useEffect(() => {
    applyFilters();
  }, [bookings, searchTerm, selectedTrainer, showHistoric]);

  async function loadData() {
    if (!user?.id) return;

    setLoading(true);
    try {
      const [bookingsData, authorizedTrainerIds] = await Promise.all([
        getBookingsForUser(user.id, {}),
        getUserAuthorizedTrainerIds(user.id)
      ]);

      setBookings(bookingsData);
      setAuthorizedTrainerCount(authorizedTrainerIds.length);

      if (authorizedTrainerIds.length > 0) {
        const { data: trainersData } = await supabase
          .from('trainers')
          .select('id, name')
          .in('id', authorizedTrainerIds)
          .eq('suspended', false)
          .order('name');

        if (trainersData) {
          setTrainers(trainersData);
        }
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...bookings];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!showHistoric) {
      filtered = filtered.filter(b => {
        const bookingDate = new Date(b.booking_date);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate >= today;
      });
    }

    if (selectedTrainer !== 'all') {
      filtered = filtered.filter(b => b.trainer_id === selectedTrainer);
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(b =>
        b.title?.toLowerCase().includes(searchLower) ||
        b.client_name?.toLowerCase().includes(searchLower) ||
        b.location?.toLowerCase().includes(searchLower) ||
        b.trainer?.name?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredBookings(filtered);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatTime(timeString: string) {
    if (!timeString) return '';
    return timeString.slice(0, 5);
  }

  if (!profile?.can_view_bookings) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-6">You do not have permission to view bookings.</p>
          <button
            onClick={() => onNavigate('home')}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />
      <div className="border-b border-slate-800 px-6 py-3 bg-slate-900/50">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <p className="text-sm text-slate-400">
            {profile?.role === 'admin'
              ? 'Viewing all bookings (Admin Access)'
              : `Viewing bookings for ${authorizedTrainerCount} trainer${authorizedTrainerCount !== 1 ? 's' : ''}`
            }
          </p>
          <button
            onClick={() => setShowHistoric(!showHistoric)}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              showHistoric
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            {showHistoric ? 'Show Upcoming Only' : 'Show All Bookings'}
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by course, client, location, or trainer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedTrainer}
                onChange={(e) => setSelectedTrainer(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Trainers</option>
                {trainers.map(trainer => (
                  <option key={trainer.id} value={trainer.id}>{trainer.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-400">Loading bookings...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No bookings found</h3>
            <p className="text-slate-400">
              {bookings.length === 0
                ? 'There are no bookings for the trainers you have access to.'
                : showHistoric
                ? 'No bookings match your current filters.'
                : 'No upcoming bookings match your current filters. Try showing historic bookings.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-slate-400 mb-2">
              Showing {filteredBookings.length} {showHistoric ? '' : 'upcoming '}booking{filteredBookings.length !== 1 ? 's' : ''}
            </div>
            {filteredBookings.map(booking => (
              <div
                key={booking.id}
                onClick={() => setSelectedBooking(booking)}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{decodeHtmlEntities(booking.title)}</h3>
                      <span className={`px-2 py-0.5 text-xs border rounded ${STATUS_COLORS[booking.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.confirmed}`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(booking.booking_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{formatTime(booking.start_time)} • {booking.num_days} day{booking.num_days !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{booking.trainer?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{booking.client_name}</span>
                      </div>
                      {booking.location && (
                        <div className="flex items-center gap-2 col-span-2">
                          <MapPin className="w-4 h-4" />
                          <span>{booking.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                    title="View details"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
                {booking.candidates && booking.candidates.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                    {booking.candidates.length} candidate{booking.candidates.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
}

interface BookingDetailsModalProps {
  booking: BookingWithDetails;
  onClose: () => void;
}

function BookingDetailsModal({ booking, onClose }: BookingDetailsModalProps) {
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatTime(timeString: string) {
    if (!timeString) return '';
    return timeString.slice(0, 5);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-semibold mb-1">{decodeHtmlEntities(booking.title)}</h2>
            <p className="text-sm text-slate-400">{formatDate(booking.booking_date)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Booking Details
              </h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-slate-500">Status</span>
                  <div className="mt-1">
                    <span className={`px-2 py-1 text-xs border rounded ${STATUS_COLORS[booking.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.confirmed}`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Date</span>
                  <p className="text-sm">{formatDate(booking.booking_date)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Time</span>
                  <p className="text-sm">{formatTime(booking.start_time)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Duration</span>
                  <p className="text-sm">{booking.num_days} day{booking.num_days !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Trainer</span>
                  <p className="text-sm">{booking.trainer?.name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Location Type</span>
                  <p className="text-sm">{booking.in_centre ? 'In Centre' : 'On Site'}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Client Information
              </h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-slate-500">Company</span>
                  <p className="text-sm">{booking.client_name || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Contact Person</span>
                  <p className="text-sm">{booking.client_contact_name || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Email</span>
                  <p className="text-sm">{booking.client_email || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Telephone</span>
                  <p className="text-sm">{booking.client_telephone || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {booking.location && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Location
              </h3>
              <p className="text-sm">{booking.location}</p>
            </div>
          )}

          {booking.notes && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Internal Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap bg-slate-800/50 p-3 rounded border border-slate-700">
                {booking.notes}
              </p>
            </div>
          )}

          {booking.candidates && booking.candidates.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Candidates ({booking.candidates.length})
              </h3>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400">Name</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400">Telephone</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booking.candidates.map((candidate, index) => (
                      <tr key={candidate.id || index} className="border-b border-slate-700/50 last:border-0">
                        <td className="px-4 py-2 text-sm">{candidate.candidate_name}</td>
                        <td className="px-4 py-2 text-sm text-slate-400">{candidate.telephone || '-'}</td>
                        <td className="px-4 py-2 text-sm text-slate-400">{candidate.email || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
