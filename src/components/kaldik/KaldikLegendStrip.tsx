import React from 'react';
import type { Period } from '../../types';
import type { MonthlyStats } from '../../utils/kaldikCalendar';

export interface KaldikLegendStripProps {
  monthName: string;
  stats: MonthlyStats;
  periodsInMonth: Period[];
}

export const KaldikLegendStrip: React.FC<KaldikLegendStripProps> = ({
  monthName,
  stats,
  periodsInMonth
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 px-3.5 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-slate-500">
      {/* Left: title */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
          Keterangan & Statistik Bulan {monthName}:
        </span>
      </div>

      {/* Right: legend dots and stats */}
      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
        <span className="inline-flex items-center gap-1 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-rose-500" />Libur
        </span>
        <span className="inline-flex items-center gap-1 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-amber-500" />KBM
        </span>
        <span className="inline-flex items-center gap-1 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />Ujian
        </span>
        <span className="inline-flex items-center gap-1 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />Agenda
        </span>
        <span className="inline-flex items-center gap-1 text-[11px]">
          <span className="w-2 h-2 rounded-xs border-2 border-amber-500" />Hari Ini
        </span>
        <span className="font-semibold text-slate-800">{stats.kbmDaysCount} Hari KBM</span>
        <span>•</span>
        <span className="font-semibold text-rose-600">{stats.holidayCount} Hari Libur</span>
        <span>•</span>
        <span className="font-semibold text-indigo-600">{stats.totalSessions} Sesi Pelajaran</span>
        {periodsInMonth.length > 0 && (
          <>
            <span>•</span>
            <span className="font-medium text-amber-800">
              Periode: {periodsInMonth.map((p) => p.name).join(', ')}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
