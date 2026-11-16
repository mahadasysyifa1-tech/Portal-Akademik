import React from 'react';
import { AttendanceSummaryItem } from '../../types';

export interface AttendanceSummaryBarProps {
  label: string;
  summary?: AttendanceSummaryItem;
  onOpenHistory?: () => void;
  title?: string;
}

export const AttendanceSummaryBar: React.FC<AttendanceSummaryBarProps> = ({
  label,
  summary,
  onOpenHistory,
  title
}) => {
  const hasData = Boolean(summary && summary.total > 0);
  const rate = summary ? summary.rate : 0;

  const rateTextClass =
    rate >= 85
      ? 'text-emerald-600'
      : rate >= 70
      ? 'text-amber-600'
      : 'text-rose-600';

  const barFillClass = !hasData
    ? 'bg-slate-200'
    : rate >= 85
    ? 'bg-emerald-500'
    : rate >= 70
    ? 'bg-amber-500'
    : 'bg-rose-500';

  const content = (
    <>
      <div className="flex items-center justify-between text-xs mb-1">
        <span
          className={`text-[11px] font-semibold text-slate-600 ${
            onOpenHistory ? 'group-hover:text-indigo-600' : ''
          } transition-colors`}
        >
          {label}
        </span>
        {hasData && summary ? (
          <span className="font-bold text-xs flex items-center gap-1 tabular-nums">
            <span className={rateTextClass}>{summary.rate}%</span>
            <span className="text-[10px] font-normal text-slate-400">
              ({summary.hadir + summary.terlambat}/{summary.total} sesi)
            </span>
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 italic">Belum ada data</span>
        )}
      </div>
      <div
        className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hasData ? Math.min(100, rate) : 0}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barFillClass}`}
          style={{ width: `${hasData ? Math.min(100, rate) : 0}%` }}
        />
      </div>
    </>
  );

  if (onOpenHistory) {
    return (
      <button
        type="button"
        onClick={onOpenHistory}
        className="w-full text-left mt-3 pt-2.5 border-t border-slate-100 group -mx-1 px-1.5 py-1.5 rounded-xl transition-colors cursor-pointer hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        title={title}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className="mt-3 pt-2.5 border-t border-slate-100 -mx-1 px-1.5 py-1.5 rounded-xl"
      title={title}
    >
      {content}
    </div>
  );
};
