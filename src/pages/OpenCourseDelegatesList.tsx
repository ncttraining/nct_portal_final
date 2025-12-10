import { useState, useEffect } from 'react';
import { Users, Search, Mail, Eye, X, Download, Send, Building2, CheckCircle, Clock, XCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notification from '../components/Notification';
import {
  getAllDelegates,
  getDelegateHistory,
  formatDate,
  getAttendanceStatus,
  getCertificateStatus,
  DelegateWithDetails,
  DelegateHistory,
  AttendanceStatusFilter,
  CertificateStatusFilter,
} from '../lib/open-course-delegates';
import { getCourseTypes, getActiveVenues } from '../lib/open-courses';
import { sendCertificateEmail, sendTemplateEmail } from '../lib/email';

interface OpenCourseDelegatesListProps {
  currentPage: string;
  onNavigate: (page: string, data?: any) => void;
}

type NotificationState = {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
} | null;

type SortField = 'name' | 'email' | 'session_date' | 'company';
type SortDirection = 'asc' | 'desc';

export default function OpenCourseDelegatesList({ currentPage, onNavigate }: OpenCourseDelegatesListProps) {
  const [delegates, setDelegates] = useState<DelegateWithDetails[]>([]);
  const [courseTypes, setCourseTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [venues, setVenues] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseType, setSelectedCourseType] = useState('');
  const [selectedVenue, setSelectedVenue] = useState('');
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceStatusFilter>('all');
  const [selectedCertificateStatus, setSelectedCertificateStatus] = useState<CertificateStatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('session_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modals
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDelegate, setSelectedDelegate] = useState<DelegateWithDetails | null>(null);
  const [selectedDelegateHistory, setSelectedDelegateHistory] = useState<DelegateHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailingDelegate, setEmailingDelegate] = useState<DelegateWithDetails | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingCertificateFor, setSendingCertificateFor] = useState<string | null>(null);

  // Bulk selection
  const [selectedDelegates, setSelectedDelegates] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [delegatesData, courseTypesData, venuesData] = await Promise.all([
        getAllDelegates(),
        getCourseTypes(),
        getActiveVenues(),
      ]);

      setDelegates(delegatesData);
      setCourseTypes(courseTypesData);
      setVenues(venuesData);
    } catch (error) {
      console.error('Error loading data:', error);
      setNotification({ type: 'error', message: 'Failed to load delegates' });
    } finally {
      setLoading(false);
    }
  }

  async function loadFilteredData() {
    setLoading(true);
    try {
      const delegatesData = await getAllDelegates({
        searchTerm,
        courseTypeId: selectedCourseType || undefined,
        venueId: selectedVenue || undefined,
        attendanceStatus: selectedAttendance,
        certificateStatus: selectedCertificateStatus,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setDelegates(delegatesData);
    } catch (error) {
      console.error('Error loading filtered data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFilteredData();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedCourseType, selectedVenue, selectedAttendance, selectedCertificateStatus, dateFrom, dateTo]);

  async function handleViewDetails(delegate: DelegateWithDetails) {
    setSelectedDelegate(delegate);
    setLoadingHistory(true);
    setShowDetailsModal(true);

    const history = await getDelegateHistory(delegate.delegate_email, delegate.delegate_name);
    setSelectedDelegateHistory(history);
    setLoadingHistory(false);
  }

  function handleEmailDelegate(delegate: DelegateWithDetails) {
    setEmailingDelegate(delegate);
    setEmailSubject('');
    setEmailBody('');
    setShowEmailModal(true);
  }

  async function handleSendEmail() {
    if (!emailingDelegate || !emailSubject || !emailBody) {
      setNotification({ type: 'warning', message: 'Please fill in subject and body' });
      return;
    }

    setSendingEmail(true);

    try {
      const success = await sendTemplateEmail(
        emailingDelegate.delegate_email,
        'generic_candidate_email',
        {
          candidate_name: emailingDelegate.delegate_name,
          subject: emailSubject,
          body: emailBody
        },
        undefined,
        { sendImmediately: true }
      );

      if (success) {
        setNotification({ type: 'success', message: 'Email sent successfully' });
        setShowEmailModal(false);
      } else {
        setNotification({ type: 'error', message: 'Failed to send email' });
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setNotification({ type: 'error', message: 'Failed to send email' });
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleSendCertificate(delegate: DelegateWithDetails) {
    if (!delegate.certificate?.certificate_pdf_url) {
      setNotification({ type: 'warning', message: 'Certificate PDF not available' });
      return;
    }

    setSendingCertificateFor(delegate.id);

    try {
      const success = await sendCertificateEmail(delegate.delegate_email, {
        candidate_name: delegate.delegate_name,
        course_type: delegate.course_type_name || 'Training Course',
        certificate_number: delegate.certificate.certificate_number,
        course_date: formatDate(delegate.session_date),
        trainer_name: delegate.trainer_name || '',
        issue_date: formatDate(delegate.certificate.issue_date),
        expiry_date: delegate.certificate.expiry_date ? formatDate(delegate.certificate.expiry_date) : 'N/A',
        certificate_pdf_url: delegate.certificate.certificate_pdf_url,
      });

      if (success) {
        setNotification({ type: 'success', message: `Certificate emailed to ${delegate.delegate_name}` });
      } else {
        setNotification({ type: 'error', message: 'Failed to send email' });
      }
    } catch (error) {
      console.error('Error sending certificate email:', error);
      setNotification({ type: 'error', message: 'Failed to send email' });
    } finally {
      setSendingCertificateFor(null);
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function getSortedDelegates() {
    return [...delegates].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.delegate_name.toLowerCase();
          bVal = b.delegate_name.toLowerCase();
          break;
        case 'email':
          aVal = a.delegate_email.toLowerCase();
          bVal = b.delegate_email.toLowerCase();
          break;
        case 'session_date':
          aVal = new Date(a.session_date).getTime();
          bVal = new Date(b.session_date).getTime();
          break;
        case 'company':
          aVal = (a.company_name || '').toLowerCase();
          bVal = (b.company_name || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function renderAttendanceBadge(delegate: DelegateWithDetails) {
    const status = getAttendanceStatus(delegate);

    const colors = {
      attended: 'bg-green-500/20 text-green-400 border-green-500/30',
      absent: 'bg-red-500/20 text-red-400 border-red-500/30',
      pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };

    const icons = {
      attended: CheckCircle,
      absent: XCircle,
      pending: Clock,
    };

    const labels = {
      attended: 'Attended',
      absent: 'Absent',
      pending: 'Pending',
    };

    const Icon = icons[status];

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded ${colors[status]}`}>
        <Icon className="w-3 h-3" />
        {labels[status]}
      </span>
    );
  }

  function renderCertificateBadge(delegate: DelegateWithDetails) {
    const status = getCertificateStatus(delegate);

    const colors = {
      issued: 'bg-green-500/20 text-green-400 border-green-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      not_applicable: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };

    const labels = {
      issued: 'Issued',
      pending: 'Pending',
      not_applicable: 'N/A',
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded ${colors[status]}`}>
        {labels[status]}
      </span>
    );
  }

  function handleSelectDelegate(delegateId: string) {
    const newSelected = new Set(selectedDelegates);
    if (newSelected.has(delegateId)) {
      newSelected.delete(delegateId);
    } else {
      newSelected.add(delegateId);
    }
    setSelectedDelegates(newSelected);
    setShowBulkActions(newSelected.size > 0);
  }

  function handleSelectAll() {
    if (selectedDelegates.size === delegates.length) {
      setSelectedDelegates(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedDelegates(new Set(delegates.map(d => d.id)));
      setShowBulkActions(true);
    }
  }

  async function handleBulkEmailCertificates() {
    const eligibleDelegates = delegates.filter(
      d => selectedDelegates.has(d.id) && d.certificate?.certificate_pdf_url
    );

    if (eligibleDelegates.length === 0) {
      setNotification({ type: 'warning', message: 'No delegates with certificates selected' });
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const delegate of eligibleDelegates) {
      try {
        const success = await sendCertificateEmail(delegate.delegate_email, {
          candidate_name: delegate.delegate_name,
          course_type: delegate.course_type_name || 'Training Course',
          certificate_number: delegate.certificate!.certificate_number,
          course_date: formatDate(delegate.session_date),
          trainer_name: delegate.trainer_name || '',
          issue_date: formatDate(delegate.certificate!.issue_date),
          expiry_date: delegate.certificate!.expiry_date ? formatDate(delegate.certificate!.expiry_date) : 'N/A',
          certificate_pdf_url: delegate.certificate!.certificate_pdf_url,
        });

        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setSelectedDelegates(new Set());
    setShowBulkActions(false);

    if (failCount === 0) {
      setNotification({ type: 'success', message: `${successCount} certificates sent successfully` });
    } else {
      setNotification({ type: 'warning', message: `${successCount} sent, ${failCount} failed` });
    }
  }

  function clearFilters() {
    setSearchTerm('');
    setSelectedCourseType('');
    setSelectedVenue('');
    setSelectedAttendance('all');
    setSelectedCertificateStatus('all');
    setDateFrom('');
    setDateTo('');
  }

  const sortedDelegates = getSortedDelegates();

  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader
        currentPage={currentPage}
        onNavigate={onNavigate}
      />

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl font-semibold text-white">Open Course Delegates</h1>
        </div>
        {/* Filters */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <select
              value={selectedCourseType}
              onChange={(e) => setSelectedCourseType(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Course Types</option>
              {courseTypes.map(ct => (
                <option key={ct.id} value={ct.id}>{ct.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <select
              value={selectedVenue}
              onChange={(e) => setSelectedVenue(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Venues</option>
              {venues.map(venue => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>

            <select
              value={selectedAttendance}
              onChange={(e) => setSelectedAttendance(e.target.value as AttendanceStatusFilter)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Attendance</option>
              <option value="attended">Attended</option>
              <option value="absent">Absent</option>
              <option value="pending">Pending</option>
            </select>

            <select
              value={selectedCertificateStatus}
              onChange={(e) => setSelectedCertificateStatus(e.target.value as CertificateStatusFilter)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Certificate Status</option>
              <option value="issued">Certificate Issued</option>
              <option value="pending">Certificate Pending</option>
              <option value="not_applicable">Not Applicable</option>
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From Date"
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
            />

            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To Date"
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
            <span>Showing {sortedDelegates.length} delegates</span>
            <button
              onClick={clearFilters}
              className="text-blue-400 hover:text-blue-300"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {showBulkActions && (
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-blue-400">
              {selectedDelegates.size} delegate(s) selected
            </span>
            <div className="flex gap-3">
              <button
                onClick={handleBulkEmailCertificates}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors"
              >
                <Send className="w-4 h-4" />
                Email Certificates
              </button>
              <button
                onClick={() => {
                  setSelectedDelegates(new Set());
                  setShowBulkActions(false);
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delegates Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading delegates...</div>
        ) : sortedDelegates.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No delegates found matching your filters</p>
          </div>
        ) : (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedDelegates.size === delegates.length && delegates.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('name')}
                    >
                      Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('company')}
                    >
                      Company {sortField === 'company' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('session_date')}
                    >
                      Course Date {sortField === 'session_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Attendance
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Certificate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sortedDelegates.map((delegate) => (
                    <tr
                      key={delegate.id}
                      className="hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => handleViewDetails(delegate)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedDelegates.has(delegate.id)}
                          onChange={() => handleSelectDelegate(delegate.id)}
                          className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white">{delegate.delegate_name}</div>
                        <div className="text-sm text-slate-400">{delegate.delegate_email}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        {delegate.company_name ? (
                          <span
                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (delegate.company_id) {
                                onNavigate('open-courses-company-details', { companyId: delegate.company_id });
                              }
                            }}
                          >
                            <Building2 className="w-3 h-3" />
                            {delegate.company_name}
                          </span>
                        ) : (
                          <span className="text-slate-500">No company</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        {formatDate(delegate.session_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        <div>{delegate.course_type_name || 'Unknown'}</div>
                        <div className="text-slate-500">{delegate.venue_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        {renderAttendanceBadge(delegate)}
                      </td>
                      <td className="px-4 py-3">
                        {renderCertificateBadge(delegate)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEmailDelegate(delegate)}
                            className="p-2 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
                            title="Send Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          {delegate.certificate?.certificate_pdf_url && (
                            <>
                              <a
                                href={delegate.certificate.certificate_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-green-500/20 text-green-400 rounded transition-colors"
                                title="Download Certificate"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => handleSendCertificate(delegate)}
                                disabled={sendingCertificateFor === delegate.id}
                                className="p-2 hover:bg-green-500/20 text-green-400 rounded transition-colors disabled:opacity-50"
                                title="Email Certificate"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleViewDetails(delegate)}
                            className="p-2 hover:bg-slate-700 text-slate-400 rounded transition-colors"
                            title="View History"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedDelegate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-white">Delegate History</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6">
              {loadingHistory ? (
                <div className="text-center py-12 text-slate-400">Loading history...</div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
                    <div>
                      <div className="text-sm text-slate-400">Name</div>
                      <div className="text-white">{selectedDelegate.delegate_name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Email</div>
                      <div className="text-white">{selectedDelegate.delegate_email}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Phone</div>
                      <div className="text-white">{selectedDelegate.delegate_phone || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Company</div>
                      <div className="text-white">{selectedDelegate.company_name || 'No company'}</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Course History</h3>
                    {!selectedDelegateHistory || selectedDelegateHistory.courses.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 bg-slate-800/30 rounded-lg">
                        No course history found
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedDelegateHistory.courses.map((course, index) => (
                          <div key={index} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-medium text-white">{course.course_type_name || 'Unknown Course'}</div>
                                <div className="text-sm text-slate-400">{course.event_title}</div>
                              </div>
                              <div className="text-sm text-slate-400">{formatDate(course.session_date)}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                              <div className="text-slate-400">
                                Venue: <span className="text-white">{course.venue_name || 'N/A'}</span>
                              </div>
                              <div className="text-slate-400">
                                Trainer: <span className="text-white">{course.trainer_name || 'N/A'}</span>
                              </div>
                            </div>
                            {course.certificate && (
                              <div className="mt-3 p-3 bg-slate-900/50 rounded border border-slate-700">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-slate-400">Certificate #{course.certificate.certificate_number}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      Issued: {formatDate(course.certificate.issue_date)} • Expires: {course.certificate.expiry_date ? formatDate(course.certificate.expiry_date) : 'N/A'}
                                    </div>
                                  </div>
                                  {course.certificate.certificate_pdf_url && (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <a
                                        href={course.certificate.certificate_pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors whitespace-nowrap"
                                      >
                                        <Download className="w-3 h-3" />
                                        Download
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && emailingDelegate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-white">Send Email</h2>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-800/50 rounded">
                <div className="text-sm text-slate-400">To:</div>
                <div className="text-white">{emailingDelegate.delegate_name} ({emailingDelegate.delegate_email})</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="Email subject..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Message</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="Email message..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {sendingEmail ? 'Sending...' : 'Send Email'}
                </button>
                <button
                  onClick={() => setShowEmailModal(false)}
                  disabled={sendingEmail}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
