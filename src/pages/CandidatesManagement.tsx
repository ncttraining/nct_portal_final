import { useState, useEffect } from 'react';
import { Users, Search, Mail, Edit2, Eye, Link2, X, Save, Download, AlertCircle, CheckCircle, Clock, XCircle, Send } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notification from '../components/Notification';
import {
  getAllCandidates,
  getCandidateHistory,
  updateCandidateDetails,
  linkCandidateToClient,
  getClients,
  getDaysSinceCompletion,
  getDaysUntilExpiry,
  getExpiryStatus,
  getCompletionStatus,
  formatDate,
  CandidateWithDetails,
  CandidateHistory,
  ExpiryStatus,
  CompletionStatus
} from '../lib/candidates';
import { getCourseTypes } from '../lib/certificates';
import { sendTemplateEmail, sendCertificateEmail } from '../lib/email';
import type { CourseType } from '../lib/certificates';

interface CandidatesManagementProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

type NotificationState = {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
} | null;

type SortField = 'name' | 'email' | 'course_date' | 'days_until_expiry';
type SortDirection = 'asc' | 'desc';

export default function CandidatesManagement({ currentPage, onNavigate }: CandidatesManagementProps) {
  const [candidates, setCandidates] = useState<CandidateWithDetails[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('');
  const [selectedCourseTypeFilter, setSelectedCourseTypeFilter] = useState('');
  const [selectedExpiryFilter, setSelectedExpiryFilter] = useState<ExpiryStatus | ''>('');
  const [selectedCompletionFilter, setSelectedCompletionFilter] = useState<CompletionStatus | ''>('');

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateWithDetails | null>(null);
  const [selectedCandidateHistory, setSelectedCandidateHistory] = useState<CandidateHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<CandidateWithDetails | null>(null);
  const [editForm, setEditForm] = useState({ candidate_name: '', email: '', telephone: '', client_id: '' });

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailingCandidate, setEmailingCandidate] = useState<CandidateWithDetails | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingCertificateFor, setSendingCertificateFor] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [candidatesData, clientsData, courseTypesData] = await Promise.all([
      getAllCandidates(),
      getClients(),
      getCourseTypes()
    ]);

    setCandidates(candidatesData);
    setClients(clientsData);
    setCourseTypes(courseTypesData);
    setLoading(false);
  }

  async function handleViewDetails(candidate: CandidateWithDetails) {
    setSelectedCandidate(candidate);
    setLoadingHistory(true);
    setShowDetailsModal(true);

    const history = await getCandidateHistory(candidate.email, candidate.candidate_name);
    setSelectedCandidateHistory(history);
    setLoadingHistory(false);
  }

  function handleEditCandidate(candidate: CandidateWithDetails) {
    setEditingCandidate(candidate);
    setEditForm({
      candidate_name: candidate.candidate_name,
      email: candidate.email,
      telephone: candidate.telephone,
      client_id: candidate.client_id || ''
    });
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    if (!editingCandidate) return;

    try {
      await updateCandidateDetails(editingCandidate.id, {
        candidate_name: editForm.candidate_name,
        email: editForm.email,
        telephone: editForm.telephone,
        client_id: editForm.client_id || null
      });

      setNotification({ type: 'success', message: 'Candidate details updated successfully' });
      setShowEditModal(false);
      loadData();
    } catch (error) {
      console.error('Error updating candidate:', error);
      setNotification({ type: 'error', message: 'Failed to update candidate details' });
    }
  }

  function handleEmailCandidate(candidate: CandidateWithDetails) {
    setEmailingCandidate(candidate);
    setEmailSubject('');
    setEmailBody('');
    setShowEmailModal(true);
  }

  async function handleSendEmail() {
    if (!emailingCandidate || !emailSubject || !emailBody) {
      setNotification({ type: 'warning', message: 'Please fill in subject and body' });
      return;
    }

    setSendingEmail(true);

    try {
      const success = await sendTemplateEmail(
        emailingCandidate.email,
        'generic_candidate_email',
        {
          candidate_name: emailingCandidate.candidate_name,
          subject: emailSubject,
          body: emailBody
        }
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

  async function handleSendCertificate(booking: any) {
    if (!booking.certificate?.certificate_pdf_url) {
      setNotification({ type: 'warning', message: 'Certificate PDF not available yet' });
      return;
    }

    try {
      setSendingCertificateFor(booking.certificate.id);

      const courseDate = `${formatDate(booking.course_date_start)} - ${formatDate(booking.course_date_end)}`;

      const success = await sendCertificateEmail(booking.candidate_email, {
        candidate_name: booking.candidate_name,
        course_title: booking.title || 'Training Course',
        certificate_number: booking.certificate.certificate_number,
        course_date: courseDate,
        trainer_name: booking.certificate.trainer_name,
        issue_date: formatDate(booking.certificate.issue_date),
        expiry_date: booking.certificate.expiry_date ? formatDate(booking.certificate.expiry_date) : 'N/A',
        certificate_pdf_url: booking.certificate.certificate_pdf_url,
      });

      if (success) {
        setNotification({ type: 'success', message: `Certificate emailed to ${booking.candidate_name}` });
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

  function getFilteredAndSortedCandidates() {
    console.log('Filtering with:', {
      selectedClientFilter,
      selectedClientFilterType: typeof selectedClientFilter,
      totalCandidates: candidates.length,
      allClientIds: [...new Set(candidates.map(c => c.client_id))],
      sampleCandidates: candidates.slice(0, 5).map(c => ({
        name: c.candidate_name,
        client_id: c.client_id,
        client_id_type: typeof c.client_id,
        client_name: c.client_name,
        match: c.client_id === selectedClientFilter
      }))
    });

    let filtered = candidates.filter(c => {
      const matchesSearch = !searchTerm ||
        c.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesClient = selectedClientFilter === '' || c.client_id === selectedClientFilter;
      const matchesCourseType = !selectedCourseTypeFilter || c.course_type_id === selectedCourseTypeFilter;
      const matchesExpiry = !selectedExpiryFilter || getExpiryStatus(c.certificate_expiry_date) === selectedExpiryFilter;
      const matchesCompletion = !selectedCompletionFilter || getCompletionStatus(c.course_date_end) === selectedCompletionFilter;

      return matchesSearch && matchesClient && matchesCourseType && matchesExpiry && matchesCompletion;
    });

    console.log('After filtering:', {
      filteredCount: filtered.length,
      sampleFiltered: filtered.slice(0, 3).map(c => ({ name: c.candidate_name, client_id: c.client_id }))
    });

    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.candidate_name.toLowerCase();
          bVal = b.candidate_name.toLowerCase();
          break;
        case 'email':
          aVal = a.email.toLowerCase();
          bVal = b.email.toLowerCase();
          break;
        case 'course_date':
          aVal = new Date(a.course_date_end).getTime();
          bVal = new Date(b.course_date_end).getTime();
          break;
        case 'days_until_expiry':
          aVal = getDaysUntilExpiry(a.certificate_expiry_date) ?? 999999;
          bVal = getDaysUntilExpiry(b.certificate_expiry_date) ?? 999999;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function renderCompletionBadge(courseEndDate: string) {
    const daysSince = getDaysSinceCompletion(courseEndDate);
    const status = getCompletionStatus(courseEndDate);

    const colors = {
      fresh: 'bg-green-500/20 text-green-400 border-green-500/30',
      recent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      aging: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      old: 'bg-red-500/20 text-red-400 border-red-500/30'
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded ${colors[status]}`}>
        <Clock className="w-3 h-3" />
        {daysSince} days ago
      </span>
    );
  }

  function renderExpiryBadge(expiryDate: string | null) {
    const status = getExpiryStatus(expiryDate);
    const daysUntil = getDaysUntilExpiry(expiryDate);

    if (status === 'no_certificate') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded">
          <AlertCircle className="w-3 h-3" />
          No Certificate
        </span>
      );
    }

    const colors = {
      valid: 'bg-green-500/20 text-green-400 border-green-500/30',
      expiring_soon: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      urgent: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      expired: 'bg-red-500/20 text-red-400 border-red-500/30',
      no_certificate: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    };

    const icons = {
      valid: CheckCircle,
      expiring_soon: AlertCircle,
      urgent: AlertCircle,
      expired: XCircle,
      no_certificate: AlertCircle
    };

    const Icon = icons[status];

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded ${colors[status]}`}>
        <Icon className="w-3 h-3" />
        {daysUntil !== null && daysUntil >= 0 ? `${daysUntil} days` : 'Expired'}
      </span>
    );
  }

  const filteredCandidates = getFilteredAndSortedCandidates();

  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader
        title="Candidates Management"
        icon={Users}
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
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>

            <select
              value={selectedCourseTypeFilter}
              onChange={(e) => setSelectedCourseTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Course Types</option>
              {courseTypes.map(ct => (
                <option key={ct.id} value={ct.id}>{ct.name}</option>
              ))}
            </select>

            <select
              value={selectedExpiryFilter}
              onChange={(e) => setSelectedExpiryFilter(e.target.value as ExpiryStatus | '')}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Expiry Status</option>
              <option value="valid">Valid</option>
              <option value="expiring_soon">Expiring Soon</option>
              <option value="urgent">Urgent</option>
              <option value="expired">Expired</option>
              <option value="no_certificate">No Certificate</option>
            </select>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
            <span>Showing {filteredCandidates.length} of {candidates.length} candidates</span>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedClientFilter('');
                setSelectedCourseTypeFilter('');
                setSelectedExpiryFilter('');
                setSelectedCompletionFilter('');
              }}
              className="text-blue-400 hover:text-blue-300"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading candidates...</div>
        ) : filteredCandidates.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No candidates found matching your filters</p>
          </div>
        ) : (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-800">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('name')}
                    >
                      Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('email')}
                    >
                      Contact {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Client
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('course_date')}
                    >
                      Latest Course {sortField === 'course_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Completed
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('days_until_expiry')}
                    >
                      Certificate Expiry {sortField === 'days_until_expiry' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCandidates.map((candidate, index) => (
                    <tr
                      key={`${candidate.id}-${candidate.booking_id}-${index}`}
                      className="hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => handleViewDetails(candidate)}
                    >
                      <td className="px-4 py-3 text-white">
                        {candidate.candidate_name}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        <div>{candidate.email}</div>
                        <div className="text-slate-500">{candidate.telephone}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        {candidate.client_name ? (
                          <span className="inline-flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            {candidate.client_name}
                          </span>
                        ) : (
                          <span className="text-slate-500">No client</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        <div>{candidate.course_type_name}</div>
                        <div className="text-slate-500">{formatDate(candidate.booking_date)}</div>
                      </td>
                      <td className="px-4 py-3">
                        {renderCompletionBadge(candidate.course_date_end)}
                      </td>
                      <td className="px-4 py-3">
                        {renderExpiryBadge(candidate.certificate_expiry_date)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEmailCandidate(candidate)}
                            className="p-2 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
                            title="Send Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditCandidate(candidate)}
                            className="p-2 hover:bg-slate-700 text-slate-400 rounded transition-colors"
                            title="Edit Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleViewDetails(candidate)}
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

      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-white">Candidate History</h2>
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
              ) : selectedCandidate ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
                    <div>
                      <div className="text-sm text-slate-400">Name</div>
                      <div className="text-white">{selectedCandidate.candidate_name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Email</div>
                      <div className="text-white">{selectedCandidate.email}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Phone</div>
                      <div className="text-white">{selectedCandidate.telephone || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Client</div>
                      <div className="text-white">{selectedCandidate.client_name || 'No client'}</div>
                    </div>
                  </div>

                  {selectedCandidateHistory && selectedCandidateHistory.upcomingBookings.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-white mb-4">Upcoming Bookings</h3>
                      <div className="space-y-3">
                        {selectedCandidateHistory.upcomingBookings.map((booking) => (
                          <div key={booking.id} className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-medium text-white">{booking.course_type_name}</div>
                                <div className="text-sm text-slate-400">{booking.title}</div>
                              </div>
                              <div className="text-sm text-blue-400 font-medium">{formatDate(booking.booking_date)}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                              <div className="text-slate-400">Trainer: <span className="text-white">{booking.trainer_name}</span></div>
                              <div className="text-slate-400">
                                End Date: <span className="text-white">{formatDate(booking.course_date_end)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Completed Courses</h3>
                    {!selectedCandidateHistory || selectedCandidateHistory.completedBookings.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 bg-slate-800/30 rounded-lg">
                        No completed courses yet
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedCandidateHistory.completedBookings.map((booking) => (
                          <div key={booking.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-medium text-white">{booking.course_type_name}</div>
                                <div className="text-sm text-slate-400">{booking.title}</div>
                              </div>
                              <div className="text-sm text-slate-400">{formatDate(booking.booking_date)}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                              <div className="text-slate-400">Trainer: <span className="text-white">{booking.trainer_name}</span></div>
                              <div className="text-slate-400">
                                Status: {booking.passed ? (
                                  <span className="text-green-400">Passed</span>
                                ) : (
                                  <span className="text-red-400">Not Passed</span>
                                )}
                              </div>
                            </div>
                            {booking.certificate && booking.passed && (
                              <div className="mt-3 p-3 bg-slate-900/50 rounded border border-slate-700">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-slate-400">Certificate #{booking.certificate.certificate_number}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      Issued: {formatDate(booking.certificate.issue_date)} • Expires: {booking.certificate.expiry_date ? formatDate(booking.certificate.expiry_date) : 'N/A'}
                                    </div>
                                  </div>
                                  {booking.certificate.certificate_pdf_url && (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <a
                                        href={booking.certificate.certificate_pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors whitespace-nowrap"
                                      >
                                        <Download className="w-3 h-3" />
                                        Download
                                      </a>
                                      <button
                                        onClick={() => handleSendCertificate(booking)}
                                        disabled={sendingCertificateFor === booking.certificate.id}
                                        className="flex items-center gap-1 px-3 py-1 text-sm bg-green-500/20 text-green-400 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                      >
                                        <Send className="w-3 h-3" />
                                        {sendingCertificateFor === booking.certificate.id ? 'Sending...' : 'Send to Candidate'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {booking.passed && !booking.certificate && (
                              <div className="mt-3 p-3 bg-yellow-900/20 rounded border border-yellow-500/30">
                                <div className="text-sm text-yellow-400">Certificate not yet generated</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">No history found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingCandidate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-white">Edit Candidate Details</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Name</label>
                <input
                  type="text"
                  value={editForm.candidate_name}
                  onChange={(e) => setEditForm({ ...editForm, candidate_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Telephone</label>
                <input
                  type="tel"
                  value={editForm.telephone}
                  onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Client</label>
                <select
                  value={editForm.client_id}
                  onChange={(e) => setEditForm({ ...editForm, client_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">No client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && emailingCandidate && (
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
                <div className="text-white">{emailingCandidate.candidate_name} ({emailingCandidate.email})</div>
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
