import { useState, useEffect } from 'react';
import { Download, Mail, Search, Filter, Award, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import {
  getCertificates,
  getCourseTypes,
  Certificate,
  CourseType
} from '../lib/certificates';

interface CertificatesProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Certificates({ currentPage, onNavigate }: CertificatesProps) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    courseTypeId: '',
    status: '',
    searchTerm: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadCertificates();
  }, [filters]);

  async function loadData() {
    setLoading(true);
    const types = await getCourseTypes();
    setCourseTypes(types);
    await loadCertificates();
    setLoading(false);
  }

  async function loadCertificates() {
    const data = await getCertificates({
      courseTypeId: filters.courseTypeId || undefined,
      status: filters.status || undefined,
      searchTerm: filters.searchTerm || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined
    });
    setCertificates(data);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'issued':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 rounded">
            <CheckCircle className="w-3 h-3" />
            Issued
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded">
            <XCircle className="w-3 h-3" />
            Revoked
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30 rounded">
            <AlertTriangle className="w-3 h-3" />
            Expired
          </span>
        );
      default:
        return null;
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
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors flex items-center justify-center">
        <div className="text-slate-500 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">
            Filters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Course Type</label>
              <select
                value={filters.courseTypeId}
                onChange={(e) => setFilters({ ...filters, courseTypeId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
              >
                <option value="">All Types</option>
                {courseTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
              >
                <option value="">All Statuses</option>
                <option value="issued">Issued</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  placeholder="Name or cert number..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {Object.keys(groupedCertificates).length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center">
              <Award className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400 mb-2">No certificates found</p>
              <p className="text-sm text-slate-600 dark:text-slate-500">
                Certificates will appear here once they are generated from course bookings
              </p>
            </div>
          ) : (
            Object.entries(groupedCertificates).map(([courseType, certs]) => (
              <div key={courseType} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      {courseType}
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {certs.length} {certs.length === 1 ? 'certificate' : 'certificates'}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {certs.map(cert => (
                    <div key={cert.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{cert.candidate_name}</h4>
                            {getStatusBadge(cert.status)}
                            {cert.sent_at && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded">
                                <Mail className="w-3 h-3" />
                                Sent
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                            <div>
                              <span className="text-slate-600 dark:text-slate-500">Certificate No:</span>
                              <span className="ml-2 font-mono text-blue-600 dark:text-blue-400">{cert.certificate_number}</span>
                            </div>
                            <div>
                              <span className="text-slate-600 dark:text-slate-500">Issue Date:</span>
                              <span className="ml-2 text-slate-700 dark:text-slate-300">{formatDate(cert.issue_date)}</span>
                            </div>
                            <div>
                              <span className="text-slate-600 dark:text-slate-500">Expiry Date:</span>
                              <span className="ml-2 text-slate-700 dark:text-slate-300">
                                {cert.expiry_date ? formatDate(cert.expiry_date) : 'No Expiry'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-600 dark:text-slate-500">Trainer:</span>
                              <span className="ml-2 text-slate-700 dark:text-slate-300">{cert.trainer_name || 'N/A'}</span>
                            </div>
                          </div>

                          {cert.candidate_email && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {cert.candidate_email}
                            </div>
                          )}

                          {cert.revoked_at && cert.revoked_reason && (
                            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600 dark:text-red-400">
                              <span className="font-semibold">Revoked:</span> {cert.revoked_reason}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {cert.certificate_pdf_url && (
                            <a
                              href={cert.certificate_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-2 text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                          )}
                          {cert.status === 'issued' && cert.candidate_email && !cert.sent_at && (
                            <button
                              onClick={() => {
                                alert('Email functionality coming soon!');
                              }}
                              className="flex items-center gap-1 px-3 py-2 text-xs bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors"
                            >
                              <Mail className="w-3 h-3" />
                              Send
                            </button>
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

        <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-500">
          Showing {certificates.length} {certificates.length === 1 ? 'certificate' : 'certificates'}
        </div>
      </main>
    </div>
  );
}
