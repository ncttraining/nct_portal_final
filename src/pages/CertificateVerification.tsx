import { useState } from 'react';
import { Search, CheckCircle, XCircle, AlertTriangle, Award } from 'lucide-react';
import { getCertificateByCertificateNumber, logCertificateVerification } from '../lib/certificates';

export default function CertificateVerification() {
  const [certificateNumber, setCertificateNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    if (!certificateNumber.trim()) {
      setError('Please enter a certificate number');
      return;
    }

    setSearching(true);
    setError(null);
    setResult(null);

    try {
      const cert = await getCertificateByCertificateNumber(certificateNumber.trim().toUpperCase());

      if (!cert) {
        setError('Certificate not found');
        await logCertificateVerification(certificateNumber.trim().toUpperCase(), null, 'invalid');
      } else {
        let verificationResult: 'valid' | 'revoked' | 'expired' = 'valid';

        if (cert.status === 'revoked') {
          verificationResult = 'revoked';
        } else if (cert.expiry_date && new Date(cert.expiry_date) < new Date()) {
          verificationResult = 'expired';
        }

        await logCertificateVerification(cert.certificate_number, cert.id, verificationResult);
        setResult({ ...cert, verificationResult });
      }
    } catch (err) {
      setError('An error occurred while verifying the certificate');
      console.error('Verification error:', err);
    } finally {
      setSearching(false);
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      <header className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl font-semibold tracking-wide">
                CERTIFICATE VERIFICATION
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                National Compliance Training
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8">
          <h2 className="text-lg font-semibold mb-2 text-center">
            Verify a Certificate
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">
            Enter a certificate number to verify its authenticity and view details
          </p>

          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
                Certificate Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={certificateNumber}
                  onChange={(e) => {
                    setCertificateNumber(e.target.value.toUpperCase());
                    setError(null);
                    setResult(null);
                  }}
                  placeholder="e.g., FLT-2025-00001"
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-base focus:border-blue-500 outline-none uppercase font-mono text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Search className="w-4 h-4" />
                  {searching ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-600 dark:text-red-400 mb-1">Certificate Not Found</h3>
                  <p className="text-sm text-red-600/80 dark:text-red-400/80">
                    The certificate number you entered could not be found in our system. Please check the number and try again.
                  </p>
                </div>
              </div>
            </div>
          )}

          {result && result.verificationResult === 'valid' && (
            <div className="mt-6 p-6 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-1">Valid Certificate</h3>
                  <p className="text-sm text-green-600/80 dark:text-green-400/80">
                    This certificate is valid and was issued by National Compliance Training.
                  </p>
                </div>
              </div>

              <div className="border-t border-green-500/20 pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Certificate Number</span>
                    <p className="font-mono text-sm text-slate-900 dark:text-white mt-1">{result.certificate_number}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Course Type</span>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">{result.course_types?.name || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Candidate Name</span>
                  <p className="text-sm text-slate-900 dark:text-white mt-1">{result.candidate_name}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Issue Date</span>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">{formatDate(result.issue_date)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Course Dates</span>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {formatDate(result.course_date_start)}
                      {result.course_date_start !== result.course_date_end && ` - ${formatDate(result.course_date_end)}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Expiry Date</span>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {result.expiry_date ? formatDate(result.expiry_date) : 'No Expiry'}
                    </p>
                  </div>
                </div>

                {result.trainer_name && (
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trainer</span>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">{result.trainer_name}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {result && result.verificationResult === 'expired' && (
            <div className="mt-6 p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400 mb-1">Certificate Expired</h3>
                  <p className="text-sm text-yellow-600/80 dark:text-yellow-400/80">
                    This certificate has expired and is no longer valid.
                  </p>
                </div>
              </div>

              <div className="border-t border-yellow-500/20 pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Certificate Number</span>
                    <p className="font-mono text-sm text-slate-900 dark:text-white mt-1">{result.certificate_number}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Expired On</span>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">{formatDate(result.expiry_date)}</p>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Candidate Name</span>
                  <p className="text-sm text-slate-900 dark:text-white mt-1">{result.candidate_name}</p>
                </div>
              </div>
            </div>
          )}

          {result && result.verificationResult === 'revoked' && (
            <div className="mt-6 p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-1">Certificate Revoked</h3>
                  <p className="text-sm text-red-600/80 dark:text-red-400/80">
                    This certificate has been revoked and is no longer valid.
                  </p>
                </div>
              </div>

              <div className="border-t border-red-500/20 pt-4 space-y-3">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Certificate Number</span>
                  <p className="font-mono text-sm text-slate-900 dark:text-white mt-1">{result.certificate_number}</p>
                </div>

                {result.revoked_reason && (
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Revocation Reason</span>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">{result.revoked_reason}</p>
                  </div>
                )}

                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Revoked On</span>
                  <p className="text-sm text-slate-900 dark:text-white mt-1">{formatDate(result.revoked_at)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>
            For questions about certificate verification, please contact{' '}
            <a href="mailto:admin@nationalcompliancetraining.co.uk" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
              admin@nationalcompliancetraining.co.uk
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
