import { supabase } from './supabase';
import { sendTemplateEmail } from './email';

interface Trainer {
  id: string;
  name: string;
  email: string;
  user_id?: string;
  receive_booking_notifications?: boolean;
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
}

interface BookingCandidate {
  candidate_name: string;
  email: string;
  telephone: string;
  paid: boolean;
  outstanding_balance: number;
  passed?: boolean;
}

export async function getTrainerForNotification(trainerId: string): Promise<Trainer | null> {
  const { data: trainer, error } = await supabase
    .from('trainers')
    .select('id, name, email, user_id, receive_booking_notifications')
    .eq('id', trainerId)
    .maybeSingle();

  if (error || !trainer) {
    console.error('Error fetching trainer:', error);
    return null;
  }

  if (trainer.user_id) {
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', trainer.user_id)
      .maybeSingle();

    if (user?.email) {
      trainer.email = user.email;
    }
  }

  return trainer;
}

export async function shouldSendNotification(trainerId: string): Promise<boolean> {
  const trainer = await getTrainerForNotification(trainerId);

  if (!trainer) {
    return false;
  }

  if (!trainer.email) {
    console.log(`Trainer ${trainer.name} has no email address, skipping notification`);
    return false;
  }

  if (trainer.receive_booking_notifications === false) {
    console.log(`Trainer ${trainer.name} has notifications disabled, skipping notification`);
    return false;
  }

  return true;
}

function formatDuration(numDays: number): string {
  return numDays === 1 ? '1 day' : `${numDays} days`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

async function getCourseTypeName(courseTypeId?: string): Promise<string> {
  if (!courseTypeId) return 'General Training';

  const { data } = await supabase
    .from('course_types')
    .select('name')
    .eq('id', courseTypeId)
    .maybeSingle();

  return data?.name || 'General Training';
}

async function formatCandidatesList(bookingId: string): Promise<{ html: string; text: string }> {
  const { data: candidates } = await supabase
    .from('booking_candidates')
    .select('*')
    .eq('booking_id', bookingId);

  if (!candidates || candidates.length === 0) {
    return { html: '', text: '' };
  }

  const html = `
    <h3 style="color: #2563eb; margin-top: 20px;">Registered Candidates</h3>
    <div class="candidate-list">
      <ul style="margin: 0; padding-left: 20px;">
        ${candidates.map(c => `
          <li style="margin: 5px 0;">
            <strong>${c.candidate_name}</strong><br>
            Email: ${c.email || 'Not provided'}<br>
            Phone: ${c.telephone || 'Not provided'}<br>
            Payment: ${c.paid ? '✓ Paid' : '✗ Unpaid'}
          </li>
        `).join('')}
      </ul>
    </div>
  `;

  const text = `
Registered Candidates:
${candidates.map(c => `
- ${c.candidate_name}
  Email: ${c.email || 'Not provided'}
  Phone: ${c.telephone || 'Not provided'}
  Payment: ${c.paid ? 'Paid' : 'Unpaid'}
`).join('\n')}
  `;

  return { html, text };
}

function formatNotes(notes: string): { html: string; text: string } {
  if (!notes || !notes.trim()) {
    return { html: '', text: '' };
  }

  const html = `
    <h3 style="color: #2563eb; margin-top: 20px;">Additional Notes</h3>
    <div class="detail-row">
      <p>${notes}</p>
    </div>
  `;

  const text = `
Additional Notes:
${notes}
  `;

  return { html, text };
}

export async function sendNewBookingNotification(
  booking: Booking,
  bookingId: string
): Promise<boolean> {
  const canSend = await shouldSendNotification(booking.trainer_id);
  if (!canSend) return false;

  const trainer = await getTrainerForNotification(booking.trainer_id);
  if (!trainer || !trainer.email) return false;

  const courseType = await getCourseTypeName(booking.course_type_id);
  const candidates = await formatCandidatesList(bookingId);
  const notes = formatNotes(booking.notes);

  const templateData = {
    trainer_name: trainer.name,
    course_title: booking.title,
    course_type: courseType,
    booking_date: formatDate(booking.booking_date),
    start_time: booking.start_time,
    duration: formatDuration(booking.num_days),
    location: booking.in_centre ? 'NCT Training Centre' : booking.location,
    status: formatStatus(booking.status),
    client_name: booking.client_name,
    client_contact: booking.client_contact_name || 'Not provided',
    client_email: booking.client_email || 'Not provided',
    client_telephone: booking.client_telephone || 'Not provided',
    candidates_section: candidates.html,
    candidates_text: candidates.text,
    notes_section: notes.html,
    notes_text: notes.text,
  };

  return sendTemplateEmail(
    trainer.email,
    'trainer_new_booking',
    templateData,
    undefined,
    { recipientName: trainer.name, priority: 3 }
  );
}

export async function sendBookingMovedNotification(
  booking: Booking,
  bookingId: string,
  previousTrainerName?: string
): Promise<boolean> {
  const canSend = await shouldSendNotification(booking.trainer_id);
  if (!canSend) return false;

  const trainer = await getTrainerForNotification(booking.trainer_id);
  if (!trainer || !trainer.email) return false;

  const courseType = await getCourseTypeName(booking.course_type_id);
  const candidates = await formatCandidatesList(bookingId);
  const notes = formatNotes(booking.notes);

  const previousTrainerText = previousTrainerName
    ? ` from ${previousTrainerName}`
    : '';

  const templateData = {
    trainer_name: trainer.name,
    course_title: booking.title,
    course_type: courseType,
    booking_date: formatDate(booking.booking_date),
    start_time: booking.start_time,
    duration: formatDuration(booking.num_days),
    location: booking.in_centre ? 'NCT Training Centre' : booking.location,
    status: formatStatus(booking.status),
    client_name: booking.client_name,
    client_contact: booking.client_contact_name || 'Not provided',
    client_email: booking.client_email || 'Not provided',
    client_telephone: booking.client_telephone || 'Not provided',
    candidates_section: candidates.html,
    candidates_text: candidates.text,
    notes_section: notes.html,
    notes_text: notes.text,
    previous_trainer_text: previousTrainerText,
  };

  return sendTemplateEmail(
    trainer.email,
    'trainer_booking_moved',
    templateData,
    undefined,
    { recipientName: trainer.name, priority: 3 }
  );
}

export async function sendBookingCancelledNotification(
  booking: Booking,
  trainerId: string
): Promise<boolean> {
  const canSend = await shouldSendNotification(trainerId);
  if (!canSend) return false;

  const trainer = await getTrainerForNotification(trainerId);
  if (!trainer || !trainer.email) return false;

  const courseType = await getCourseTypeName(booking.course_type_id);
  const notes = formatNotes(booking.notes);

  const templateData = {
    trainer_name: trainer.name,
    course_title: booking.title,
    course_type: courseType,
    booking_date: formatDate(booking.booking_date),
    start_time: booking.start_time,
    duration: formatDuration(booking.num_days),
    location: booking.in_centre ? 'NCT Training Centre' : booking.location,
    client_name: booking.client_name,
    client_contact: booking.client_contact_name || 'Not provided',
    notes_section: notes.html,
    notes_text: notes.text,
  };

  return sendTemplateEmail(
    trainer.email,
    'trainer_booking_cancelled',
    templateData,
    undefined,
    { recipientName: trainer.name, priority: 3 }
  );
}

function compareBookings(oldBooking: Booking, newBooking: Booking): string[] {
  const changes: string[] = [];

  // Only compare substantive fields that trigger notifications
  const fieldsToCompare = [
    { key: 'title', label: 'Course Title' },
    { key: 'booking_date', label: 'Date', formatter: formatDate },
    { key: 'start_time', label: 'Start Time' },
    { key: 'num_days', label: 'Duration', formatter: formatDuration },
    { key: 'location', label: 'Location' },
    { key: 'in_centre', label: 'Location Type', formatter: (v: boolean) => v ? 'In Centre' : 'Off-site' },
  ];

  for (const field of fieldsToCompare) {
    const oldValue = (oldBooking as any)[field.key];
    const newValue = (newBooking as any)[field.key];

    if (oldValue !== newValue) {
      const formattedOld = field.formatter ? field.formatter(oldValue) : oldValue;
      const formattedNew = field.formatter ? field.formatter(newValue) : newValue;
      changes.push(`${field.label}: "${formattedOld || 'Empty'}" → "${formattedNew || 'Empty'}"`);
    }
  }

  return changes;
}

export function hasSubstantiveChanges(oldBooking: Booking, newBooking: Booking): boolean {
  // Only check fields that constitute substantive changes:
  // - Job description (title)
  // - Date (booking_date)
  // - Time (start_time)
  // - Course length (num_days)
  // - Venue changes (location, in_centre, location_id)
  const fieldsToCheck = [
    'title',
    'booking_date',
    'start_time',
    'num_days',
    'location',
    'in_centre',
    'location_id'
  ];

  for (const field of fieldsToCheck) {
    if ((oldBooking as any)[field] !== (newBooking as any)[field]) {
      return true;
    }
  }

  return false;
}

export async function sendBookingUpdatedNotification(
  oldBooking: Booking,
  newBooking: Booking,
  bookingId: string
): Promise<boolean> {
  if (!hasSubstantiveChanges(oldBooking, newBooking)) {
    console.log('No substantive changes detected, skipping notification');
    return false;
  }

  const canSend = await shouldSendNotification(newBooking.trainer_id);
  if (!canSend) return false;

  const trainer = await getTrainerForNotification(newBooking.trainer_id);
  if (!trainer || !trainer.email) return false;

  const courseType = await getCourseTypeName(newBooking.course_type_id);
  const notes = formatNotes(newBooking.notes);
  const changes = compareBookings(oldBooking, newBooking);

  const changesSummaryHtml = changes.map(change =>
    `<div style="margin: 5px 0;">• ${change}</div>`
  ).join('');

  const changesSummaryText = changes.map(change => `• ${change}`).join('\n');

  const templateData = {
    trainer_name: trainer.name,
    course_title: newBooking.title,
    course_type: courseType,
    booking_date: formatDate(newBooking.booking_date),
    start_time: newBooking.start_time,
    duration: formatDuration(newBooking.num_days),
    location: newBooking.in_centre ? 'NCT Training Centre' : newBooking.location,
    status: formatStatus(newBooking.status),
    client_name: newBooking.client_name,
    client_contact: newBooking.client_contact_name || 'Not provided',
    notes_section: notes.html,
    notes_text: notes.text,
    changes_summary: changesSummaryHtml || 'Minor updates made',
    changes_summary_text: changesSummaryText || 'Minor updates made',
  };

  return sendTemplateEmail(
    trainer.email,
    'trainer_booking_updated',
    templateData,
    undefined,
    { recipientName: trainer.name, priority: 4 }
  );
}

export async function sendOpenCourseAssignmentNotification(
  sessionId: string,
  trainerId: string
): Promise<boolean> {
  const canSend = await shouldSendNotification(trainerId);
  if (!canSend) return false;

  const trainer = await getTrainerForNotification(trainerId);
  if (!trainer || !trainer.email) return false;

  const { data: session, error } = await supabase
    .from('open_course_sessions')
    .select(`
      *,
      course_type:course_types(
        id,
        name
      ),
      venue:venues(
        id,
        name,
        town,
        address_line1,
        city,
        postcode
      ),
      delegates:open_course_delegates(
        id,
        delegate_name,
        delegate_email
      )
    `)
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !session) {
    console.error('Error fetching open course session:', error);
    return false;
  }

  const location = session.is_online
    ? 'Online'
    : (session.venue
      ? `${session.venue.name}, ${session.venue.town || session.venue.city}`
      : 'TBA');

  const delegatesList = session.delegates && session.delegates.length > 0
    ? session.delegates.map(d => `<li>${d.delegate_name} (${d.delegate_email})</li>`).join('')
    : '<li>No delegates registered yet</li>';

  const delegatesText = session.delegates && session.delegates.length > 0
    ? session.delegates.map(d => `- ${d.delegate_name} (${d.delegate_email})`).join('\n')
    : '- No delegates registered yet';

  const templateData = {
    trainer_name: trainer.name,
    course_title: session.event_title,
    course_subtitle: session.event_subtitle || '',
    course_type: session.course_type?.name || 'Not specified',
    session_date: formatDate(session.session_date),
    start_time: session.start_time || 'TBA',
    end_time: session.end_time || 'TBA',
    location: location,
    capacity: `${session.delegates?.length || 0}/${session.capacity_limit}`,
    delegates_list: delegatesList,
    delegates_text: delegatesText,
    is_online: session.is_online,
  };

  return sendTemplateEmail(
    trainer.email,
    'trainer_open_course_assignment',
    templateData,
    undefined,
    { recipientName: trainer.name, priority: 5 }
  );
}

export async function sendProvisionalBookingNotification(
  trainerId: string,
  startDate: string,
  endDate: string,
  reason?: string
): Promise<boolean> {
  const canSend = await shouldSendNotification(trainerId);
  if (!canSend) return false;

  const trainer = await getTrainerForNotification(trainerId);
  if (!trainer || !trainer.email) return false;

  // Format the date range
  let dateRange: string;
  if (startDate === endDate) {
    dateRange = formatDate(startDate);
  } else {
    dateRange = `${formatDate(startDate)} to ${formatDate(endDate)}`;
  }

  const templateData = {
    trainer_name: trainer.name,
    date_range: dateRange,
    reason: reason || '',
  };

  return sendTemplateEmail(
    trainer.email,
    'trainer_provisional_booking',
    templateData,
    undefined,
    { recipientName: trainer.name, priority: 4 }
  );
}
