import React from 'react';
import { CalendarDays, BookOpen } from 'lucide-react';

export type KaldikMode = 'kaldik' | 'jurnal';

export interface KaldikModeSwitchProps {
  mode: KaldikMode;
  onChange: (mode: KaldikMode) => void;
  className?: string;
}

export const KaldikModeSwitch: React.FC<KaldikModeSwitchProps> = ({
  mode,
  onChange,
  className = ''
}) => {
  return (
    <div
      className={`inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-2xs ${className}`}
      role="group"
      aria-label="Mode Kalender"
    >
      <button
        type="button"
        onClick={() => onChange('kaldik')}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
          mode === 'kaldik'
            ? 'bg-white text-amber-900 shadow-2xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
        }`}
        title="Mode Kaldik: Agenda, event kalender akademik, dan periode KBM"
      >
        <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
        <span>Kaldik</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('jurnal')}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
          mode === 'jurnal'
            ? 'bg-white text-indigo-900 shadow-2xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
        }`}
        title="Mode Jurnal: Matriks kelas per sesi dan jadwal materi pelajaran"
      >
        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
        <span>Jurnal</span>
      </button>
    </div>
  );
};
