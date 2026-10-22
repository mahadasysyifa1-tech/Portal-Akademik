// session list in jurnal mode day detail
import React from 'react';
import { Plus, Sparkles } from 'lucide-react';
import type { Period } from '../../types';

export interface KaldikDayPanelProps {
  dayNumber: number;
  monthAbbr: string;
  formattedDate: string;
  isToday: boolean;
  activePeriods: Period[];
  showAddEvent: boolean;
  onAddEvent: () => void;
  children: React.ReactNode;
}

export const KaldikDayPanel: React.FC<KaldikDayPanelProps> = ({
  dayNumber,
  monthAbbr,
  formattedDate,
  isToday,
  activePeriods,
  showAddEvent,
  onAddEvent,
  children
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex flex-col items-center justify-center font-bold shadow-xs shrink-0">
            <span className="text-[10px] uppercase font-semibold leading-tight">{dayNumber}</span>
            <span className="text-[11px] font-bold leading-none">{monthAbbr}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Rincian Tanggal: {formattedDate}
              </h3>
              {isToday && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Hari Ini
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
              {activePeriods.length > 0 ? (
                activePeriods.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1 font-semibold text-amber-800">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>
                      {p.name} ({p.startDate} s.d. {p.endDate})
                    </span>
                  </span>
                ))
              ) : (
                <span className="text-slate-400">Di luar rentang periode KBM aktif</span>
              )}
            </div>
          </div>
        </div>

        {showAddEvent && (
          <button
            type="button"
            onClick={onAddEvent}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Event Tanggal Ini</span>
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-6">{children}</div>
    </div>
  );
};
