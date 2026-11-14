import React from 'react';
import { TrendingUp, TrendingDown, Check } from 'lucide-react';
import type { PacingStatusResult } from '../../utils/pacingEngine';

interface PacingStatusBadgeProps {
  status: PacingStatusResult | null;
  formatNumber?: (n: number) => string | number;
  variant?: 'compact' | 'detailed';
}

export const PacingStatusBadge: React.FC<PacingStatusBadgeProps> = ({
  status,
  formatNumber = (n) => n,
  variant = 'compact',
}) => {
  if (!status) return null;

  const meetingLabel = formatNumber(status.meetingIndex);

  if (variant === 'detailed') {
    return (
      <div className="flex items-center gap-1.5 tabular-nums">
        {status.diff > 0 ? (
          <span
            className="inline-flex items-center gap-1 text-emerald-800"
            title={`Tercatat hal. ${status.actualPage} vs target hal. ${status.targetPage} pada Sesi #${meetingLabel}`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>lebih {status.diff} Hal</span>
          </span>
        ) : status.diff < 0 ? (
          <span
            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600"
            title={`Tercatat hal. ${status.actualPage} vs target hal. ${status.targetPage} pada Sesi #${meetingLabel}`}
          >
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            <span>telat {status.diff * -1} Hal</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-800 border border-slate-300"
            title={`Tercatat tepat pada target hal. ${status.targetPage} pada Sesi #${meetingLabel}`}
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sesuai Target</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 tabular-nums">
      {status.diff > 0 ? (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-300 shadow-2xs"
          title={`Tercatat hal. ${status.actualPage} vs target hal. ${status.targetPage} pada Sesi #${meetingLabel}`}
        >
          <TrendingUp className="w-3 h-3 text-emerald-600" />
          <span>lebih {status.diff} Hal</span>
        </span>
      ) : status.diff < 0 ? (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 shadow-2xs"
          title={`Tercatat hal. ${status.actualPage} vs target hal. ${status.targetPage} pada Sesi #${meetingLabel}`}
        >
          <TrendingDown className="w-3 h-3 text-rose-600" />
          <span>telat {status.diff * -1} Hal</span>
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-300 shadow-2xs"
          title={`Tercatat tepat pada target hal. ${status.targetPage} pada Sesi #${meetingLabel}`}
        >
          <Check className="w-3 h-3 text-emerald-600" />
          <span>Sesuai Target</span>
        </span>
      )}
    </div>
  );
};
