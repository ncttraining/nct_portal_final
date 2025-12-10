import { useState, useEffect } from 'react';
import { Building2, Users, Award, Mail, Phone, MapPin, ArrowLeft, Download, Send, Eye, Edit2, X, Save, CheckCircle, Clock, XCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notification from '../components/Notification';
import {
  getOpenCourseCompanyById,
  getCompanyDelegates,
  getCompanyCourseSummary,
  updateOpenCourseCompany,
  OpenCourseCompanyWithStats,
  CompanyDelegate,
  CompanyCourseSummary,
} from '../lib/open-course-companies';
import { formatDate } from '../lib/open-course-delegates';
import { sendCertificateEmail } from '../lib/email';

interface OpenCourseCompanyDetailsProps {
  currentPage: string;
  onNavigate: (page: string, data?: any) => void;
  companyId?: string;
}

type NotificationState = {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
} | null;

export default function OpenCourseCompanyDetails({ currentPage, onNavigate, companyId }: OpenCourseCompanyDetailsProps) {
  const [company, setCompany] = useState<OpenCourseCompanyWithStats | null>(null);
  const [delegates, setDelegates] = useState<CompanyDelegate[]>([]);
  const [courseSummary, setCourseSummary] = useState<CompanyCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'delegates' | 'courses' | 'details'>('delegates');

  // Edit mode
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    telephone: '',
    address1: '',
    address2: '',
    town: '',
    postcode: '',
    notes: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);

  // Bulk selection
  const [selectedDelegates, setSelectedDelegates] = useState<Set<string>>(new Set());
  const [sendingCertificateFor, setSendingCertificateFor] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) {
      loadCompanyData();
    }
  }, [companyId]);

  async function loadCompanyData() {
    if (!companyId) return;

    setLoading(true);
    try {
      const [companyData, delegatesData, summaryData] = await Promise.all([
        getOpenCourseCompanyById(companyId),
        getCompanyDelegates(companyId),
        getCompanyCourseSummary(companyId),
      ]);

      if (companyData) {
        setCompany(companyData);
        setFormData({
          name: companyData.name,
          contact_name: companyData.contact_name || '',
          email: companyData.email || '',
          telephone: companyData.telephone || '',
          address1: companyData.address1 || '',
          address2: companyData.address2 || '',
          town: companyData.town || '',
          postcode: companyData.postcode || '',
          notes: companyData.notes || '',
          active: companyData.active,
        });
      }
      setDelegates(delegatesData);
      setCourseSummary(summaryData);
    } catch (error) {
      console.error('Error loading company data:', error);
      setNotification({ type: 'error', message: 'Failed to load company data' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCompany() {
    if (!companyId || !formData.name.trim()) {
      setNotification({ type: 'warning', message: 'Company name is required' });
      return;
    }

    setSaving(true);

    try {
      await updateOpenCourseCompany(companyId, {
        name: formData.name.trim(),
        contact_name: formData.contact_name.trim() || null,
        email: formData.email.trim() || null,
        telephone: formData.telephone.trim() || null,
        address1: formData.address1.trim() || null,
        address2: formData.address2.trim() || null,
        town: formData.town.trim() || null,
        postcode: formData.postcode.trim() || null,
        notes: formData.notes.trim() || null,
        active: formData.active,
      });

      setNotification({ type: 'success', message: 'Company updated successfully' });
      setShowEditModal(false);
      loadCompanyData();
    } catch (error) {
      console.error('Error saving company:', error);
      setNotification({ type: 'error', message: 'Failed to save company' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendCertificate(delegate: CompanyDelegate) {
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
        trainer_name: '',
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

  function handleSelectDelegate(delegateId: string) {
    const newSelected = new Set(selectedDelegates);
    if (newSelected.has(delegateId)) {
      newSelected.delete(delegateId);
    } else {
      newSelected.add(delegateId);
    }
    setSelectedDelegates(newSelected);
  }

  function handleSelectAll() {
    if (selectedDelegates.size === delegates.length) {
      setSelectedDelegates(new Set());
    } else {
      setSelectedDelegates(new Set(delegates.map(d => d.id)));
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
          trainer_name: '',
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

    if (failCount === 0) {
      setNotification({ type: 'success', message: `${successCount} certificates sent successfully` });
    } else {
      setNotification({ type: 'warning', message: `${successCount} sent, ${failCount} failed` });
    }
  }

  function renderAttendanceBadge(delegate: CompanyDelegate) {
    const attended = delegate.attendance_detail === 'attended' ||
      delegate.attendance_detail === 'late' ||
      delegate.attendance_detail === 'left_early';
    const absent = delegate.attendance_detail === 'absent';

    if (attended) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded">
          <CheckCircle className="w-3 h-3" />
          Attended
        </span>
      );
    }

    if (absent) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded">
          <XCircle className="w-3 h-3" />
          Absent
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <PageHeader
          title="Company Details"
          icon={Building2}
          currentPage={currentPage}
          onNavigate={onNavigate}
        />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center py-12 text-slate-400">Loading company data...</div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-slate-950">
        <PageHeader
          title="Company Details"
          icon={Building2}
          currentPage={currentPage}
          onNavigate={onNavigate}
        />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center py-12 text-slate-400">
            <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Company not found</p>
            <button
              onClick={() => onNavigate('open-courses-companies')}
              className="mt-4 text-blue-400 hover:text-blue-300"
            >
              Back to Companies
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader
        title={company.name}
        icon={Building2}
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
        {/* Back button */}
        <button
          onClick={() => onNavigate('open-courses-companies')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Companies
        </button>

        {/* Company Header */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Building2 className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">{company.name}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                  {company.town && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {company.town}
                    </span>
                  )}
                  {company.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {company.email}
                    </span>
                  )}
                  {company.telephone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {company.telephone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <span className="text-2xl font-semibold text-white">{company.delegate_count}</span>
              </div>
              <div className="text-sm text-slate-400 mt-1">Delegates</div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-2xl font-semibold text-white">{company.courses_completed}</span>
              </div>
              <div className="text-sm text-slate-400 mt-1">Courses Completed</div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                <span className="text-2xl font-semibold text-white">{company.certificates_issued}</span>
              </div>
              <div className="text-sm text-slate-400 mt-1">Certificates Issued</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('delegates')}
            className={`px-4 py-2 rounded transition-colors ${
              activeTab === 'delegates'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Delegates ({delegates.length})
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2 rounded transition-colors ${
              activeTab === 'courses'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Course Summary
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 rounded transition-colors ${
              activeTab === 'details'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Company Details
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'delegates' && (
          <>
            {/* Bulk Actions */}
            {selectedDelegates.size > 0 && (
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
                    onClick={() => setSelectedDelegates(new Set())}
                    className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Delegates Table */}
            {delegates.length === 0 ? (
              <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-12 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">No delegates found for this company</p>
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Course
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Date
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
                      {delegates.map((delegate) => (
                        <tr key={delegate.id} className="hover:bg-slate-800/50">
                          <td className="px-4 py-3">
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
                            <div>{delegate.course_type_name || 'Unknown'}</div>
                            <div className="text-slate-500">{delegate.venue_name}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-300 text-sm">
                            {formatDate(delegate.session_date)}
                          </td>
                          <td className="px-4 py-3">
                            {renderAttendanceBadge(delegate)}
                          </td>
                          <td className="px-4 py-3">
                            {delegate.certificate_issued ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded">
                                <Award className="w-3 h-3" />
                                {delegate.certificate_number}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-sm">Not issued</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
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
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'courses' && (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden">
            {courseSummary.length === 0 ? (
              <div className="p-12 text-center">
                <Award className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">No course data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Course Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Sessions
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Delegates
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Certificates Issued
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {courseSummary.map((course) => (
                      <tr key={course.course_type_id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div className="text-white">{course.course_type_name}</div>
                          <div className="text-sm text-slate-400">{course.course_type_code}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {course.sessions_count}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {course.delegates_count}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-green-500/20 text-green-400 border border-green-500/30 rounded">
                            <Award className="w-3 h-3" />
                            {course.certificates_issued}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Contact Information</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-slate-400">Contact Name</div>
                    <div className="text-white">{company.contact_name || 'Not specified'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Email</div>
                    <div className="text-white">{company.email || 'Not specified'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Telephone</div>
                    <div className="text-white">{company.telephone || 'Not specified'}</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white mb-4">Address</h3>
                <div className="space-y-1 text-white">
                  {company.address1 && <div>{company.address1}</div>}
                  {company.address2 && <div>{company.address2}</div>}
                  {company.town && <div>{company.town}</div>}
                  {company.postcode && <div>{company.postcode}</div>}
                  {!company.address1 && !company.town && (
                    <div className="text-slate-400">No address specified</div>
                  )}
                </div>
              </div>
            </div>

            {company.notes && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-white mb-2">Notes</h3>
                <div className="text-slate-300 whitespace-pre-wrap">{company.notes}</div>
              </div>
            )}

            <div className="mt-6">
              <div className="text-sm text-slate-400">Status</div>
              <span className={`inline-flex mt-1 px-2 py-1 text-sm rounded ${
                company.active
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
              }`}>
                {company.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-white">Edit Company</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Contact Name</label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Telephone</label>
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Address Line 1</label>
                <input
                  type="text"
                  value={formData.address1}
                  onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Address Line 2</label>
                <input
                  type="text"
                  value={formData.address2}
                  onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Town/City</label>
                  <input
                    type="text"
                    value={formData.town}
                    onChange={(e) => setFormData({ ...formData, town: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Postcode</label>
                  <input
                    type="text"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                  />
                  Active
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveCompany}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
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
