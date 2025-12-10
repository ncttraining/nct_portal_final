import { ShieldCheck, AlertCircle } from 'lucide-react';

interface TrainerDeclarationProps {
  signed: boolean;
  onToggle: (signed: boolean) => void;
  disabled?: boolean;
  signedAt?: string;
  signedByName?: string;
}

export default function TrainerDeclaration({
  signed,
  onToggle,
  disabled = false,
  signedAt,
  signedByName,
}: TrainerDeclarationProps) {
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        signed
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-slate-800 border-slate-700'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-2 rounded-lg ${
            signed ? 'bg-green-500/20' : 'bg-slate-700'
          }`}
        >
          {signed ? (
            <ShieldCheck className="w-6 h-6 text-green-400" />
          ) : (
            <AlertCircle className="w-6 h-6 text-slate-400" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-white">DECLARATION</h3>
            <button
              type="button"
              onClick={() => !disabled && onToggle(!signed)}
              disabled={disabled}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                signed ? 'bg-green-500' : 'bg-slate-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  signed ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
              <span
                className={`absolute text-xs font-semibold ${
                  signed ? 'left-2 text-white' : 'right-2 text-slate-300'
                }`}
              >
                {signed ? 'YES' : 'NO'}
              </span>
            </button>
          </div>

          <p className="text-sm text-slate-300">
            I have conducted the required licence and identity checks and
            delivered this course as approved.
          </p>

          {signed && signedAt && (
            <p className="text-xs text-slate-400 mt-2">
              Signed{signedByName ? ` by ${signedByName}` : ''} on{' '}
              {formatDateTime(signedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
