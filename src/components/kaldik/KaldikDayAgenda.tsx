import React from 'react';
import { CalendarDays, Clock, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import type { KaldikEvent, Period } from '../../types';

export interface KaldikDayAgendaProps {
  events: KaldikEvent[];
  periods: Period[];
  isAdmin: boolean;
  onAddEvent: () => void;
  onEditEvent: (evt: KaldikEvent) => void;
  onDeleteEvent: (id: string) => void;
}

export const KaldikDayAgenda: React.FC<KaldikDayAgendaProps> = ({
  events,
  periods,
  isAdmin,
  onAddEvent,
  onEditEvent,
  onDeleteEvent
}) => {
  return (
    <div>
      {events.length === 0 ? (
        <div className="p-3.5 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
          <p className="text-xs text-slate-500 font-medium">
            Tidak ada agenda atau event khusus pada tanggal ini.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={onAddEvent}
              className="mt-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 underline cursor-pointer"
            >
              + Tambahkan Event Baru
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((evt) => {
            const isKbmMissingPeriod = Boolean(
              evt.isKbm && (!evt.periodId || !periods.some((p) => p.id === evt.periodId))
            );

            return (
              <div
                key={evt.id}
                className={`p-3 rounded-xl border bg-white shadow-2xs flex items-start justify-between gap-3 transition-colors hover:border-slate-300 ${
                  isKbmMissingPeriod ? 'border-dashed border-amber-400 bg-amber-50/40' : ''
                }`}
                style={{ borderLeftWidth: '4px', borderLeftColor: evt.color || '#F59E0B' }}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">{evt.title}</span>
                    {evt.isKbm && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                        KBM Resmi
                      </span>
                    )}
                    {isKbmMissingPeriod && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-dashed border-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-700" />
                        Periode Rujukan Hilang
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 capitalize">
                      {evt.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{evt.isAllDay ? 'Sepanjang Hari' : `${evt.startTime} - ${evt.endTime}`}</span>
                    </span>
                    {evt.isRecurring && (
                      <span className="text-amber-700 font-medium">
                        • Berulang ({evt.repeatDetail || 'Mingguan'})
                      </span>
                    )}
                  </div>

                  {evt.description && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg mt-1 border border-slate-100">
                      {evt.description}
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => onEditEvent(evt)}
                      className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit Event"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteEvent(evt.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
