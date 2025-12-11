import { useState, useEffect } from 'react';
import { Download, Mail, Search, Award, CheckCircle, XCircle, AlertTriangle, Clock, Calendar, ChevronDown, ChevronRight, FileText, Send, Ban } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import {
  getCertificates,
  getCourseTypes,
  getBookingsWithCourseTypes,
  getOpenCourseSessionsWithDelegates,
  updateCandidatePassStatus,
  updateBookingCourseLevelData,
  issueCertificate,
  issueOpenCourseCertificate,
  updateOpenCourseDelegateAttendance,
  getExpiryStatus,
  getDaysUntilExpiry,
  getCertificateTemplates,
  regenerateCertificatePDF,
  revokeCertificate,
  Certificate,
  CourseType,
  BookingWithCandidates,
  OpenCourseSessionWithDelegates,
  CourseFieldDefinition,
  CertificateTemplate
} from '../lib/certificates';
import { updateCandidateCourseData } from '../lib/candidates';
import { sendCertificateEmail } from '../lib/email';
import Notification from '../components/Notification';

type NotificationState = {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
} | null;

interface ViewIssueCertificatesProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function ViewIssueCertificates({ currentPage, onNavigate }: ViewIssueCertificatesProps) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [bookings, setBookings] = useState<BookingWithCandidates[]>([]);
  const [openCourseSessions, setOpenCourseSessions] = useState<OpenCourseSessionWithDelegates[]>([]);
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'issue' | 'view'>('issue');
  const [issueSubTab, setIssueSubTab] = useState<'private' | 'open'>('open');
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [regeneratingPdf, setRegeneratingPdf] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState<string | null>(null);
  const [bulkEmailing, setBulkEmailing] = useState<string | null>(null);
  const [revokingCertId, setRevokingCertId] = useState<string | null>(null);
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [showRevokeModal, setShowRevokeModal] = useState<string | null>(null);
  const [courseLevelData, setCourseLevelData] = useState<Record<string, Record<string, any>>>({});
  const [candidateFieldData, setCandidateFieldData] = useState<Record<string, any>>({});
  const [openCourseSessionData, setOpenCourseSessionData] = useState<Record<string, Record<string, any>>>({});
  const [openCourseDelegateData, setOpenCourseDelegateData] = useState<Record<string, Record<string, any>>>({});
  const [notification, setNotification] = useState<NotificationState>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, string>>({});
  const [availableTemplates, setAvailableTemplates] = useState<Record<string, CertificateTemplate[]>>({});
  const [bookingDurations, setBookingDurations] = useState<Record<string, { value: number | null, unit: 'hours' | 'days' }>>({});
  const [openCourseDurations, setOpenCourseDurations] = useState<Record<string, { value: number | null, unit: 'hours' | 'days' }>>({});

  const [issueFilters, setIssueFilters] = useState({
    courseTypeId: '',
    startDate: '',
    endDate: ''
  });

  const [viewFilters, setViewFilters] = useState({
    courseTypeId: '',
    status: '',
    expiryStatus: '',
    searchTerm: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'issue') {
      if (issueSubTab === 'private') {
        loadBookings();
      } else {
        loadOpenCourseSessions();
      }
    } else {
      loadCertificates();
    }
  }, [activeTab, issueSubTab, issueFilters, viewFilters]);

  async function loadData() {
    setLoading(true);
    const types = await getCourseTypes();
    setCourseTypes(types);
    await loadOpenCourseSessions();
    setLoading(false);
  }

  async function loadBookings() {
    const data = await getBookingsWithCourseTypes({
      courseTypeId: issueFilters.courseTypeId || undefined,
      startDate: issueFilters.startDate || undefined,
      endDate: issueFilters.endDate || undefined
    });
    setBookings(data);

    const courseLevelDataMap: Record<string, Record<string, any>> = {};
    const uniqueCourseTypeIds = new Set<string>();

    const durationsMap: Record<string, { value: number | null, unit: 'hours' | 'days' }> = {};

    data.forEach(booking => {
      const bookingData = (booking as any).course_level_data || {};
      const courseType = (booking as any).course_types;

      if (booking.course_type_id) {
        uniqueCourseTypeIds.add(booking.course_type_id);
      }

      if (Object.keys(bookingData).length === 0 && courseType?.default_course_data) {
        courseLevelDataMap[booking.id] = { ...courseType.default_course_data };
      } else {
        courseLevelDataMap[booking.id] = bookingData;
      }

      // Use saved duration from booking if available, otherwise use course type default
      const savedDurationValue = (booking as any).duration_value;
      const savedDurationUnit = (booking as any).duration_unit;

      durationsMap[booking.id] = {
        value: savedDurationValue !== null && savedDurationValue !== undefined ? savedDurationValue : (courseType?.duration_days || null),
        unit: savedDurationUnit || courseType?.duration_unit || 'days'
      };
    });
    setCourseLevelData(courseLevelDataMap);
    setBookingDurations(durationsMap);

    // Load templates for each course type
    const templatesMap: Record<string, CertificateTemplate[]> = {};
    const selectedTemplatesMap: Record<string, string> = {};

    for (const courseTypeId of uniqueCourseTypeIds) {
      const templates = await getCertificateTemplates(courseTypeId);
      templatesMap[courseTypeId] = templates;

      // Use saved template if available, otherwise auto-select the first template
      if (templates.length > 0) {
        data.forEach(booking => {
          if (booking.course_type_id === courseTypeId) {
            const savedTemplateId = (booking as any).certificate_template_id;
            // Check if saved template still exists in available templates
            if (savedTemplateId && templates.some(t => t.id === savedTemplateId)) {
              selectedTemplatesMap[booking.id] = savedTemplateId;
            } else {
              selectedTemplatesMap[booking.id] = templates[0].id;
            }
          }
        });
      }
    }

    setAvailableTemplates(templatesMap);
    setSelectedTemplates(selectedTemplatesMap);

    // Load candidate course data
    const candidateDataMap: Record<string, Record<string, any>> = {};
    data.forEach(booking => {
      booking.candidates.forEach((candidate: any) => {
        const savedData = candidate.candidate_course_data || {};
        candidateDataMap[candidate.id] = savedData;
      });
    });
    setCandidateFieldData(candidateDataMap);
  }

  async function loadOpenCourseSessions() {
    const data = await getOpenCourseSessionsWithDelegates({
      courseTypeId: issueFilters.courseTypeId || undefined,
      startDate: issueFilters.startDate || undefined,
      endDate: issueFilters.endDate || undefined
    });
    setOpenCourseSessions(data);

    const sessionDataMap: Record<string, Record<string, any>> = {};
    const uniqueCourseTypeIds = new Set<string>();
    const durationsMap: Record<string, { value: number | null, unit: 'hours' | 'days' }> = {};

    data.forEach(session => {
      if (session.course_type_id) {
        uniqueCourseTypeIds.add(session.course_type_id);
      }

      // Initialize session data with defaults from course type
      const courseType = session.course_types;
      if (courseType?.default_course_data) {
        sessionDataMap[session.id] = { ...courseType.default_course_data };
      } else {
        sessionDataMap[session.id] = {};
      }

      // Set duration from course type
      durationsMap[session.id] = {
        value: courseType?.duration_days || null,
        unit: (courseType?.duration_unit as 'hours' | 'days') || 'days'
      };
    });

    setOpenCourseSessionData(sessionDataMap);
    setOpenCourseDurations(durationsMap);

    // Load templates for each course type (reuse existing logic)
    const templatesMap: Record<string, CertificateTemplate[]> = { ...availableTemplates };
    const selectedTemplatesMap: Record<string, string> = { ...selectedTemplates };

    for (const courseTypeId of uniqueCourseTypeIds) {
      if (!templatesMap[courseTypeId]) {
        const templates = await getCertificateTemplates(courseTypeId);
        templatesMap[courseTypeId] = templates;
      }

      // Auto-select first template for sessions
      if (templatesMap[courseTypeId]?.length > 0) {
        data.forEach(session => {
          if (session.course_type_id === courseTypeId && !selectedTemplatesMap[session.id]) {
            selectedTemplatesMap[session.id] = templatesMap[courseTypeId][0].id;
          }
        });
      }
    }

    setAvailableTemplates(templatesMap);
    setSelectedTemplates(selectedTemplatesMap);

    // Initialize delegate data
    const delegateDataMap: Record<string, Record<string, any>> = {};
    data.forEach(session => {
      session.delegates.forEach(delegate => {
        delegateDataMap[delegate.id] = {};
      });
    });
    setOpenCourseDelegateData(delegateDataMap);
  }

  async function loadCertificates() {
    const data = await getCertificates({
      courseTypeId: viewFilters.courseTypeId || undefined,
      status: viewFilters.status || undefined,
      expiryStatus: viewFilters.expiryStatus as any || undefined,
      searchTerm: viewFilters.searchTerm || undefined,
      startDate: viewFilters.startDate || undefined,
      endDate: viewFilters.endDate || undefined
    });
    setCertificates(data);
  }

  async function updateBookingCertificateTemplate(bookingId: string, templateId: string) {
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase
        .from('bookings')
        .update({ certificate_template_id: templateId })
        .eq('id', bookingId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating certificate template:', error);
      setNotification({ type: 'error', message: 'Failed to save certificate template' });
    }
  }

  async function updateBookingDuration(bookingId: string, value: number | null, unit: 'hours' | 'days') {
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase
        .from('bookings')
        .update({
          duration_value: value,
          duration_unit: unit
        })
        .eq('id', bookingId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating duration:', error);
      setNotification({ type: 'error', message: 'Failed to save duration' });
    }
  }

  async function handlePassStatusChange(candidateId: string, passed: boolean) {
    try {
      await updateCandidatePassStatus(candidateId, passed);

      if (passed) {
        const booking = bookings.find(b =>
          b.candidates.some(c => c.id === candidateId)
        );

        if (booking) {
          const courseType = (booking as any).course_types;
          if (courseType?.default_course_data) {
            const candidateDefaults: Record<string, any> = {};
            const requiredFields = (courseType.required_fields || []) as CourseFieldDefinition[];

            requiredFields
              .filter(f => f.scope === 'candidate')
              .forEach(field => {
                const defaultValue = courseType.default_course_data[field.name];
                if (defaultValue !== undefined && defaultValue !== '') {
                  candidateDefaults[field.name] = defaultValue;
                }
              });

            if (Object.keys(candidateDefaults).length > 0) {
              setCandidateFieldData(prev => ({
                ...prev,
                [candidateId]: {
                  ...(prev[candidateId] || {}),
                  ...candidateDefaults
                }
              }));
            }
          }
        }
      }

      await loadBookings();
    } catch (error) {
      alert('Failed to update pass status');
    }
  }

  async function handleGenerateCertificate(booking: BookingWithCandidates, candidate: any) {
    const courseType = (booking as any).course_types;
    if (!courseType) return;

    // Check if template is selected
    const templateId = selectedTemplates[booking.id];
    if (!templateId) {
      setNotification({
        type: 'warning',
        message: 'Please select a certificate template'
      });
      return;
    }

    const requiredFields = (courseType.required_fields || []) as CourseFieldDefinition[];
    const courseFields = requiredFields.filter(f => f.scope === 'course');
    const candidateFields = requiredFields.filter(f => f.scope === 'candidate');

    const missingCourseFields = courseFields
      .filter(field => field.required)
      .filter(field => !courseLevelData[booking.id]?.[field.name] ||
        (typeof courseLevelData[booking.id][field.name] === 'string' &&
         !courseLevelData[booking.id][field.name].trim()));

    const missingCandidateFields = candidateFields
      .filter(field => field.required)
      .filter(field => !candidateFieldData[candidate.id]?.[field.name] ||
        (typeof candidateFieldData[candidate.id][field.name] === 'string' &&
         !candidateFieldData[candidate.id][field.name].trim()));

    if (missingCourseFields.length > 0 || missingCandidateFields.length > 0) {
      const allMissing = [...missingCourseFields, ...missingCandidateFields];
      setNotification({
        type: 'warning',
        message: `Please fill in all required fields: ${allMissing.map(f => f.label).join(', ')}`
      });
      return;
    }

    setGeneratingFor(candidate.id);

    try {
      const mergedData = {
        ...(courseLevelData[booking.id] || {}),
        ...(candidateFieldData[candidate.id] || {})
      };

      const bookingDuration = bookingDurations[booking.id];
      if (bookingDuration?.value && bookingDuration.value > 0) {
        mergedData.course_duration = `${bookingDuration.value} ${bookingDuration.unit}`;
      }

      const courseType = courseTypes.find(ct => ct.id === booking.course_type_id);
      if (courseType?.required_fields) {
        courseType.required_fields.forEach(field => {
          if (field.unit && mergedData[field.name] && mergedData[`${field.name}_unit`]) {
            mergedData[field.name] = `${mergedData[field.name]} ${mergedData[`${field.name}_unit`]}`;
            delete mergedData[`${field.name}_unit`];
          }
        });
      }

      await issueCertificate({
        bookingId: booking.id,
        candidateId: candidate.id,
        candidateName: candidate.candidate_name,
        candidateEmail: candidate.email,
        courseTypeId: booking.course_type_id!,
        trainerId: booking.trainer_id,
        trainerName: booking.trainer_name,
        courseStartDate: booking.booking_date,
        courseEndDate: booking.course_date_end,
        courseSpecificData: mergedData,
        templateId
      });

      setNotification({ type: 'success', message: `Certificate issued successfully for ${candidate.candidate_name}` });
      await loadBookings();

      setCandidateFieldData(prev => {
        const updated = { ...prev };
        delete updated[candidate.id];
        return updated;
      });
    } catch (error) {
      console.error('Error issuing certificate:', error);
      setNotification({ type: 'error', message: 'Failed to issue certificate' });
    } finally {
      setGeneratingFor(null);
    }
  }

  async function handleBulkGeneratePDFs(booking: BookingWithCandidates) {
    const passedCandidates = booking.candidates.filter(c => {
      const cert = (c as any).certificate;
      return c.passed && (!c.certificate_id || cert?.status === 'revoked');
    });

    if (passedCandidates.length === 0) {
      setNotification({ type: 'warning', message: 'No passed candidates without certificates found' });
      return;
    }

    const templateId = selectedTemplates[booking.id];
    if (!templateId) {
      setNotification({ type: 'error', message: 'Please select a certificate template first' });
      return;
    }

    try {
      setBulkGenerating(booking.id);
      setNotification({ type: 'info', message: `Generating ${passedCandidates.length} certificates...` });

      let successCount = 0;
      let failCount = 0;

      for (const candidate of passedCandidates) {
        try {
          const candidateData = candidateFieldData[candidate.id] || {};
          const bookingData = courseLevelData[booking.id] || {};
          const mergedData = { ...bookingData, ...candidateData };

          await issueCertificate({
            bookingId: booking.id,
            candidateId: candidate.id,
            candidateName: candidate.candidate_name,
            candidateEmail: candidate.email,
            courseTypeId: booking.course_type_id!,
            trainerId: booking.trainer_id,
            trainerName: booking.trainer_name,
            courseStartDate: booking.booking_date,
            courseEndDate: booking.course_date_end,
            courseSpecificData: mergedData,
            templateId
          });

          successCount++;
        } catch (error) {
          console.error(`Error issuing certificate for ${candidate.candidate_name}:`, error);
          failCount++;
        }
      }

      await loadBookings();

      if (failCount === 0) {
        setNotification({ type: 'success', message: `Successfully generated ${successCount} certificates` });
      } else {
        setNotification({ type: 'warning', message: `Generated ${successCount} certificates, ${failCount} failed` });
      }
    } catch (error) {
      console.error('Error in bulk certificate generation:', error);
      setNotification({ type: 'error', message: 'Failed to generate certificates' });
    } finally {
      setBulkGenerating(null);
    }
  }

  async function handleBulkEmailCertificates(booking: BookingWithCandidates) {
    const candidatesWithCerts = booking.candidates.filter(c => {
      const cert = (c as any).certificate;
      return c.passed && c.certificate_id && cert?.certificate_pdf_url && cert?.status === 'issued';
    });

    if (candidatesWithCerts.length === 0) {
      setNotification({ type: 'warning', message: 'No passed candidates with generated certificates found' });
      return;
    }

    try {
      setBulkEmailing(booking.id);
      setNotification({ type: 'info', message: `Sending ${candidatesWithCerts.length} certificates...` });

      const courseType = (booking as any).course_types;
      let successCount = 0;
      let failCount = 0;

      for (const candidate of candidatesWithCerts) {
        const certificate = (candidate as any).certificate;
        const courseDate = `${formatDate(booking.booking_date)} - ${formatDate(booking.course_date_end)}`;

        try {
          const success = await sendCertificateEmail(candidate.email, {
            candidate_name: candidate.candidate_name,
            course_type: courseType?.name || 'Training Course',
            certificate_number: certificate.certificate_number,
            course_date: courseDate,
            trainer_name: booking.trainer_name,
            issue_date: formatDate(certificate.issue_date),
            expiry_date: certificate.expiry_date ? formatDate(certificate.expiry_date) : 'N/A',
            certificate_pdf_url: certificate.certificate_pdf_url,
          });

          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Error sending certificate to ${candidate.candidate_name}:`, error);
          failCount++;
        }
      }

      if (failCount === 0) {
        setNotification({ type: 'success', message: `Successfully emailed ${successCount} certificates` });
      } else {
        setNotification({ type: 'warning', message: `Emailed ${successCount} certificates, ${failCount} failed` });
      }
    } catch (error) {
      console.error('Error in bulk email:', error);
      setNotification({ type: 'error', message: 'Failed to send emails' });
    } finally {
      setBulkEmailing(null);
    }
  }

  function isDefaultValue(booking: BookingWithCandidates, fieldName: string): boolean {
    const courseType = (booking as any).course_types;
    const bookingData = (booking as any).course_level_data || {};
    const currentValue = courseLevelData[booking.id]?.[fieldName];
    const defaultValue = courseType?.default_course_data?.[fieldName];

    return (
      Object.keys(bookingData).length === 0 &&
      defaultValue !== undefined &&
      currentValue === defaultValue
    );
  }

  function isCandidateDefaultValue(candidateId: string, fieldName: string, booking: BookingWithCandidates): boolean {
    const courseType = (booking as any).course_types;
    const currentValue = candidateFieldData[candidateId]?.[fieldName];
    const defaultValue = courseType?.default_course_data?.[fieldName];

    return (
      defaultValue !== undefined &&
      defaultValue !== '' &&
      currentValue === defaultValue
    );
  }

  function updateCourseLevelField(bookingId: string, fieldName: string, value: any) {
    const newData = {
      ...(courseLevelData[bookingId] || {}),
      [fieldName]: value
    };

    setCourseLevelData(prev => ({
      ...prev,
      [bookingId]: newData
    }));

    updateBookingCourseLevelData(bookingId, newData).catch(err => {
      console.error('Failed to save course-level data:', err);
    });
  }

  function updateCandidateField(candidateId: string, fieldName: string, value: any) {
    const newData = {
      ...(candidateFieldData[candidateId] || {}),
      [fieldName]: value
    };

    setCandidateFieldData(prev => ({
      ...prev,
      [candidateId]: newData
    }));

    updateCandidateCourseData(candidateId, newData).catch(err => {
      console.error('Failed to save candidate course data:', err);
    });
  }

  // Open Course Handlers
  function updateOpenCourseSessionField(sessionId: string, fieldName: string, value: any) {
    setOpenCourseSessionData(prev => ({
      ...prev,
      [sessionId]: {
        ...(prev[sessionId] || {}),
        [fieldName]: value
      }
    }));
  }

  function updateOpenCourseDelegateField(delegateId: string, fieldName: string, value: any) {
    setOpenCourseDelegateData(prev => ({
      ...prev,
      [delegateId]: {
        ...(prev[delegateId] || {}),
        [fieldName]: value
      }
    }));
  }

  async function handleDelegateAttendanceChange(delegateId: string, attended: boolean) {
    try {
      await updateOpenCourseDelegateAttendance(delegateId, attended);
      await loadOpenCourseSessions();
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to update attendance' });
    }
  }

  async function handleGenerateOpenCourseCertificate(session: OpenCourseSessionWithDelegates, delegate: any) {
    const courseType = session.course_types;
    if (!courseType) return;

    const templateId = selectedTemplates[session.id];
    if (!templateId) {
      setNotification({
        type: 'warning',
        message: 'Please select a certificate template'
      });
      return;
    }

    const requiredFields = (courseType.required_fields || []) as CourseFieldDefinition[];
    const courseFields = requiredFields.filter(f => f.scope === 'course');
    const candidateFields = requiredFields.filter(f => f.scope === 'candidate');

    const missingCourseFields = courseFields
      .filter(field => field.required)
      .filter(field => !openCourseSessionData[session.id]?.[field.name] ||
        (typeof openCourseSessionData[session.id][field.name] === 'string' &&
         !openCourseSessionData[session.id][field.name].trim()));

    const missingCandidateFields = candidateFields
      .filter(field => field.required)
      .filter(field => !openCourseDelegateData[delegate.id]?.[field.name] ||
        (typeof openCourseDelegateData[delegate.id][field.name] === 'string' &&
         !openCourseDelegateData[delegate.id][field.name].trim()));

    if (missingCourseFields.length > 0 || missingCandidateFields.length > 0) {
      const allMissing = [...missingCourseFields, ...missingCandidateFields];
      setNotification({
        type: 'warning',
        message: `Please fill in all required fields: ${allMissing.map(f => f.label).join(', ')}`
      });
      return;
    }

    setGeneratingFor(delegate.id);

    try {
      const mergedData = {
        ...(openCourseSessionData[session.id] || {}),
        ...(openCourseDelegateData[delegate.id] || {})
      };

      const sessionDuration = openCourseDurations[session.id];
      if (sessionDuration?.value && sessionDuration.value > 0) {
        mergedData.course_duration = `${sessionDuration.value} ${sessionDuration.unit}`;
      }

      // Handle unit fields
      if (courseType?.required_fields) {
        courseType.required_fields.forEach((field: CourseFieldDefinition) => {
          if (field.unit && mergedData[field.name] && mergedData[`${field.name}_unit`]) {
            mergedData[field.name] = `${mergedData[field.name]} ${mergedData[`${field.name}_unit`]}`;
            delete mergedData[`${field.name}_unit`];
          }
        });
      }

      await issueOpenCourseCertificate({
        sessionId: session.id,
        delegateId: delegate.id,
        delegateName: delegate.delegate_name,
        delegateEmail: delegate.delegate_email,
        courseTypeId: session.course_type_id!,
        trainerId: session.trainer_id,
        trainerName: session.trainer_name,
        courseStartDate: session.session_date,
        courseEndDate: session.session_end_date,
        courseSpecificData: mergedData,
        templateId
      });

      setNotification({ type: 'success', message: `Certificate issued successfully for ${delegate.delegate_name}` });
      await loadOpenCourseSessions();
    } catch (error) {
      console.error('Error issuing certificate:', error);
      setNotification({ type: 'error', message: 'Failed to issue certificate' });
    } finally {
      setGeneratingFor(null);
    }
  }

  async function handleBulkGenerateOpenCourseCertificates(session: OpenCourseSessionWithDelegates) {
    const attendedDelegates = session.delegates.filter(d =>
      (d.attendance_status === 'attended' || d.attendance_detail === 'attended') &&
      (!d.certificate?.id || d.certificate?.status === 'revoked')
    );

    if (attendedDelegates.length === 0) {
      setNotification({ type: 'warning', message: 'No attended delegates without certificates found' });
      return;
    }

    const templateId = selectedTemplates[session.id];
    if (!templateId) {
      setNotification({ type: 'error', message: 'Please select a certificate template first' });
      return;
    }

    try {
      setBulkGenerating(session.id);
      setNotification({ type: 'info', message: `Generating ${attendedDelegates.length} certificates...` });

      let successCount = 0;
      let failCount = 0;

      for (const delegate of attendedDelegates) {
        try {
          const sessionData = openCourseSessionData[session.id] || {};
          const delegateData = openCourseDelegateData[delegate.id] || {};
          const mergedData = { ...sessionData, ...delegateData };

          await issueOpenCourseCertificate({
            sessionId: session.id,
            delegateId: delegate.id,
            delegateName: delegate.delegate_name,
            delegateEmail: delegate.delegate_email,
            courseTypeId: session.course_type_id!,
            trainerId: session.trainer_id,
            trainerName: session.trainer_name,
            courseStartDate: session.session_date,
            courseEndDate: session.session_end_date,
            courseSpecificData: mergedData,
            templateId
          });

          successCount++;
        } catch (error) {
          console.error(`Error issuing certificate for ${delegate.delegate_name}:`, error);
          failCount++;
        }
      }

      await loadOpenCourseSessions();

      if (failCount === 0) {
        setNotification({ type: 'success', message: `Successfully generated ${successCount} certificates` });
      } else {
        setNotification({ type: 'warning', message: `Generated ${successCount} certificates, ${failCount} failed` });
      }
    } catch (error) {
      console.error('Error in bulk certificate generation:', error);
      setNotification({ type: 'error', message: 'Failed to generate certificates' });
    } finally {
      setBulkGenerating(null);
    }
  }

  async function handleBulkEmailOpenCourseCertificates(session: OpenCourseSessionWithDelegates) {
    const delegatesWithCerts = session.delegates.filter(d =>
      d.certificate?.certificate_pdf_url && d.certificate?.status === 'issued'
    );

    if (delegatesWithCerts.length === 0) {
      setNotification({ type: 'warning', message: 'No delegates with generated certificates found' });
      return;
    }

    try {
      setBulkEmailing(session.id);
      setNotification({ type: 'info', message: `Sending ${delegatesWithCerts.length} certificates...` });

      const courseType = session.course_types;
      let successCount = 0;
      let failCount = 0;

      for (const delegate of delegatesWithCerts) {
        const certificate = delegate.certificate!;
        const courseDate = `${formatDate(session.session_date)} - ${formatDate(session.session_end_date)}`;

        try {
          const success = await sendCertificateEmail(delegate.delegate_email, {
            candidate_name: delegate.delegate_name,
            course_type: courseType?.name || 'Training Course',
            certificate_number: certificate.certificate_number,
            course_date: courseDate,
            trainer_name: session.trainer_name,
            issue_date: formatDate(new Date().toISOString()),
            expiry_date: 'N/A',
            certificate_pdf_url: certificate.certificate_pdf_url,
          });

          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Error sending certificate to ${delegate.delegate_name}:`, error);
          failCount++;
        }
      }

      if (failCount === 0) {
        setNotification({ type: 'success', message: `Successfully emailed ${successCount} certificates` });
      } else {
        setNotification({ type: 'warning', message: `Emailed ${successCount} certificates, ${failCount} failed` });
      }
    } catch (error) {
      console.error('Error in bulk email:', error);
      setNotification({ type: 'error', message: 'Failed to send emails' });
    } finally {
      setBulkEmailing(null);
    }
  }

  function toggleCourse(bookingId: string) {
    setExpandedCourseId(expandedCourseId === bookingId ? null : bookingId);
  }

  function getStatusBadge(status: string, revokedReason?: string | null) {
    switch (status) {
      case 'issued':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded">
            <CheckCircle className="w-3 h-3" />
            Issued
          </span>
        );
      case 'revoked':
        return (
          <div className="inline-flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded">
              <XCircle className="w-3 h-3" />
              Revoked
            </span>
            {revokedReason && (
              <span className="text-xs text-red-400/80 italic">
                {revokedReason}
              </span>
            )}
          </div>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">
            <AlertTriangle className="w-3 h-3" />
            Expired
          </span>
        );
      default:
        return null;
    }
  }

  function getExpiryBadge(expiryDate: string | null) {
    const status = getExpiryStatus(expiryDate);
    const days = getDaysUntilExpiry(expiryDate);

    if (!expiryDate) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded">
          No Expiry
        </span>
      );
    }

    switch (status) {
      case 'valid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded">
            <CheckCircle className="w-3 h-3" />
            Valid ({days} days)
          </span>
        );
      case 'expiring_soon':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
            <Clock className="w-3 h-3" />
            Expiring Soon ({days} days)
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded">
            <XCircle className="w-3 h-3" />
            Expired
          </span>
        );
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  async function handleDownloadCertificate(certificate: Certificate) {
    if (certificate.certificate_pdf_url) {
      window.open(certificate.certificate_pdf_url, '_blank');
      return;
    }

    try {
      setRegeneratingPdf(certificate.id);
      setNotification({ type: 'info', message: 'Generating PDF, please wait...' });

      const pdfUrl = await regenerateCertificatePDF(certificate.id);

      await loadCertificates();

      window.open(pdfUrl, '_blank');
      setNotification({ type: 'success', message: 'PDF generated and download started' });
    } catch (error) {
      console.error('Error regenerating certificate PDF:', error);
      setNotification({ type: 'error', message: 'Failed to generate certificate PDF' });
    } finally {
      setRegeneratingPdf(null);
    }
  }

  async function handleEmailCertificate(certificate: Certificate) {
    if (!certificate.certificate_pdf_url) {
      setNotification({ type: 'warning', message: 'Certificate PDF not available yet' });
      return;
    }

    try {
      setSendingEmailFor(certificate.id);
      const courseType = (certificate as any).course_types;
      const courseDate = `${formatDate(certificate.course_date_start)} - ${formatDate(certificate.course_date_end)}`;

      const success = await sendCertificateEmail(certificate.candidate_email, {
        candidate_name: certificate.candidate_name,
        course_type: courseType?.name || 'Training Course',
        certificate_number: certificate.certificate_number,
        course_date: courseDate,
        trainer_name: certificate.trainer_name,
        issue_date: formatDate(certificate.issue_date),
        expiry_date: certificate.expiry_date ? formatDate(certificate.expiry_date) : 'N/A',
        certificate_pdf_url: certificate.certificate_pdf_url,
      });

      if (success) {
        setNotification({ type: 'success', message: `Certificate emailed to ${certificate.candidate_name}` });
      } else {
        setNotification({ type: 'error', message: 'Failed to send email' });
      }
    } catch (error) {
      console.error('Error sending certificate email:', error);
      setNotification({ type: 'error', message: 'Failed to send email' });
    } finally {
      setSendingEmailFor(null);
    }
  }

  async function handleRevokeCertificate(certificateId: string) {
    if (!revokeReason.trim()) {
      setNotification({ type: 'warning', message: 'Please provide a reason for revocation' });
      return;
    }

    try {
      setRevokingCertId(certificateId);
      await revokeCertificate(certificateId, revokeReason);
      setNotification({ type: 'success', message: 'Certificate revoked successfully' });
      setShowRevokeModal(null);
      setRevokeReason('');
      await loadBookings();
      if (activeTab === 'view') {
        await loadCertificates();
      }
    } catch (error) {
      console.error('Error revoking certificate:', error);
      setNotification({ type: 'error', message: 'Failed to revoke certificate' });
    } finally {
      setRevokingCertId(null);
    }
  }

  const groupedCertificates = certificates.reduce((acc, cert) => {
    const courseTypeName = (cert as any).course_types?.name || 'Unknown';
    if (!acc[courseTypeName]) {
      acc[courseTypeName] = [];
    }
    acc[courseTypeName].push(cert);
    return acc;
  }, {} as Record<string, Certificate[]>);

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

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('issue')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'issue'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Issue Certificates
          </button>
          <button
            onClick={() => setActiveTab('view')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'view'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            View Issued Certificates
          </button>
        </div>

        {activeTab === 'issue' && (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">
                Filter Courses
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Course Type</label>
                  <select
                    value={issueFilters.courseTypeId}
                    onChange={(e) => setIssueFilters({ ...issueFilters, courseTypeId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  >
                    <option value="">All Types</option>
                    {courseTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={issueFilters.startDate}
                    onChange={(e) => setIssueFilters({ ...issueFilters, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={issueFilters.endDate}
                    onChange={(e) => setIssueFilters({ ...issueFilters, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => setIssueFilters({ courseTypeId: '', startDate: '', endDate: '' })}
                    className="px-4 py-2 text-sm border border-slate-700 hover:border-slate-600 rounded transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-tabs for Private vs Open Courses */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setIssueSubTab('private')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  issueSubTab === 'private'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Private Courses ({bookings.length})
              </button>
              <button
                onClick={() => setIssueSubTab('open')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  issueSubTab === 'open'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Open Courses ({openCourseSessions.length})
              </button>
            </div>

            {issueSubTab === 'private' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Booked Courses (Chronological Order)
              </h2>

              {bookings.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
                  <Award className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-2">No booked courses found</p>
                  <p className="text-sm text-slate-500">
                    Courses with assigned course types will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map(booking => {
                    const courseType = (booking as any).course_types;
                    const requiredFields = (courseType?.required_fields || []) as CourseFieldDefinition[];
                    const isExpanded = expandedCourseId === booking.id;
                    const candidateCount = booking.candidates.length;
                    const passedCount = booking.candidates.filter(c => c.passed).length;
                    const withCerts = booking.candidates.filter(c => {
                      const cert = (c as any).certificate;
                      return cert && cert.status === 'issued';
                    }).length;

                    return (
                      <div
                        key={booking.id}
                        className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"
                      >
                        <div
                          className="p-4 cursor-pointer hover:bg-slate-900/80 transition-colors"
                          onClick={() => toggleCourse(booking.id)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <h3 className="font-semibold text-lg">{booking.title}</h3>
                                  <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                                    {courseType?.name}
                                  </span>
                                  <span className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded">
                                    {candidateCount} candidate{candidateCount !== 1 ? 's' : ''}
                                  </span>
                                  {passedCount > 0 && (
                                    <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded">
                                      {passedCount} passed
                                    </span>
                                  )}
                                  {withCerts > 0 && (
                                    <span className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                                      {withCerts} certified
                                    </span>
                                  )}
                                  {!isExpanded && requiredFields.length > 0 && (
                                    <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded">
                                      {requiredFields.length} field{requiredFields.length !== 1 ? 's' : ''} to complete
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-slate-500">Course Dates:</span>
                                    <span className="ml-2 text-slate-300">
                                      {formatDate(booking.booking_date)}
                                      {booking.num_days > 1 && ` - ${formatDate(booking.course_date_end)}`}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Trainer:</span>
                                    <span className="ml-2 text-slate-300">{booking.trainer_name}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Client:</span>
                                    <span className="ml-2 text-slate-300">{booking.client_name}</span>
                                  </div>
                                </div>
                                {!isExpanded && requiredFields.length > 0 && passedCount > 0 && passedCount > withCerts && (
                                  <div className="mt-3 text-xs text-slate-400 flex items-center gap-2">
                                    <ChevronDown className="w-4 h-4" />
                                    <span>Click to expand and complete certificate fields for passed candidates</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {passedCount > 0 && (
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                {passedCount > withCerts && (
                                  <button
                                    onClick={() => handleBulkGeneratePDFs(booking)}
                                    disabled={bulkGenerating === booking.id || !selectedTemplates[booking.id]}
                                    className="px-3 py-1.5 text-xs bg-green-500 hover:bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded transition-colors flex items-center gap-1.5"
                                  >
                                    {bulkGenerating === booking.id ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      <>
                                        <FileText className="w-3 h-3" />
                                        Generate All PDFs ({passedCount - withCerts})
                                      </>
                                    )}
                                  </button>
                                )}
                                {withCerts > 0 && (
                                  <button
                                    onClick={() => handleBulkEmailCertificates(booking)}
                                    disabled={bulkEmailing === booking.id}
                                    className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded transition-colors flex items-center gap-1.5"
                                  >
                                    {bulkEmailing === booking.id ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Sending...
                                      </>
                                    ) : (
                                      <>
                                        <Send className="w-3 h-3" />
                                        Email All Certificates ({withCerts})
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-800 bg-slate-950/50 p-4">
                            {(requiredFields.filter(f => f.scope === 'course').length > 0 || (booking.course_type_id && availableTemplates[booking.course_type_id])) && (
                              <div className="mb-6 bg-slate-900 border border-slate-800 rounded-lg p-4">
                                <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <Award className="w-4 h-4 text-blue-400" />
                                  Course-Level Information (applies to all candidates)
                                </h4>

                                {booking.course_type_id && availableTemplates[booking.course_type_id] && availableTemplates[booking.course_type_id].length > 0 && (
                                  <div className="mb-4 grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                                        Certificate Template *
                                      </label>
                                      <select
                                        value={selectedTemplates[booking.id] || ''}
                                        onChange={(e) => {
                                          const newTemplateId = e.target.value;
                                          setSelectedTemplates({ ...selectedTemplates, [booking.id]: newTemplateId });
                                          updateBookingCertificateTemplate(booking.id, newTemplateId);
                                        }}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                      >
                                        {availableTemplates[booking.course_type_id].map(template => (
                                          <option key={template.id} value={template.id}>{template.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Course Duration (override default)
                                      </label>
                                      <div className="flex gap-2">
                                        <input
                                          type="number"
                                          min="0"
                                          placeholder={courseType?.duration_days ?
                                            `${courseType.duration_days} ${courseType.duration_unit || 'days'} (default)` :
                                            'Not set'}
                                          value={bookingDurations[booking.id]?.value || ''}
                                          onChange={(e) => {
                                            const newValue = e.target.value ? parseInt(e.target.value) : null;
                                            const unit = bookingDurations[booking.id]?.unit || 'days';
                                            setBookingDurations({
                                              ...bookingDurations,
                                              [booking.id]: {
                                                value: newValue,
                                                unit: unit
                                              }
                                            });
                                            updateBookingDuration(booking.id, newValue, unit);
                                          }}
                                          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                        />
                                        <select
                                          value={bookingDurations[booking.id]?.unit || 'days'}
                                          onChange={(e) => {
                                            const newUnit = e.target.value as 'hours' | 'days';
                                            const value = bookingDurations[booking.id]?.value || null;
                                            setBookingDurations({
                                              ...bookingDurations,
                                              [booking.id]: {
                                                value: value,
                                                unit: newUnit
                                              }
                                            });
                                            updateBookingDuration(booking.id, value, newUnit);
                                          }}
                                          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                        >
                                          <option value="hours">Hours</option>
                                          <option value="days">Days</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {requiredFields.filter(f => f.scope === 'course').length > 0 && (
                                  <div className="grid grid-cols-2 gap-3">
                                  {requiredFields.filter(f => f.scope === 'course').map(field => {
                                    const hasDefault = isDefaultValue(booking, field.name);
                                    return (
                                      <div key={field.name}>
                                        <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                                          {field.label}{field.required && ' *'}
                                          {hasDefault && (
                                            <span className="text-xs text-blue-400" title="Using course type default">
                                              (default)
                                            </span>
                                          )}
                                        </label>
                                      {field.type === 'dropdown' ? (
                                        <select
                                          value={courseLevelData[booking.id]?.[field.name] || ''}
                                          onChange={(e) => updateCourseLevelField(booking.id, field.name, e.target.value)}
                                          className={`w-full px-3 py-2 border rounded text-sm ${
                                            hasDefault
                                              ? 'bg-blue-500/5 border-blue-500/30'
                                              : 'bg-slate-950 border-slate-700'
                                          }`}
                                        >
                                          <option value="">Select...</option>
                                          {field.options?.map(option => (
                                            <option key={option} value={option}>{option}</option>
                                          ))}
                                        </select>
                                      ) : field.type === 'number' ? (
                                        field.unit ? (
                                          <div className="flex gap-2">
                                            <input
                                              type="number"
                                              value={courseLevelData[booking.id]?.[field.name] || ''}
                                              onChange={(e) => updateCourseLevelField(booking.id, field.name, parseFloat(e.target.value) || 0)}
                                              placeholder={field.placeholder}
                                              className={`flex-1 px-3 py-2 border rounded text-sm ${
                                                hasDefault
                                                  ? 'bg-blue-500/5 border-blue-500/30'
                                                  : 'bg-slate-950 border-slate-700'
                                              }`}
                                            />
                                            <select
                                              value={courseLevelData[booking.id]?.[`${field.name}_unit`] || field.unit}
                                              onChange={(e) => updateCourseLevelField(booking.id, `${field.name}_unit`, e.target.value)}
                                              className={`px-3 py-2 border rounded text-sm ${
                                                hasDefault
                                                  ? 'bg-blue-500/5 border-blue-500/30'
                                                  : 'bg-slate-950 border-slate-700'
                                              }`}
                                            >
                                              <option value="hours">Hours</option>
                                              <option value="days">Days</option>
                                            </select>
                                          </div>
                                        ) : (
                                          <input
                                            type="number"
                                            value={courseLevelData[booking.id]?.[field.name] || ''}
                                            onChange={(e) => updateCourseLevelField(booking.id, field.name, parseFloat(e.target.value) || 0)}
                                            placeholder={field.placeholder}
                                            className={`w-full px-3 py-2 border rounded text-sm ${
                                              hasDefault
                                                ? 'bg-blue-500/5 border-blue-500/30'
                                                : 'bg-slate-950 border-slate-700'
                                            }`}
                                          />
                                        )
                                      ) : field.type === 'date' ? (
                                        <input
                                          type="date"
                                          value={courseLevelData[booking.id]?.[field.name] || ''}
                                          onChange={(e) => updateCourseLevelField(booking.id, field.name, e.target.value)}
                                          className={`w-full px-3 py-2 border rounded text-sm ${
                                            hasDefault
                                              ? 'bg-blue-500/5 border-blue-500/30'
                                              : 'bg-slate-950 border-slate-700'
                                          }`}
                                        />
                                      ) : (
                                        <input
                                          type="text"
                                          value={courseLevelData[booking.id]?.[field.name] || ''}
                                          onChange={(e) => updateCourseLevelField(booking.id, field.name, e.target.value)}
                                          placeholder={field.placeholder}
                                          className={`w-full px-3 py-2 border rounded text-sm ${
                                            hasDefault
                                              ? 'bg-blue-500/5 border-blue-500/30'
                                              : 'bg-slate-950 border-slate-700'
                                          }`}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                                </div>
                                )}
                              </div>
                            )}

                            <h4 className="text-sm font-semibold uppercase tracking-wider mb-3">
                              Candidates
                            </h4>
                            <div className="space-y-3">
                              {booking.candidates.map(candidate => {
                                const cert = (candidate as any).certificate;

                                return (
                                  <div
                                    key={candidate.id}
                                    className="bg-slate-900 border border-slate-800 rounded-lg p-4"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <h5 className="font-semibold">{candidate.candidate_name}</h5>
                                          {candidate.passed && (
                                            <CheckCircle className="w-4 h-4 text-green-400" />
                                          )}
                                          {cert && cert.status === 'issued' && (
                                            <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                                              Certificate Issued
                                            </span>
                                          )}
                                          {cert && cert.status === 'revoked' && (
                                            <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded flex items-center gap-1">
                                              <XCircle className="w-3 h-3" />
                                              Certificate Revoked
                                            </span>
                                          )}
                                        </div>
                                        {candidate.email && (
                                          <p className="text-xs text-slate-400 mb-3">{candidate.email}</p>
                                        )}

                                        {candidate.passed && !cert && requiredFields.filter(f => f.scope === 'candidate').length > 0 && (
                                          <div className="grid grid-cols-2 gap-3 mb-3">
                                            {requiredFields.filter(f => f.scope === 'candidate').map(field => {
                                              const hasDefault = isCandidateDefaultValue(candidate.id, field.name, booking);
                                              return (
                                                <div key={field.name}>
                                                  <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                                                    {field.label}{field.required && ' *'}
                                                    {hasDefault && (
                                                      <span className="text-xs text-green-400" title="Using course type default">
                                                        (default)
                                                      </span>
                                                    )}
                                                  </label>
                                                {field.type === 'dropdown' ? (
                                                  <select
                                                    value={candidateFieldData[candidate.id]?.[field.name] || ''}
                                                    onChange={(e) => updateCandidateField(candidate.id, field.name, e.target.value)}
                                                    className={`w-full px-3 py-2 border rounded text-sm ${
                                                      hasDefault
                                                        ? 'bg-green-500/5 border-green-500/30'
                                                        : 'bg-slate-950 border-slate-700'
                                                    }`}
                                                  >
                                                    <option value="">Select...</option>
                                                    {field.options?.map(option => (
                                                      <option key={option} value={option}>{option}</option>
                                                    ))}
                                                  </select>
                                                ) : field.type === 'number' ? (
                                                  <input
                                                    type="number"
                                                    value={candidateFieldData[candidate.id]?.[field.name] || ''}
                                                    onChange={(e) => updateCandidateField(candidate.id, field.name, parseFloat(e.target.value) || 0)}
                                                    placeholder={field.placeholder}
                                                    className={`w-full px-3 py-2 border rounded text-sm ${
                                                      hasDefault
                                                        ? 'bg-green-500/5 border-green-500/30'
                                                        : 'bg-slate-950 border-slate-700'
                                                    }`}
                                                  />
                                                ) : field.type === 'date' ? (
                                                  <input
                                                    type="date"
                                                    value={candidateFieldData[candidate.id]?.[field.name] || ''}
                                                    onChange={(e) => updateCandidateField(candidate.id, field.name, e.target.value)}
                                                    className={`w-full px-3 py-2 border rounded text-sm ${
                                                      hasDefault
                                                        ? 'bg-green-500/5 border-green-500/30'
                                                        : 'bg-slate-950 border-slate-700'
                                                    }`}
                                                  />
                                                ) : (
                                                  <input
                                                    type="text"
                                                    value={candidateFieldData[candidate.id]?.[field.name] || ''}
                                                    onChange={(e) => updateCandidateField(candidate.id, field.name, e.target.value)}
                                                    placeholder={field.placeholder}
                                                    className={`w-full px-3 py-2 border rounded text-sm ${
                                                      hasDefault
                                                        ? 'bg-green-500/5 border-green-500/30'
                                                        : 'bg-slate-950 border-slate-700'
                                                    }`}
                                                  />
                                                )}
                                              </div>
                                            );
                                          })}
                                          </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                          {candidate.passed && !cert && (
                                            <button
                                              onClick={() => handleGenerateCertificate(booking, candidate)}
                                              disabled={generatingFor === candidate.id}
                                              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
                                            >
                                              <Award className="w-4 h-4" />
                                              {generatingFor === candidate.id ? 'Generating...' : 'Generate Certificate'}
                                            </button>
                                          )}

                                          {cert && cert.status === 'issued' && (
                                            <>
                                              <button
                                                onClick={() => handleDownloadCertificate(cert)}
                                                disabled={regeneratingPdf === cert.id}
                                                className="flex items-center gap-2 px-3 py-2 text-sm bg-green-500/20 text-green-400 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                <Download className="w-4 h-4" />
                                                {regeneratingPdf === cert.id ? 'Generating...' : (cert.certificate_pdf_url ? 'Download' : 'Generate PDF')}
                                              </button>
                                              <button
                                                onClick={() => handleEmailCertificate(cert)}
                                                disabled={!cert.certificate_pdf_url || sendingEmailFor === cert.id}
                                                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                <Send className="w-4 h-4" />
                                                {sendingEmailFor === cert.id ? 'Sending...' : 'Send to Candidate'}
                                              </button>
                                              <button
                                                onClick={() => setShowRevokeModal(cert.id)}
                                                className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
                                              >
                                                <Ban className="w-4 h-4" />
                                                Revoke
                                              </button>
                                              <span className="text-xs text-slate-500 ml-2">
                                                Cert #{cert.certificate_number}
                                              </span>
                                            </>
                                          )}
                                          {cert && cert.status === 'revoked' && (
                                            <div className="flex items-center gap-2">
                                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded">
                                                <XCircle className="w-3 h-3" />
                                                Revoked
                                              </span>
                                              <span className="text-xs text-slate-500">
                                                Cert #{cert.certificate_number}
                                              </span>
                                              {candidate.passed && (
                                                <button
                                                  onClick={() => handleGenerateCertificate(booking, candidate)}
                                                  disabled={generatingFor === candidate.id}
                                                  className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
                                                >
                                                  <Award className="w-4 h-4" />
                                                  {generatingFor === candidate.id ? 'Generating...' : 'Generate New Certificate'}
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <label className={`flex flex-col items-center gap-1 self-start ${cert && cert.status === 'issued' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                        <input
                                          type="checkbox"
                                          checked={candidate.passed}
                                          onChange={(e) => handlePassStatusChange(candidate.id, e.target.checked)}
                                          disabled={cert && cert.status === 'issued'}
                                          className="w-4 h-4 rounded disabled:cursor-not-allowed"
                                        />
                                        <span className="text-xs text-slate-400">Passed</span>
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {issueSubTab === 'open' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Open Course Sessions (Chronological Order)
              </h2>

              {openCourseSessions.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
                  <Award className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-2">No open course sessions found</p>
                  <p className="text-sm text-slate-500">
                    Open courses with assigned course types and delegates will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {openCourseSessions.map(session => {
                    const courseType = session.course_types;
                    const requiredFields = (courseType?.required_fields || []) as CourseFieldDefinition[];
                    const isExpanded = expandedCourseId === session.id;
                    const delegateCount = session.delegates.length;
                    const attendedCount = session.delegates.filter(d =>
                      d.attendance_status === 'attended' || d.attendance_detail === 'attended'
                    ).length;
                    const withCerts = session.delegates.filter(d =>
                      d.certificate && d.certificate.status === 'issued'
                    ).length;

                    return (
                      <div
                        key={session.id}
                        className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"
                      >
                        <div
                          className="p-4 cursor-pointer hover:bg-slate-900/80 transition-colors"
                          onClick={() => toggleCourse(session.id)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <h3 className="font-semibold text-lg">{session.event_title}</h3>
                                  <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded">
                                    Open Course
                                  </span>
                                  <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                                    {courseType?.name}
                                  </span>
                                  <span className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded">
                                    {delegateCount} delegate{delegateCount !== 1 ? 's' : ''}
                                  </span>
                                  {attendedCount > 0 && (
                                    <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded">
                                      {attendedCount} attended
                                    </span>
                                  )}
                                  {withCerts > 0 && (
                                    <span className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                                      {withCerts} certified
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-slate-500">Session Date:</span>
                                    <span className="ml-2 text-slate-300">
                                      {formatDate(session.session_date)}
                                      {session.end_date && session.end_date !== session.session_date && ` - ${formatDate(session.end_date)}`}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Trainer:</span>
                                    <span className="ml-2 text-slate-300">{session.trainer_name}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Venue:</span>
                                    <span className="ml-2 text-slate-300">{session.venue_name || 'Not set'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {attendedCount > 0 && (
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                {attendedCount > withCerts && (
                                  <button
                                    onClick={() => handleBulkGenerateOpenCourseCertificates(session)}
                                    disabled={bulkGenerating === session.id || !selectedTemplates[session.id]}
                                    className="px-3 py-1.5 text-xs bg-green-500 hover:bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded transition-colors flex items-center gap-1.5"
                                  >
                                    {bulkGenerating === session.id ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      <>
                                        <FileText className="w-3 h-3" />
                                        Generate All PDFs ({attendedCount - withCerts})
                                      </>
                                    )}
                                  </button>
                                )}
                                {withCerts > 0 && (
                                  <button
                                    onClick={() => handleBulkEmailOpenCourseCertificates(session)}
                                    disabled={bulkEmailing === session.id}
                                    className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded transition-colors flex items-center gap-1.5"
                                  >
                                    {bulkEmailing === session.id ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Sending...
                                      </>
                                    ) : (
                                      <>
                                        <Send className="w-3 h-3" />
                                        Email All Certificates ({withCerts})
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-800 bg-slate-950/50 p-4">
                            {(requiredFields.filter(f => f.scope === 'course').length > 0 || (session.course_type_id && availableTemplates[session.course_type_id])) && (
                              <div className="mb-6 bg-slate-900 border border-slate-800 rounded-lg p-4">
                                <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <Award className="w-4 h-4 text-blue-400" />
                                  Session-Level Information (applies to all delegates)
                                </h4>

                                {session.course_type_id && availableTemplates[session.course_type_id] && availableTemplates[session.course_type_id].length > 0 && (
                                  <div className="mb-4 grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                                        Certificate Template *
                                      </label>
                                      <select
                                        value={selectedTemplates[session.id] || ''}
                                        onChange={(e) => {
                                          setSelectedTemplates({ ...selectedTemplates, [session.id]: e.target.value });
                                        }}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                      >
                                        {availableTemplates[session.course_type_id].map(template => (
                                          <option key={template.id} value={template.id}>{template.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Course Duration (override default)
                                      </label>
                                      <div className="flex gap-2">
                                        <input
                                          type="number"
                                          min="0"
                                          placeholder={courseType?.duration_days ?
                                            `${courseType.duration_days} ${courseType.duration_unit || 'days'} (default)` :
                                            'Not set'}
                                          value={openCourseDurations[session.id]?.value || ''}
                                          onChange={(e) => {
                                            const newValue = e.target.value ? parseInt(e.target.value) : null;
                                            const unit = openCourseDurations[session.id]?.unit || 'days';
                                            setOpenCourseDurations({
                                              ...openCourseDurations,
                                              [session.id]: { value: newValue, unit }
                                            });
                                          }}
                                          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                        />
                                        <select
                                          value={openCourseDurations[session.id]?.unit || 'days'}
                                          onChange={(e) => {
                                            const newUnit = e.target.value as 'hours' | 'days';
                                            const value = openCourseDurations[session.id]?.value || null;
                                            setOpenCourseDurations({
                                              ...openCourseDurations,
                                              [session.id]: { value, unit: newUnit }
                                            });
                                          }}
                                          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                        >
                                          <option value="hours">Hours</option>
                                          <option value="days">Days</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {requiredFields.filter(f => f.scope === 'course').length > 0 && (
                                  <div className="grid grid-cols-2 gap-3">
                                    {requiredFields.filter(f => f.scope === 'course').map(field => (
                                      <div key={field.name}>
                                        <label className="block text-xs text-slate-400 mb-1">
                                          {field.label}{field.required && ' *'}
                                        </label>
                                        {field.type === 'dropdown' ? (
                                          <select
                                            value={openCourseSessionData[session.id]?.[field.name] || ''}
                                            onChange={(e) => updateOpenCourseSessionField(session.id, field.name, e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                          >
                                            <option value="">Select...</option>
                                            {field.options?.map(option => (
                                              <option key={option} value={option}>{option}</option>
                                            ))}
                                          </select>
                                        ) : field.type === 'number' ? (
                                          <input
                                            type="number"
                                            value={openCourseSessionData[session.id]?.[field.name] || ''}
                                            onChange={(e) => updateOpenCourseSessionField(session.id, field.name, parseFloat(e.target.value) || 0)}
                                            placeholder={field.placeholder}
                                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                          />
                                        ) : field.type === 'date' ? (
                                          <input
                                            type="date"
                                            value={openCourseSessionData[session.id]?.[field.name] || ''}
                                            onChange={(e) => updateOpenCourseSessionField(session.id, field.name, e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                          />
                                        ) : (
                                          <input
                                            type="text"
                                            value={openCourseSessionData[session.id]?.[field.name] || ''}
                                            onChange={(e) => updateOpenCourseSessionField(session.id, field.name, e.target.value)}
                                            placeholder={field.placeholder}
                                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <h4 className="text-sm font-semibold uppercase tracking-wider mb-3">
                              Delegates
                            </h4>
                            <div className="space-y-3">
                              {session.delegates.map(delegate => {
                                const cert = delegate.certificate;
                                const isAttended = delegate.attendance_status === 'attended' || delegate.attendance_detail === 'attended';

                                return (
                                  <div
                                    key={delegate.id}
                                    className="bg-slate-900 border border-slate-800 rounded-lg p-4"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <h5 className="font-semibold">{delegate.delegate_name}</h5>
                                          {isAttended && (
                                            <CheckCircle className="w-4 h-4 text-green-400" />
                                          )}
                                          {cert && cert.status === 'issued' && (
                                            <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                                              Certificate Issued
                                            </span>
                                          )}
                                        </div>
                                        {delegate.delegate_email && (
                                          <p className="text-xs text-slate-400 mb-3">{delegate.delegate_email}</p>
                                        )}

                                        {isAttended && !cert && requiredFields.filter(f => f.scope === 'candidate').length > 0 && (
                                          <div className="grid grid-cols-2 gap-3 mb-3">
                                            {requiredFields.filter(f => f.scope === 'candidate').map(field => (
                                              <div key={field.name}>
                                                <label className="block text-xs text-slate-400 mb-1">
                                                  {field.label}{field.required && ' *'}
                                                </label>
                                                {field.type === 'dropdown' ? (
                                                  <select
                                                    value={openCourseDelegateData[delegate.id]?.[field.name] || ''}
                                                    onChange={(e) => updateOpenCourseDelegateField(delegate.id, field.name, e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                                  >
                                                    <option value="">Select...</option>
                                                    {field.options?.map(option => (
                                                      <option key={option} value={option}>{option}</option>
                                                    ))}
                                                  </select>
                                                ) : field.type === 'number' ? (
                                                  <input
                                                    type="number"
                                                    value={openCourseDelegateData[delegate.id]?.[field.name] || ''}
                                                    onChange={(e) => updateOpenCourseDelegateField(delegate.id, field.name, parseFloat(e.target.value) || 0)}
                                                    placeholder={field.placeholder}
                                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                                  />
                                                ) : field.type === 'date' ? (
                                                  <input
                                                    type="date"
                                                    value={openCourseDelegateData[delegate.id]?.[field.name] || ''}
                                                    onChange={(e) => updateOpenCourseDelegateField(delegate.id, field.name, e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                                  />
                                                ) : (
                                                  <input
                                                    type="text"
                                                    value={openCourseDelegateData[delegate.id]?.[field.name] || ''}
                                                    onChange={(e) => updateOpenCourseDelegateField(delegate.id, field.name, e.target.value)}
                                                    placeholder={field.placeholder}
                                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                                                  />
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                          {isAttended && !cert && (
                                            <button
                                              onClick={() => handleGenerateOpenCourseCertificate(session, delegate)}
                                              disabled={generatingFor === delegate.id}
                                              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
                                            >
                                              <Award className="w-4 h-4" />
                                              {generatingFor === delegate.id ? 'Generating...' : 'Generate Certificate'}
                                            </button>
                                          )}

                                          {cert && cert.status === 'issued' && (
                                            <>
                                              <button
                                                onClick={() => {
                                                  if (cert.certificate_pdf_url) {
                                                    window.open(cert.certificate_pdf_url, '_blank');
                                                  }
                                                }}
                                                disabled={!cert.certificate_pdf_url}
                                                className="flex items-center gap-2 px-3 py-2 text-sm bg-green-500/20 text-green-400 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50"
                                              >
                                                <Download className="w-4 h-4" />
                                                Download
                                              </button>
                                              <button
                                                onClick={async () => {
                                                  if (cert.certificate_pdf_url) {
                                                    setSendingEmailFor(cert.id);
                                                    try {
                                                      const success = await sendCertificateEmail(delegate.delegate_email, {
                                                        candidate_name: delegate.delegate_name,
                                                        course_type: courseType?.name || 'Training Course',
                                                        certificate_number: cert.certificate_number,
                                                        course_date: `${formatDate(session.session_date)} - ${formatDate(session.session_end_date)}`,
                                                        trainer_name: session.trainer_name,
                                                        issue_date: formatDate(new Date().toISOString()),
                                                        expiry_date: 'N/A',
                                                        certificate_pdf_url: cert.certificate_pdf_url,
                                                      });
                                                      if (success) {
                                                        setNotification({ type: 'success', message: `Certificate emailed to ${delegate.delegate_name}` });
                                                      } else {
                                                        setNotification({ type: 'error', message: 'Failed to send email' });
                                                      }
                                                    } catch (error) {
                                                      setNotification({ type: 'error', message: 'Failed to send email' });
                                                    } finally {
                                                      setSendingEmailFor(null);
                                                    }
                                                  }
                                                }}
                                                disabled={!cert.certificate_pdf_url || sendingEmailFor === cert.id}
                                                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                                              >
                                                <Send className="w-4 h-4" />
                                                {sendingEmailFor === cert.id ? 'Sending...' : 'Send to Delegate'}
                                              </button>
                                              <button
                                                onClick={() => setShowRevokeModal(cert.id)}
                                                className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
                                              >
                                                <Ban className="w-4 h-4" />
                                                Revoke
                                              </button>
                                              <span className="text-xs text-slate-500 ml-2">
                                                Cert #{cert.certificate_number}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <label className={`flex flex-col items-center gap-1 self-start ${cert && cert.status === 'issued' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                        <input
                                          type="checkbox"
                                          checked={isAttended}
                                          onChange={(e) => handleDelegateAttendanceChange(delegate.id, e.target.checked)}
                                          disabled={cert && cert.status === 'issued'}
                                          className="w-4 h-4 rounded disabled:cursor-not-allowed"
                                        />
                                        <span className="text-xs text-slate-400">Attended</span>
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}
          </>
        )}

        {activeTab === 'view' && (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">
                Filter Certificates
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Course Type</label>
                  <select
                    value={viewFilters.courseTypeId}
                    onChange={(e) => setViewFilters({ ...viewFilters, courseTypeId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  >
                    <option value="">All Types</option>
                    {courseTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Status</label>
                  <select
                    value={viewFilters.status}
                    onChange={(e) => setViewFilters({ ...viewFilters, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="issued">Issued</option>
                    <option value="expired">Expired</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Expiry Status</label>
                  <select
                    value={viewFilters.expiryStatus}
                    onChange={(e) => setViewFilters({ ...viewFilters, expiryStatus: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  >
                    <option value="">All</option>
                    <option value="valid">Valid</option>
                    <option value="expiring_soon">Expiring Soon</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={viewFilters.startDate}
                    onChange={(e) => setViewFilters({ ...viewFilters, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={viewFilters.endDate}
                    onChange={(e) => setViewFilters({ ...viewFilters, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={viewFilters.searchTerm}
                      onChange={(e) => setViewFilters({ ...viewFilters, searchTerm: e.target.value })}
                      placeholder="Name or cert number..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {Object.keys(groupedCertificates).length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
                  <Award className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-2">No certificates found</p>
                  <p className="text-sm text-slate-500">
                    Certificates will appear here once they are issued from courses
                  </p>
                </div>
              ) : (
                Object.entries(groupedCertificates).map(([courseType, certs]) => (
                  <div key={courseType} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                    <div className="bg-slate-900/80 border-b border-slate-800 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Award className="w-4 h-4 text-blue-400" />
                          {courseType}
                        </h3>
                        <span className="text-xs text-slate-400">
                          {certs.length} {certs.length === 1 ? 'certificate' : 'certificates'}
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-800">
                      {certs.map(cert => (
                        <div key={cert.id} className="p-4 hover:bg-slate-900/50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="font-semibold">{cert.candidate_name}</h4>
                                {getStatusBadge(cert.status, cert.revoked_reason)}
                                {getExpiryBadge(cert.expiry_date)}
                                {cert.sent_at && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                                    <Mail className="w-3 h-3" />
                                    Sent
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                                <div>
                                  <span className="text-slate-500">Certificate No:</span>
                                  <span className="ml-2 font-mono text-blue-400">{cert.certificate_number}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Issue Date:</span>
                                  <span className="ml-2 text-slate-300">{formatDate(cert.issue_date)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Expiry Date:</span>
                                  <span className="ml-2 text-slate-300">
                                    {cert.expiry_date ? formatDate(cert.expiry_date) : 'No Expiry'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Trainer:</span>
                                  <span className="ml-2 text-slate-300">{cert.trainer_name || 'N/A'}</span>
                                </div>
                              </div>

                              {cert.candidate_email && (
                                <div className="text-xs text-slate-400 mt-1">
                                  {cert.candidate_email}
                                </div>
                              )}

                              {cert.course_specific_data && Object.keys(cert.course_specific_data).length > 0 && (
                                <details className="mt-2">
                                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                                    View course details
                                  </summary>
                                  <div className="mt-2 p-2 bg-slate-950 rounded text-xs space-y-1">
                                    {Object.entries(cert.course_specific_data).map(([key, value]) => (
                                      <div key={key}>
                                        <span className="text-slate-500">{key}:</span>
                                        <span className="ml-2 text-slate-300">{String(value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {cert.status === 'issued' && (
                                <>
                                  <button
                                    onClick={() => handleDownloadCertificate(cert)}
                                    disabled={regeneratingPdf === cert.id}
                                    className="flex items-center gap-1 px-3 py-2 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                  >
                                    <Download className="w-3 h-3" />
                                    {regeneratingPdf === cert.id ? 'Generating...' : (cert.certificate_pdf_url ? 'Download' : 'Generate PDF')}
                                  </button>
                                  <button
                                    onClick={() => handleEmailCertificate(cert)}
                                    disabled={!cert.certificate_pdf_url || sendingEmailFor === cert.id}
                                    className="flex items-center gap-1 px-3 py-2 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                  >
                                    <Send className="w-3 h-3" />
                                    {sendingEmailFor === cert.id ? 'Sending...' : 'Send to Candidate'}
                                  </button>
                                  <button
                                    onClick={() => setShowRevokeModal(cert.id)}
                                    className="flex items-center gap-1 px-3 py-2 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors whitespace-nowrap"
                                  >
                                    <Ban className="w-3 h-3" />
                                    Revoke
                                  </button>
                                </>
                              )}
                              {cert.status === 'revoked' && (
                                <span className="text-xs text-red-400">Certificate has been revoked</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 text-center text-sm text-slate-500">
              Showing {certificates.length} {certificates.length === 1 ? 'certificate' : 'certificates'}
            </div>
          </>
        )}
      </main>

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {showRevokeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-400" />
              Revoke Certificate
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              This action will revoke the certificate. Please provide a reason for the revocation.
            </p>
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Reason for Revocation *</label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g., Issued in error, candidate failed re-assessment..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRevokeModal(null);
                  setRevokeReason('');
                }}
                disabled={revokingCertId !== null}
                className="px-4 py-2 text-sm border border-slate-700 hover:border-slate-600 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevokeCertificate(showRevokeModal)}
                disabled={revokingCertId !== null || !revokeReason.trim()}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {revokingCertId === showRevokeModal ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Revoking...
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    Revoke Certificate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
