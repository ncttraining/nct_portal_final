import { useState, useEffect } from 'react';
import { Mail, Search, RefreshCw, CheckCircle, Clock, Send, XCircle, AlertCircle, X, Eye, Calendar } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
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
            <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
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
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-slate-500 dark:text-slate-400 text-sm mb-1">Total Emails</div>
              <div className="text-2xl font-bold">{stats.total_count}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Pending
              </div>
              <div className="text-2xl font-bold">{stats.pending_count}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm mb-1">
                <RefreshCw className="w-4 h-4" />
                Processing
              </div>
              <div className="text-2xl font-bold">{stats.processing_count}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm mb-1">
                <CheckCircle className="w-4 h-4" />
                Sent
              </div>
              <div className="text-2xl font-bold">{stats.sent_count}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mb-1">
                <XCircle className="w-4 h-4" />
                Failed
              </div>
              <div className="text-2xl font-bold">{stats.failed_count}</div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or subject..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="w-40">
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
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
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Template</label>
              <select
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Templates</option>
                {templates.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            <div className="w-40">
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>

            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors"
            >
              Clear Filters
            </button>
          </div>

          {selectedEmails.size > 0 && (
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">{selectedEmails.size} selected</span>
              <button
                onClick={handleBulkRetry}
                className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 rounded transition-colors"
              >
                Retry Selected
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
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading email queue...</div>
        ) : emails.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <Mail className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">No emails found</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-200 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedEmails.size === emails.length && emails.length > 0}
                          onChange={handleSelectAll}
                          className="rounded bg-slate-800 border-slate-700"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Recipient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Subject / Template</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Attempts</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {emails.map((email) => (
                      <tr key={email.id} className="hover:bg-slate-100 dark:hover:bg-slate-950/50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedEmails.has(email.id)}
                            onChange={() => handleSelectEmail(email.id)}
                            className="rounded bg-slate-800 border-slate-700"
                          />
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(email.status)}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {email.recipient_name && (
                              <div className="font-medium text-slate-900 dark:text-white">{email.recipient_name}</div>
                            )}
                            <div className="text-slate-500 dark:text-slate-400">{email.recipient_email}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {email.template_key ? (
                              <>
                                <div className="font-medium text-blue-600 dark:text-blue-400">{email.template_key}</div>
                                <div className="text-slate-500 dark:text-slate-400 text-xs">{email.subject}</div>
                              </>
                            ) : (
                              <div className="text-slate-900 dark:text-white">{email.subject}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block w-8 h-8 rounded text-center leading-8 text-sm font-bold ${
                            email.priority <= 3 ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                            email.priority <= 6 ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                            'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                          }`}>
                            {email.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${email.attempts > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {email.attempts}/{email.max_attempts}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-500 dark:text-slate-400" title={new Date(email.created_at).toLocaleString()}>
                            {formatDate(email.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDetailEmail(email)}
                              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            </button>
                            {(email.status === 'failed' || email.status === 'cancelled' || email.status === 'sent') && (
                              <button
                                onClick={() => handleRetry(email.id)}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                                title={email.status === 'sent' ? 'Resend' : 'Retry'}
                              >
                                <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </button>
                            )}
                            {(email.status === 'pending' || email.status === 'failed') && (
                              <button
                                onClick={() => handleCancel(email.id)}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4 text-red-600 dark:text-red-400" />
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
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Showing {(currentPageNum - 1) * itemsPerPage + 1} to {Math.min(currentPageNum * itemsPerPage, totalCount)} of {totalCount} emails
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPageNum(Math.max(1, currentPageNum - 1))}
                    disabled={currentPageNum === 1}
                    className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors border border-slate-200 dark:border-slate-800"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                    Page {currentPageNum} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPageNum(Math.min(totalPages, currentPageNum + 1))}
                    disabled={currentPageNum === totalPages}
                    className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors border border-slate-200 dark:border-slate-800"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {detailEmail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Email Details</h2>
              <button
                onClick={() => setDetailEmail(null)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Status</label>
                <div>{getStatusBadge(detailEmail.status)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Recipient Name</label>
                  <div className="text-slate-900 dark:text-white">{detailEmail.recipient_name || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Recipient Email</label>
                  <div className="text-slate-900 dark:text-white">{detailEmail.recipient_email}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Subject</label>
                <div className="font-medium text-slate-900 dark:text-white">{detailEmail.subject}</div>
              </div>

              {detailEmail.template_key && (
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Template Key</label>
                  <div className="text-blue-600 dark:text-blue-400">{detailEmail.template_key}</div>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Email Content</label>
                {detailEmail.html_body ? (
                  <div className="bg-white rounded border border-slate-300 dark:border-slate-700 overflow-hidden">
                    <iframe
                      srcDoc={detailEmail.html_body}
                      className="w-full min-h-[500px] border-0"
                      sandbox="allow-same-origin"
                      title="Email preview"
                    />
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-4 text-slate-500 dark:text-slate-400 text-sm">
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
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Priority</label>
                  <div className="text-slate-900 dark:text-white">{detailEmail.priority}</div>
                </div>
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Attempts</label>
                  <div className="text-slate-900 dark:text-white">{detailEmail.attempts} / {detailEmail.max_attempts}</div>
                </div>
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Created</label>
                  <div className="text-sm text-slate-900 dark:text-white">{new Date(detailEmail.created_at).toLocaleString()}</div>
                </div>
              </div>

              {detailEmail.processing_started_at && (
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Processing Started</label>
                  <div className="text-sm text-slate-900 dark:text-white">{new Date(detailEmail.processing_started_at).toLocaleString()}</div>
                </div>
              )}

              {detailEmail.sent_at && (
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Sent At</label>
                  <div className="text-sm text-slate-900 dark:text-white">{new Date(detailEmail.sent_at).toLocaleString()}</div>
                </div>
              )}

              {detailEmail.error_message && (
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Error Message</label>
                  <div className="bg-red-950/20 border border-red-900 text-red-600 dark:text-red-400 p-3 rounded text-sm">
                    {detailEmail.error_message}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
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
