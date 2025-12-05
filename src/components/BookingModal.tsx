import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Mail, Award, Send, AlertTriangle, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCourseTypes, CourseType } from '../lib/certificates';
import { sendBookingConfirmationEmail, sendCandidateBookingConfirmationEmail } from '../lib/email';
import { sendNewBookingNotification, sendBookingUpdatedNotification } from '../lib/booking-notifications';
import { getAvailableCourseTypesForTrainer, validateTrainerForCourse } from '../lib/trainer-types';
import { getActiveTrainingCentres, getActiveRoomsForCentre, getUnavailableRoomIds, TrainingCentre, TrainingCentreRoom } from '../lib/training-centres';

interface Trainer {
  id: string;
  name: string;
}

interface ClientLocation {
  id: string;
  client_id: string;
  location_name: string;
  address1: string;
  address2: string;
  town: string;
  postcode: string;
  contact_name: string;
  contact_email: string;
  contact_telephone: string;
  notes: string;
  is_default: boolean;
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
  passed?: boolean;
}

interface Booking {
  id?: string;
  trainer_id: string;
  booking_date: string;
  start_time: string;
  title: string;
  location: string;
  location_id?: string;
  client_id?: string;
  client_name: string;
  client_contact_name: string;
  client_email: string;
  client_telephone: string;
  notes: string;
  status: 'confirmed' | 'provisional' | 'hold' | 'cancelled';
  in_centre: boolean;
  num_days: number;
  course_type_id?: string;
  centre_id?: string;
  room_id?: string;
  candidates?: BookingCandidate[];
}

interface BookingModalProps {
  booking: Booking | null;
  trainer: Trainer | null;
  date: string | null;
  clients: Client[];
  onDelete: (bookingId: string) => Promise<void>;
  onClose: () => void;
  onClientCreated?: () => Promise<void>;
}

export default function BookingModal({
  booking,
  trainer,
  date,
  clients,
  onDelete,
  onClose,
  onClientCreated
}: BookingModalProps) {
  const [formData, setFormData] = useState<Partial<Booking>>({
    trainer_id: trainer?.id || '',
    booking_date: date || '',
    start_time: '09:00',
    title: '',
    location: '',
    client_name: '',
    client_contact_name: '',
    client_email: '',
    client_telephone: '',
    notes: '',
    status: 'confirmed',
    in_centre: false,
    num_days: 1,
    course_type_id: undefined,
    centre_id: undefined,
    room_id: undefined
  });

  const [candidates, setCandidates] = useState<BookingCandidate[]>([]);
  const [clientLocations, setClientLocations] = useState<ClientLocation[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [availableCourseTypes, setAvailableCourseTypes] = useState<string[]>([]);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingCandidateEmail, setSendingCandidateEmail] = useState<{[key: number]: boolean}>({});
  const [candidateEmailSent, setCandidateEmailSent] = useState<{[key: number]: boolean}>({});
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);

  // Training centre state
  const [trainingCentres, setTrainingCentres] = useState<TrainingCentre[]>([]);
  const [availableRooms, setAvailableRooms] = useState<TrainingCentreRoom[]>([]);
  const [unavailableRoomIds, setUnavailableRoomIds] = useState<string[]>([]);

  useEffect(() => {
    loadCourseTypes();
    loadTrainingCentres();
    if (trainer?.id) {
      loadTrainerCourseTypes();
    }
  }, [trainer?.id]);

  // Load rooms when centre is selected
  useEffect(() => {
    if (formData.centre_id) {
      loadRoomsForCentre(formData.centre_id);
    } else {
      setAvailableRooms([]);
      setUnavailableRoomIds([]);
    }
  }, [formData.centre_id]);

  // Check room availability when date, num_days, or centre changes
  useEffect(() => {
    if (formData.centre_id && formData.booking_date && formData.num_days) {
      checkRoomAvailability();
    }
  }, [formData.centre_id, formData.booking_date, formData.num_days]);

  async function loadCourseTypes() {
    const types = await getCourseTypes();
    setCourseTypes(types);
  }

  async function loadTrainingCentres() {
    try {
      const centres = await getActiveTrainingCentres();
      setTrainingCentres(centres);
    } catch (err) {
      console.error('Error loading training centres:', err);
    }
  }

  async function loadRoomsForCentre(centreId: string) {
    try {
      const rooms = await getActiveRoomsForCentre(centreId);
      setAvailableRooms(rooms);
    } catch (err) {
      console.error('Error loading rooms:', err);
    }
  }

  async function checkRoomAvailability() {
    if (!formData.centre_id || !formData.booking_date || !formData.num_days) return;

    try {
      const unavailable = await getUnavailableRoomIds(
        formData.centre_id,
        formData.booking_date,
        formData.num_days,
        formData.id // Exclude current booking when editing
      );
      setUnavailableRoomIds(unavailable);
    } catch (err) {
      console.error('Error checking room availability:', err);
    }
  }

  async function loadTrainerCourseTypes() {
    if (!trainer?.id) return;
    try {
      const types = await getAvailableCourseTypesForTrainer(trainer.id);
      setAvailableCourseTypes(types.map(t => t.id));
    } catch (err) {
      console.error('Error loading trainer course types:', err);
    }
  }

  useEffect(() => {
    if (formData.course_type_id && formData.trainer_id) {
      checkCourseTypeValidity();
    } else {
      setValidationWarning(null);
    }
  }, [formData.course_type_id, formData.trainer_id]);

  async function checkCourseTypeValidity() {
    if (!formData.course_type_id || !formData.trainer_id) return;

    try {
      const isValid = await validateTrainerForCourse(formData.trainer_id, formData.course_type_id);
      if (!isValid) {
        const courseType = courseTypes.find(ct => ct.id === formData.course_type_id);
        setValidationWarning(`Warning: ${trainer?.name || 'This trainer'} is not qualified to teach ${courseType?.name || 'this course type'}. Please verify before saving.`);
      } else {
        setValidationWarning(null);
      }
    } catch (err) {
      console.error('Error validating trainer for course:', err);
    }
  }

  useEffect(() => {
    if (booking) {
      setFormData({
        id: booking.id,
        trainer_id: booking.trainer_id,
        booking_date: booking.booking_date,
        start_time: booking.start_time || '09:00',
        title: booking.title,
        location: booking.location,
        location_id: booking.location_id,
        client_id: booking.client_id,
        client_name: booking.client_name,
        client_contact_name: booking.client_contact_name,
        client_email: booking.client_email,
        client_telephone: booking.client_telephone,
        notes: booking.notes,
        status: booking.status,
        in_centre: booking.in_centre,
        num_days: booking.num_days,
        course_type_id: booking.course_type_id,
        centre_id: booking.centre_id,
        room_id: booking.room_id
      });

      if (booking.client_id) {
        loadClientLocations(booking.client_id);
      }

      if (booking.candidates && booking.candidates.length > 0) {
        setCandidates(booking.candidates);
      } else {
        setCandidates([createEmptyCandidate()]);
      }
    } else {
      setCandidates([createEmptyCandidate()]);
    }
  }, [booking]);

  function createEmptyCandidate(): BookingCandidate {
    return {
      candidate_name: '',
      telephone: '',
      email: '',
      paid: false,
      outstanding_balance: 0,
      passed: false
    };
  }

  async function loadClientLocations(clientId: string) {
    const { data, error } = await supabase
      .from('client_locations')
      .select('*')
      .eq('client_id', clientId)
      .order('is_default', { ascending: false })
      .order('location_name', { ascending: true });

    if (error) {
      console.error('Error loading client locations:', error);
      return;
    }

    setClientLocations(data || []);
  }

  function handleClientNameChange(clientName: string) {
    setFormData(prev => ({ ...prev, client_name: clientName, location_id: undefined }));

    if (clientName.trim().length > 0) {
      const filtered = clients.filter(c =>
        c.name.toLowerCase().includes(clientName.toLowerCase())
      );
      setFilteredClients(filtered);
      setShowClientSuggestions(true);
    } else {
      setShowClientSuggestions(false);
      setClientLocations([]);
    }
  }

  function selectClient(client: Client) {
    setFormData(prev => ({
      ...prev,
      client_id: client.id,
      client_name: client.name,
      client_contact_name: client.contact_name,
      client_email: client.email,
      client_telephone: client.telephone,
      location_id: undefined,
      location: ''
    }));
    setShowClientSuggestions(false);
    loadClientLocations(client.id);
  }

  async function handleTitleChange(title: string) {
    setFormData(prev => ({ ...prev, title }));

    if (title.trim().length > 0) {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('title')
          .ilike('title', `%${title}%`)
          .limit(10);

        if (!error && data) {
          const uniqueTitles = [...new Set(data.map(b => b.title))].filter(t => t && t.trim());
          setTitleSuggestions(uniqueTitles);
          setShowTitleSuggestions(uniqueTitles.length > 0);
        }
      } catch (err) {
        console.error('Error fetching title suggestions:', err);
      }
    } else {
      setShowTitleSuggestions(false);
    }
  }

  function selectTitle(title: string) {
    setFormData(prev => ({ ...prev, title }));
    setShowTitleSuggestions(false);
  }

  function handleLocationChange(locationId: string) {
    const location = clientLocations.find(l => l.id === locationId);
    if (location) {
      setFormData(prev => ({
        ...prev,
        location_id: locationId,
        location: `${location.location_name}, ${location.town}`,
        client_contact_name: location.contact_name || prev.client_contact_name,
        client_email: location.contact_email || prev.client_email,
        client_telephone: location.contact_telephone || prev.client_telephone
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        location_id: undefined,
        location: ''
      }));
    }
  }

  function addCandidate() {
    setCandidates([...candidates, createEmptyCandidate()]);
  }

  function removeCandidate(index: number) {
    setCandidates(candidates.filter((_, i) => i !== index));
  }

  function updateCandidate(index: number, field: keyof BookingCandidate, value: any) {
    const updated = [...candidates];
    updated[index] = { ...updated[index], [field]: value };
    setCandidates(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.title?.trim()) {
      alert('Please enter a course description');
      return;
    }

    setSaving(true);

    try {
      let clientIdToSave = formData.client_id;

      if (formData.client_name?.trim() && !formData.client_id) {
        const existingClient = clients.find(
          c => c.name.toLowerCase() === formData.client_name.toLowerCase()
        );

        if (existingClient) {
          console.log('Found existing client:', existingClient);
          clientIdToSave = existingClient.id;
        } else {
          console.log('Creating new client:', formData.client_name);
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert([{
              name: formData.client_name,
              contact_name: formData.client_contact_name || '',
              email: formData.client_email || '',
              telephone: formData.client_telephone || ''
            }])
            .select()
            .single();

          if (clientError) {
            console.error('Error creating client:', clientError);
            throw clientError;
          }
          console.log('New client created:', newClient);
          clientIdToSave = newClient.id;

          if (onClientCreated) {
            await onClientCreated();
          }
        }
      }

      let locationIdToSave = formData.location_id;

      if (clientIdToSave && formData.location?.trim() && !formData.location_id) {
        const existingLocation = clientLocations.find(
          loc => `${loc.location_name}, ${loc.town}`.toLowerCase() === formData.location.toLowerCase() ||
                 loc.location_name.toLowerCase() === formData.location.toLowerCase()
        );

        if (existingLocation) {
          console.log('Found existing location:', existingLocation);
          locationIdToSave = existingLocation.id;
        } else {
          console.log('Creating new location:', formData.location);
          const { data: newLocation, error: locationError } = await supabase
            .from('client_locations')
            .insert([{
              client_id: clientIdToSave,
              location_name: formData.location,
              address1: formData.location,
              address2: '',
              town: '',
              postcode: '',
              contact_name: formData.client_contact_name || '',
              contact_email: formData.client_email || '',
              contact_telephone: formData.client_telephone || '',
              is_default: false
            }])
            .select()
            .single();

          if (locationError) {
            console.error('Error creating location:', locationError);
            throw locationError;
          }
          console.log('New location created:', newLocation);
          locationIdToSave = newLocation.id;
        }
      }

      const { candidates: _, ...bookingToSave } = {
        ...formData,
        client_id: clientIdToSave,
        location_id: locationIdToSave
      } as any;

      let bookingId = formData.id || booking?.id;
      const isNewBooking = !bookingId;
      let oldBooking = null;

      if (bookingId) {
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .maybeSingle();

        oldBooking = existingBooking;

        const { error } = await supabase
          .from('bookings')
          .update(bookingToSave)
          .eq('id', bookingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('bookings')
          .insert([bookingToSave])
          .select()
          .single();

        if (error) throw error;
        bookingId = data.id;
      }

      if (bookingId) {
        await supabase
          .from('booking_candidates')
          .delete()
          .eq('booking_id', bookingId);

        const validCandidates = candidates.filter(
          c => c.candidate_name.trim() || c.email.trim() || c.telephone.trim()
        );

        if (validCandidates.length > 0) {
          const candidatesToInsert = validCandidates.map(c => ({
            booking_id: bookingId,
            candidate_name: c.candidate_name,
            telephone: c.telephone,
            email: c.email,
            paid: c.paid,
            outstanding_balance: c.outstanding_balance,
            passed: c.passed || false
          }));

          await supabase
            .from('booking_candidates')
            .insert(candidatesToInsert);
        }
      }

      if (isNewBooking) {
        await sendNewBookingNotification(bookingToSave as any, bookingId as string);
      } else if (oldBooking) {
        await sendBookingUpdatedNotification(oldBooking as any, bookingToSave as any, bookingId as string);
      }

      onClose();
    } catch (error) {
      console.error('Error saving booking:', error);
      alert('Failed to save booking');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!booking?.id) return;
    if (!confirm('Delete this booking?')) return;

    setDeleting(true);

    try {
      await onDelete(booking.id);
    } catch (error) {
      console.error('Error deleting booking:', error);
      alert('Failed to delete booking');
    } finally {
      setDeleting(false);
    }
  }

  async function handleEmailClient() {
    if (!formData.client_email) {
      alert('No client email address available');
      return;
    }

    if (!formData.client_contact_name) {
      alert('No client contact name available');
      return;
    }

    setSendingEmail(true);
    setEmailSent(false);

    try {
      const courseType = courseTypes.find(ct => ct.id === formData.course_type_id);
      const durationText = formData.num_days === 1 ? '1 day' : `${formData.num_days} days`;
      const location = formData.in_centre ? 'In-centre (NCT training centre)' : (formData.location || 'Not specified');

      const candidatesList = candidates
        .filter(c => c.candidate_name.trim() !== '')
        .map(c => ({
          name: c.candidate_name,
          email: c.email || 'Not provided',
          telephone: c.telephone || 'Not provided'
        }));

      const success = await sendBookingConfirmationEmail(
        formData.client_email,
        {
          contact_name: formData.client_contact_name,
          course_title: formData.title || 'Course Booking',
          course_type: courseType?.name || 'Not specified',
          trainer_name: trainer?.name || 'Not specified',
          booking_date: new Date(formData.booking_date || '').toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          duration: durationText,
          location: location,
          notes: formData.notes,
          candidates: candidatesList.length > 0 ? candidatesList : undefined
        }
      );

      if (success) {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 3000);
      } else {
        alert('Failed to send email. Please try again.');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleEmailCandidate(candidateIndex: number) {
    const candidate = candidates[candidateIndex];

    if (!candidate.email) {
      alert('No email address for this candidate');
      return;
    }

    if (!candidate.candidate_name) {
      alert('Candidate name is required');
      return;
    }

    setSendingCandidateEmail(prev => ({ ...prev, [candidateIndex]: true }));
    setCandidateEmailSent(prev => ({ ...prev, [candidateIndex]: false }));

    try {
      const courseType = courseTypes.find(ct => ct.id === formData.course_type_id);
      const durationText = formData.num_days === 1 ? '1 day' : `${formData.num_days} days`;
      const location = formData.in_centre ? 'In-centre (NCT training centre)' : (formData.location || 'Not specified');

      const success = await sendCandidateBookingConfirmationEmail(
        candidate.email,
        {
          candidate_name: candidate.candidate_name,
          course_title: formData.title || 'Course Booking',
          course_type: courseType?.name || 'Not specified',
          trainer_name: trainer?.name || 'Not specified',
          booking_date: new Date(formData.booking_date || '').toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          duration: durationText,
          location: location,
          client_name: formData.client_name,
          notes: formData.notes
        }
      );

      if (success) {
        setCandidateEmailSent(prev => ({ ...prev, [candidateIndex]: true }));
        setTimeout(() => {
          setCandidateEmailSent(prev => ({ ...prev, [candidateIndex]: false }));
        }, 3000);
      } else {
        alert('Failed to send email. Please try again.');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setSendingCandidateEmail(prev => ({ ...prev, [candidateIndex]: false }));
    }
  }

  function getCertificateStatus() {
    if (!booking || !candidates || candidates.length === 0) return null;

    const passedCandidates = candidates.filter(c => c.passed);

    if (passedCandidates.length === 0) {
      return (
        <div className="flex items-center gap-1 text-xs">
          <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
          <span className="text-slate-500">No passed candidates</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-xs">
        <Award className="w-3 h-3 text-amber-500" />
        <span className="text-amber-400">{passedCandidates.length} candidate{passedCandidates.length > 1 ? 's' : ''} ready for certificates</span>
      </div>
    );
  }

  const friendlyDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '';

  return (
    <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-wide">
              {booking ? 'Edit Booking' : 'New Booking'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {booking ? `Edit booking - starts ${friendlyDate}` : `Create a new booking - ${friendlyDate}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Trainer
              </label>
              <input
                type="text"
                value={trainer?.name || ''}
                disabled
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm text-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Course Type
              </label>
              <select
                value={formData.course_type_id || ''}
                onChange={(e) => setFormData({ ...formData, course_type_id: e.target.value || undefined })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              >
                <option value="">Select course type...</option>
                {courseTypes
                  .filter(type => availableCourseTypes.includes(type.id))
                  .map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
              </select>
              {validationWarning && (
                <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-yellow-300">{validationWarning}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={formData.booking_date}
                onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
              Course / Job Description
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onFocus={() => formData.title && handleTitleChange(formData.title)}
                onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 250)}
                placeholder="e.g. 3 x B1 refresher - Triumph Stoke"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
                required
              />
              {showTitleSuggestions && titleSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border-2 border-blue-500 rounded shadow-2xl max-h-60 overflow-y-auto">
                  {titleSuggestions.map((title, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectTitle(title)}
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0 text-white"
                    >
                      {title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Client
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleClientNameChange(e.target.value)}
                  onFocus={() => formData.client_name && handleClientNameChange(formData.client_name)}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 250)}
                  placeholder="Start typing to search clients"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
                />
                {showClientSuggestions && filteredClients.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-800 border-2 border-blue-500 rounded shadow-2xl max-h-60 overflow-y-auto">
                    {filteredClients.map(client => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => selectClient(client)}
                        className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
                      >
                        <div className="font-semibold text-white">{client.name}</div>
                        {client.contact_name && (
                          <div className="text-xs text-slate-300 mt-0.5">{client.contact_name}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {clientLocations.length > 0 && (
                <>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2 mt-3">
                    Saved Locations
                  </label>
                  <select
                    value={formData.location_id || ''}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
                  >
                    <option value="">Select a saved location...</option>
                    {clientLocations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.location_name} - {loc.town} {loc.is_default ? '⭐ Default' : ''}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {!formData.in_centre && (
                <>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2 mt-3">
                    Location / Address
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value, location_id: undefined })}
                    placeholder="e.g. Triumph Stoke"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Custom locations will be saved automatically for this client
                  </p>
                </>
              )}

              <label className="flex items-center gap-2 mt-3 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={formData.in_centre}
                  onChange={(e) => setFormData({
                    ...formData,
                    in_centre: e.target.checked,
                    centre_id: e.target.checked ? formData.centre_id : undefined,
                    room_id: e.target.checked ? formData.room_id : undefined,
                    location: e.target.checked ? '' : formData.location,
                    location_id: e.target.checked ? undefined : formData.location_id
                  })}
                  className="rounded"
                />
                In-centre (NCT training centre)
              </label>

              {formData.in_centre && (
                <div className="mt-3 space-y-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                      Training Centre *
                    </label>
                    <select
                      value={formData.centre_id || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        centre_id: e.target.value || undefined,
                        room_id: undefined // Reset room when centre changes
                      })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
                      required={formData.in_centre}
                    >
                      <option value="">Select training centre...</option>
                      {trainingCentres.map(centre => (
                        <option key={centre.id} value={centre.id}>
                          {centre.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.centre_id && (
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                        Room *
                      </label>
                      <select
                        value={formData.room_id || ''}
                        onChange={(e) => setFormData({ ...formData, room_id: e.target.value || undefined })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
                        required={formData.in_centre}
                      >
                        <option value="">Select room...</option>
                        {availableRooms.map(room => {
                          const isUnavailable = unavailableRoomIds.includes(room.id);
                          return (
                            <option
                              key={room.id}
                              value={room.id}
                              disabled={isUnavailable}
                              style={{ color: isUnavailable ? '#64748b' : undefined }}
                            >
                              {room.room_name} (Capacity: {room.capacity}) {isUnavailable ? '- OCCUPIED' : ''}
                            </option>
                          );
                        })}
                      </select>

                      {formData.room_id && (
                        <div className="mt-2 p-2 bg-slate-900 border border-slate-700 rounded">
                          {(() => {
                            const selectedRoom = availableRooms.find(r => r.id === formData.room_id);
                            if (!selectedRoom) return null;
                            return (
                              <div className="text-xs space-y-1">
                                <div className="flex items-start gap-2">
                                  <Info className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-slate-300"><span className="text-slate-500">Capacity:</span> {selectedRoom.capacity} people</p>
                                    {selectedRoom.equipment && (
                                      <p className="text-slate-300 mt-1"><span className="text-slate-500">Equipment:</span> {selectedRoom.equipment}</p>
                                    )}
                                    {selectedRoom.notes && (
                                      <p className="text-slate-400 mt-1 italic">{selectedRoom.notes}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Contact Name
              </label>
              <input
                type="text"
                value={formData.client_contact_name}
                onChange={(e) => setFormData({ ...formData, client_contact_name: e.target.value })}
                placeholder="Main contact person"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              />

              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2 mt-3">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.client_email}
                onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                placeholder="Contact email address"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              />

              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2 mt-3">
                Contact Telephone
              </label>
              <input
                type="tel"
                value={formData.client_telephone}
                onChange={(e) => setFormData({ ...formData, client_telephone: e.target.value })}
                placeholder="Contact telephone number"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              >
                <option value="confirmed">Confirmed</option>
                <option value="provisional">Provisional</option>
                <option value="hold">On hold / pencilled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Course Length (Days)
              </label>
              <select
                value={formData.num_days}
                onChange={(e) => setFormData({ ...formData, num_days: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              >
                {[1, 2, 3, 4, 5].map(num => (
                  <option key={num} value={num}>{num} day{num > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any internal notes, numbers, travel details etc."
              rows={3}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
              Candidates
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Add course candidates for this booking. Tick "Paid" once payment has been received.
            </p>

            <div className="border border-slate-800 rounded p-3 space-y-2 bg-slate-950">
              {candidates.map((candidate, index) => (
                <div key={index} className="grid grid-cols-[1.3fr_1fr_1.4fr_1fr_auto_auto_auto_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={candidate.candidate_name}
                    onChange={(e) => updateCandidate(index, 'candidate_name', e.target.value)}
                    placeholder="Name"
                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs"
                  />
                  <input
                    type="tel"
                    value={candidate.telephone}
                    onChange={(e) => updateCandidate(index, 'telephone', e.target.value)}
                    placeholder="Tel"
                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs"
                  />
                  <input
                    type="email"
                    value={candidate.email}
                    onChange={(e) => updateCandidate(index, 'email', e.target.value)}
                    placeholder="Email"
                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={candidate.outstanding_balance || ''}
                    onChange={(e) => updateCandidate(index, 'outstanding_balance', parseFloat(e.target.value) || 0)}
                    placeholder="Outstanding balance"
                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs"
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={candidate.paid}
                      onChange={(e) => updateCandidate(index, 'paid', e.target.checked)}
                      className="rounded"
                    />
                    Paid
                  </label>
                  {booking && candidate.email && candidate.candidate_name && (
                    <button
                      type="button"
                      onClick={() => handleEmailCandidate(index)}
                      disabled={sendingCandidateEmail[index]}
                      className={`p-1 transition-colors ${
                        candidateEmailSent[index]
                          ? 'text-green-400'
                          : 'text-blue-400 hover:text-blue-300'
                      } disabled:opacity-50`}
                      title="Email booking confirmation to candidate"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeCandidate(index)}
                    className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addCandidate}
              className="mt-2 px-3 py-1 text-xs border border-slate-700 hover:border-slate-600 rounded flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add candidate
            </button>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div>
              {booking && (
                <div className="space-y-1">
                  <div className="text-xs text-slate-500">
                    Booking ID {booking.id}
                  </div>
                  {getCertificateStatus()}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {booking && formData.client_email && (
                <button
                  type="button"
                  onClick={handleEmailClient}
                  disabled={sendingEmail}
                  className={`px-4 py-2 text-sm border rounded transition-colors disabled:opacity-50 flex items-center gap-2 ${
                    emailSent
                      ? 'bg-green-500/10 text-green-400 border-green-500/50'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/50 hover:bg-blue-500/20'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {sendingEmail ? 'Sending...' : emailSent ? 'Email Sent!' : 'Email Client'}
                </button>
              )}
              {booking && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save booking'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
