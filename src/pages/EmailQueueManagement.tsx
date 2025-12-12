import { useState, useEffect } from 'react';
import { Mail, Search, RefreshCw, CheckCircle, Clock, Send, XCircle, AlertCircle, X, Eye, Calendar, RotateCcw, Forward, ArrowRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notification from '../components/Notification';
import {
  getEmailQueue,
  getEmailQueueStats,
  getUniqueTemplateKeys,
  retryEmail,
  cancelEmail,
  bulkRetryEmails,
  bulkCancelEmails,
  forwardEmail,
  type EmailQueueEntry,
  type EmailQueueStats,
  type EmailQueueFilters,
} from '../lib/email-queue';

interface EmailQueueManagementProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function EmailQueueManagement({ currentPage, onNavigate }: EmailQueueManagementProps) {
  const [emails, setEmails] = useState<EmailQueueEntry[]>([]);
  const [stats, setStats] = useState<EmailQueueStats | null>(null);
  const [templates, setTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [detailEmail, setDetailEmail] = useState<EmailQueueEntry | null>(null);

  // Forward email modal state
  const [forwardingEmail, setForwardingEmail] = useState<EmailQueueEntry | null>(null);
  const [forwardToEmail, setForwardToEmail] = useState('');
  const [forwardToName, setForwardToName] = useState('');
  const [forwarding, setForwarding] = useState(false);

  // Bulk forward modal state
  const [showBulkForwardModal, setShowBulkForwardModal] = useState(false);
  const [bulkForwardToEmail, setBulkForwardToEmail] = useState('');
  const [bulkForwardToName, setBulkForwardToName] = useState('');
  const [bulkForwarding, setBulkForwarding] = useState(false);

  const itemsPerPage = 50;
  const autoRefresh = true;

  useEffect(() => {
    loadData();
    loadTemplates();

    if (autoRefresh) {
      const interval = setInterval(loadData, 30000);
      return () => clearInterval(interval);
    }
  }, [searchQuery, statusFilter, templateFilter, dateRange, currentPageNum]);

  async function loadData() {
    try {
      const filters: EmailQueueFilters = {};

      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      if (templateFilter !== 'all') {
        filters.templateKey = templateFilter;
      }

      if (searchQuery.trim()) {
        filters.searchQuery = searchQuery.trim();
      }

      if (dateRange === 'today') {
        filters.startDate = new Date(new Date().setHours(0, 0, 0, 0));
      } else if (dateRange === 'week') {
        filters.startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === 'month') {
        filters.startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      const offset = (currentPageNum - 1) * itemsPerPage;
      const { emails: data, total } = await getEmailQueue(filters, itemsPerPage, offset);
      setEmails(data);
      setTotalCount(total);

      const statsData = await getEmailQueueStats();
      setStats(statsData);

      setLoading(false);
    } catch (error) {
      console.error('Failed to load email queue:', error);
      setNotification({ type: 'error', message: 'Failed to load email queue' });
      setLoading(false);
    }
  }

  async function loadTemplates() {
    const keys = await getUniqueTemplateKeys();
    setTemplates(keys);
  }

  async function handleRetry(emailId: string) {
    const success = await retryEmail(emailId);
    if (success) {
      setNotification({ type: 'success', message: 'Email queued for retry' });
      loadData();
    } else {
      setNotification({ type: 'error', message: 'Failed to retry email' });
    }
  }

  async function handleCancel(emailId: string) {
    const success = await cancelEmail(emailId);
    if (success) {
      setNotification({ type: 'success', message: 'Email cancelled' });
      loadData();
    } else {
      setNotification({ type: 'error', message: 'Failed to cancel email' });
    }
  }

  async function handleBulkRetry() {
    if (selectedEmails.size === 0) return;
    const count = await bulkRetryEmails(Array.from(selectedEmails));
    setNotification({ type: 'success', message: `${count} emails queued for retry` });
    setSelectedEmails(new Set());
    loadData();
  }

  async function handleBulkCancel() {
    if (selectedEmails.size === 0) return;
    const count = await bulkCancelEmails(Array.from(selectedEmails));
    setNotification({ type: 'success', message: `${count} emails cancelled` });
    setSelectedEmails(new Set());
    loadData();
  }

  async function handleForward() {
    if (!forwardingEmail || !forwardToEmail.trim()) return;

    setForwarding(true);
    const newEmailId = await forwardEmail(forwardingEmail.id, forwardToEmail.trim(), forwardToName.trim() || undefined);

    if (newEmailId) {
      setNotification({ type: 'success', message: `Email forwarded to ${forwardToEmail}` });
      setForwardingEmail(null);
      setForwardToEmail('');
      setForwardToName('');
      loadData();
    } else {
      setNotification({ type: 'error', message: 'Failed to forward email' });
    }
    setForwarding(false);
  }

  async function handleBulkForward() {
    if (selectedEmails.size === 0 || !bulkForwardToEmail.trim()) return;

    setBulkForwarding(true);
    let successCount = 0;

    for (const emailId of selectedEmails) {
      const newEmailId = await forwardEmail(emailId, bulkForwardToEmail.trim(), bulkForwardToName.trim() || undefined);
      if (newEmailId) {
        successCount++;
      }
    }

    setNotification({
      type: successCount > 0 ? 'success' : 'error',
      message: successCount > 0
        ? `${successCount} email${successCount > 1 ? 's' : ''} forwarded to ${bulkForwardToEmail}`
        : 'Failed to forward emails'
    });

    setShowBulkForwardModal(false);
    setBulkForwardToEmail('');
    setBulkForwardToName('');
    setSelectedEmails(new Set());
    setBulkForwarding(false);
    loadData();
  }

  function handleSelectEmail(emailId: string) {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  }

  function handleSelectAll() {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(e => e.id)));
    }
  }

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('all');
    setTemplateFilter('all');
    setDateRange('all');
    setCurrentPageNum(1);
  }

  function getStatusBadge(status: string) {
    const badges = {
      pending: { icon: Clock, color: 'bg-yellow-500/20 text-yellow-400', text: 'Pending' },
      processing: { icon: RefreshCw, color: 'bg-blue-500/20 text-blue-400', text: 'Processing' },
      sent: { icon: CheckCircle, color: 'bg-green-500/20 text-green-400', text: 'Sent' },
      failed: { icon: XCircle, color: 'bg-red-500/20 text-red-400', text: 'Failed' },
      cancelled: { icon: AlertCircle, color: 'bg-slate-500/20 text-slate-400', text: 'Cancelled' },
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    );
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Mail className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold">Email Queue Management</h1>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Total Emails</div>
              <div className="text-2xl font-bold">{stats.total_count}</div>
            </div>
            <div className="bg-slate-900 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Pending
              </div>
              <div className="text-2xl font-bold">{stats.pending_count}</div>
            </div>
            <div className="bg-slate-900 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                <RefreshCw className="w-4 h-4" />
                Processing
              </div>
              <div className="text-2xl font-bold">{stats.processing_count}</div>
            </div>
            <div className="bg-slate-900 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
                <CheckCircle className="w-4 h-4" />
                Sent
              </div>
              <div className="text-2xl font-bold">{stats.sent_count}</div>
            </div>
            <div className="bg-slate-900 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
                <XCircle className="w-4 h-4" />
                Failed
              </div>
              <div className="text-2xl font-bold">{stats.failed_count}</div>
            </div>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm text-slate-400 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or subject..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="w-40">
              <label className="block text-sm text-slate-400 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="w-48">
              <label className="block text-sm text-slate-400 mb-2">Template</label>
              <select
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Templates</option>
                {templates.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            <div className="w-40">
              <label className="block text-sm text-slate-400 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>

            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            >
              Clear Filters
            </button>
          </div>

          {selectedEmails.size > 0 && (
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800">
              <span className="text-sm text-slate-400">{selectedEmails.size} selected</span>
              <button
                onClick={handleBulkRetry}
                className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 rounded transition-colors"
              >
                Retry Selected
              </button>
              <button
                onClick={() => setShowBulkForwardModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded transition-colors"
              >
                <Forward className="w-3.5 h-3.5" />
                Forward Selected
              </button>
              <button
                onClick={handleBulkCancel}
                className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 rounded transition-colors"
              >
                Cancel Selected
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading email queue...</div>
        ) : emails.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-lg">
            <Mail className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400">No emails found</p>
          </div>
        ) : (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-950 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedEmails.size === emails.length && emails.length > 0}
                          onChange={handleSelectAll}
                          className="rounded bg-slate-800 border-slate-700"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Recipient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Subject / Template</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Attempts</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {emails.map((email) => (
                      <tr key={email.id} className="hover:bg-slate-950/50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedEmails.has(email.id)}
                            onChange={() => handleSelectEmail(email.id)}
                            className="rounded bg-slate-800 border-slate-700"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {getStatusBadge(email.status)}
                            {email.resend_count > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-400" title={`Resent ${email.resend_count} time${email.resend_count > 1 ? 's' : ''}`}>
                                <RotateCcw className="w-3 h-3" />
                                {email.resend_count}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {email.recipient_name && (
                              <div className="font-medium">{email.recipient_name}</div>
                            )}
                            <div className="text-slate-400">{email.recipient_email}</div>
                            {email.original_recipient_email && email.original_recipient_email !== email.recipient_email && (
                              <div className="flex items-center gap-1 text-xs text-orange-400 mt-0.5" title="Email address was updated on resend">
                                <ArrowRight className="w-3 h-3" />
                                <span className="line-through text-slate-500">{email.original_recipient_email}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {email.template_key ? (
                              <>
                                <div className="font-medium text-blue-400">{email.template_key}</div>
                                <div className="text-slate-400 text-xs">{email.subject}</div>
                              </>
                            ) : (
                              <div>{email.subject}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block w-8 h-8 rounded text-center leading-8 text-sm font-bold ${
                            email.priority <= 3 ? 'bg-red-500/20 text-red-400' :
                            email.priority <= 6 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-slate-700 text-slate-400'
                          }`}>
                            {email.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${email.attempts > 0 ? 'text-yellow-400' : 'text-slate-400'}`}>
                            {email.attempts}/{email.max_attempts}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-400" title={new Date(email.created_at).toLocaleString()}>
                            {formatDate(email.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDetailEmail(email)}
                              className="p-1.5 hover:bg-slate-800 rounded transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4 text-slate-400" />
                            </button>
                            <button
                              onClick={() => setForwardingEmail(email)}
                              className="p-1.5 hover:bg-slate-800 rounded transition-colors"
                              title="Forward to different address"
                            >
                              <Forward className="w-4 h-4 text-green-400" />
                            </button>
                            {(email.status === 'failed' || email.status === 'cancelled' || email.status === 'sent') && (
                              <button
                                onClick={() => handleRetry(email.id)}
                                className="p-1.5 hover:bg-slate-800 rounded transition-colors"
                                title={email.status === 'sent' ? 'Resend' : 'Retry'}
                              >
                                <RefreshCw className="w-4 h-4 text-blue-400" />
                              </button>
                            )}
                            {(email.status === 'pending' || email.status === 'failed') && (
                              <button
                                onClick={() => handleCancel(email.id)}
                                className="p-1.5 hover:bg-slate-800 rounded transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4 text-red-400" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-slate-400">
                  Showing {(currentPageNum - 1) * itemsPerPage + 1} to {Math.min(currentPageNum * itemsPerPage, totalCount)} of {totalCount} emails
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPageNum(Math.max(1, currentPageNum - 1))}
                    disabled={currentPageNum === 1}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 bg-slate-900 rounded">
                    Page {currentPageNum} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPageNum(Math.min(totalPages, currentPageNum + 1))}
                    disabled={currentPageNum === totalPages}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Forward Email Modal */}
      {forwardingEmail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-lg w-full">
            <div className="border-b border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Forward className="w-5 h-5 text-green-400" />
                Forward Email
              </h2>
              <button
                onClick={() => {
                  setForwardingEmail(null);
                  setForwardToEmail('');
                  setForwardToName('');
                }}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Original Email</div>
                <div className="font-medium">{forwardingEmail.subject}</div>
                <div className="text-sm text-slate-500 mt-1">
                  To: {forwardingEmail.recipient_name ? `${forwardingEmail.recipient_name} <${forwardingEmail.recipient_email}>` : forwardingEmail.recipient_email}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Forward To Email *</label>
                <input
                  type="email"
                  value={forwardToEmail}
                  onChange={(e) => setForwardToEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Recipient Name (Optional)</label>
                <input
                  type="text"
                  value={forwardToName}
                  onChange={(e) => setForwardToName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setForwardingEmail(null);
                    setForwardToEmail('');
                    setForwardToName('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForward}
                  disabled={!forwardToEmail.trim() || forwarding}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                >
                  {forwarding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Forwarding...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Forward Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Forward Modal */}
      {showBulkForwardModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-lg w-full">
            <div className="border-b border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Forward className="w-5 h-5 text-green-400" />
                Forward {selectedEmails.size} Email{selectedEmails.size > 1 ? 's' : ''}
              </h2>
              <button
                onClick={() => {
                  setShowBulkForwardModal(false);
                  setBulkForwardToEmail('');
                  setBulkForwardToName('');
                }}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Selected Emails</div>
                <div className="font-medium">{selectedEmails.size} email{selectedEmails.size > 1 ? 's' : ''} will be forwarded</div>
                <div className="text-sm text-slate-500 mt-1">
                  Each email will be sent as a new copy to the address below
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Forward To Email *</label>
                <input
                  type="email"
                  value={bulkForwardToEmail}
                  onChange={(e) => setBulkForwardToEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Recipient Name (Optional)</label>
                <input
                  type="text"
                  value={bulkForwardToName}
                  onChange={(e) => setBulkForwardToName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowBulkForwardModal(false);
                    setBulkForwardToEmail('');
                    setBulkForwardToName('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkForward}
                  disabled={!bulkForwardToEmail.trim() || bulkForwarding}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                >
                  {bulkForwarding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Forwarding...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Forward {selectedEmails.size} Email{selectedEmails.size > 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailEmail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Email Details</h2>
              <button
                onClick={() => setDetailEmail(null)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Status</label>
                <div className="flex items-center gap-2">
                  {getStatusBadge(detailEmail.status)}
                  {detailEmail.resend_count > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                      <RotateCcw className="w-3 h-3" />
                      Resent {detailEmail.resend_count} time{detailEmail.resend_count > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Recipient Name</label>
                  <div>{detailEmail.recipient_name || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Recipient Email</label>
                  <div>{detailEmail.recipient_email}</div>
                  {detailEmail.original_recipient_email && detailEmail.original_recipient_email !== detailEmail.recipient_email && (
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <span className="text-orange-400">Updated from:</span>
                      <span className="line-through text-slate-500">{detailEmail.original_recipient_email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Subject</label>
                <div className="font-medium">{detailEmail.subject}</div>
              </div>

              {detailEmail.template_key && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Template Key</label>
                  <div className="text-blue-400">{detailEmail.template_key}</div>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">Email Content</label>
                {detailEmail.html_body ? (
                  <div className="bg-white rounded border border-slate-700 overflow-hidden">
                    <iframe
                      srcDoc={detailEmail.html_body}
                      className="w-full min-h-[500px] border-0"
                      sandbox="allow-same-origin"
                      title="Email preview"
                    />
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-800 rounded p-4 text-slate-400 text-sm">
                    No email content available
                  </div>
                )}
              </div>

              {detailEmail.attachments && detailEmail.attachments.length > 0 && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Attachments</label>
                  <ul className="space-y-1">
                    {detailEmail.attachments.map((att, i) => (
                      <li key={i} className="text-sm">
                        {att.filename}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Priority</label>
                  <div>{detailEmail.priority}</div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Attempts</label>
                  <div>{detailEmail.attempts} / {detailEmail.max_attempts}</div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Created</label>
                  <div className="text-sm">{new Date(detailEmail.created_at).toLocaleString()}</div>
                </div>
              </div>

              {detailEmail.processing_started_at && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Processing Started</label>
                  <div className="text-sm">{new Date(detailEmail.processing_started_at).toLocaleString()}</div>
                </div>
              )}

              {detailEmail.original_sent_at && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Originally Sent</label>
                  <div className="text-sm">{new Date(detailEmail.original_sent_at).toLocaleString()}</div>
                </div>
              )}

              {detailEmail.sent_at && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{detailEmail.original_sent_at ? 'Last Sent At' : 'Sent At'}</label>
                  <div className="text-sm">{new Date(detailEmail.sent_at).toLocaleString()}</div>
                </div>
              )}

              {detailEmail.error_message && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Error Message</label>
                  <div className="bg-red-950/20 border border-red-900 text-red-400 p-3 rounded text-sm">
                    {detailEmail.error_message}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => {
                    setForwardingEmail(detailEmail);
                    setDetailEmail(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
                >
                  <Forward className="w-4 h-4" />
                  Forward
                </button>
                {(detailEmail.status === 'failed' || detailEmail.status === 'cancelled' || detailEmail.status === 'sent') && (
                  <button
                    onClick={() => {
                      handleRetry(detailEmail.id);
                      setDetailEmail(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {detailEmail.status === 'sent' ? 'Resend' : 'Retry'}
                  </button>
                )}
                {(detailEmail.status === 'pending' || detailEmail.status === 'failed') && (
                  <button
                    onClick={() => {
                      handleCancel(detailEmail.id);
                      setDetailEmail(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
