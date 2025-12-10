import { Check, X, Clock, Smile } from 'lucide-react';
import { AttendanceDetail } from '../../lib/open-courses';

interface AttendanceIconsProps {
  value?: AttendanceDetail;
  onChange: (value: AttendanceDetail) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

const buttonSizes = {
  sm: 'p-1',
  md: 'p-1.5',
  lg: 'p-2',
};

export default function AttendanceIcons({
  value,
  onChange,
  disabled = false,
  size = 'md',
}: AttendanceIconsProps) {
  const iconSize = iconSizes[size];
  const buttonSize = buttonSizes[size];

  const buttons: Array<{
    status: AttendanceDetail;
    icon: typeof Check;
    activeColor: string;
    inactiveColor: string;
    hoverColor: string;
    title: string;
  }> = [
    {
      status: 'attended',
      icon: Check,
      activeColor: 'bg-green-500 text-white',
      inactiveColor: 'bg-slate-700 text-slate-400',
      hoverColor: 'hover:bg-green-500/20 hover:text-green-400',
      title: 'Attended',
    },
    {
      status: 'absent',
      icon: X,
      activeColor: 'bg-red-500 text-white',
      inactiveColor: 'bg-slate-700 text-slate-400',
      hoverColor: 'hover:bg-red-500/20 hover:text-red-400',
      title: 'Absent',
    },
    {
      status: 'late',
      icon: Clock,
      activeColor: 'bg-orange-500 text-white',
      inactiveColor: 'bg-slate-700 text-slate-400',
      hoverColor: 'hover:bg-orange-500/20 hover:text-orange-400',
      title: 'Late',
    },
    {
      status: 'left_early',
      icon: Smile,
      activeColor: 'bg-blue-500 text-white',
      inactiveColor: 'bg-slate-700 text-slate-400',
      hoverColor: 'hover:bg-blue-500/20 hover:text-blue-400',
      title: 'Left Early',
    },
  ];

  return (
    <div className="flex items-center gap-1">
      {buttons.map((btn) => {
        const Icon = btn.icon;
        const isActive = value === btn.status;

        return (
          <button
            key={btn.status}
            type="button"
            onClick={() => !disabled && onChange(btn.status)}
            disabled={disabled}
            title={btn.title}
            className={`${buttonSize} rounded transition-all ${
              isActive
                ? btn.activeColor
                : `${btn.inactiveColor} ${!disabled ? btn.hoverColor : ''}`
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Icon className={iconSize} />
          </button>
        );
      })}
    </div>
  );
}

// Single icon display for read-only views
export function AttendanceStatusIcon({
  status,
  size = 'md',
}: {
  status?: AttendanceDetail;
  size?: 'sm' | 'md' | 'lg';
}) {
  const iconSize = iconSizes[size];

  if (!status) {
    return <span className="text-slate-500">-</span>;
  }

  const iconMap: Record<AttendanceDetail, { icon: typeof Check; color: string; label: string }> = {
    attended: { icon: Check, color: 'text-green-400', label: 'Attended' },
    absent: { icon: X, color: 'text-red-400', label: 'Absent' },
    late: { icon: Clock, color: 'text-orange-400', label: 'Late' },
    left_early: { icon: Smile, color: 'text-blue-400', label: 'Left Early' },
  };

  const { icon: Icon, color, label } = iconMap[status];

  return (
    <span className={color} title={label}>
      <Icon className={iconSize} />
    </span>
  );
}
