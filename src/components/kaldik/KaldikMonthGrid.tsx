import React from 'react';
import { Plus, AlertTriangle, BookOpen, CheckCircle2 } from 'lucide-react';
import type { Period } from '../../types';
import { WEEKDAY_COLUMNS, type CalendarDay } from '../../utils/kaldikCalendar';
import type { AttendancePendingStore } from '../../utils/useAttendancePendingStore';
import type { KaldikMode } from './KaldikModeSwitch';

export interface KaldikMonthGridProps {
  days: CalendarDay[];
  mode: KaldikMode;
  isAdmin: boolean;
  periods: Period[];
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
  onQuickAddEvent: (dateStr: string) => void;
  monthMeetingsMap: Map<string, any[]>;
  monthSummary: Record<string, any>;
  store: AttendancePendingStore;
}

interface DayCompletion {
  total: number;
  completed: number;
  hasDraft: boolean;
  isAllDone: boolean;
  isPartial: boolean;
}

function getDayCompletion(
  dateStr: string,
  slotCount: number,
  monthMeetingsMap: Map<string, any[]>,
  monthSummary: Record<string, any>,
  store: AttendancePendingStore
): DayCompletion {
  const dayMeetings = monthMeetingsMap.get(dateStr) || [];
  const total = dayMeetings.length;
  const completed = dayMeetings.filter(
    (m: any) => store.getEffectiveStatus(m.id, m.status) === 'completed'
  ).length;
  const hasDraft = dayMeetings.some((m: any) => store.isMeetingDrafted(m.id));
  const isAllDone = completed >= total && total > 0;
  const isPartial = completed > 0 && !isAllDone;
  return { total, completed, hasDraft, isAllDone, isPartial };
}

export const KaldikMonthGrid: React.FC<KaldikMonthGridProps> = ({
  days,
  mode,
  isAdmin,
  periods,
  selectedDateStr,
  onSelectDate,
  onQuickAddEvent,
  monthMeetingsMap,
  monthSummary,
  store
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-700">
        {WEEKDAY_COLUMNS.map((col) => (
          <div
            key={col.name}
            className={`py-2.5 border-r border-slate-200/70 last:border-r-0 ${
              col.isWeekend ? 'bg-slate-100/60 text-rose-600' : ''
            }`}
          >
            <span>{col.name}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 divide-y divide-slate-200/70 auto-rows-fr">
        {days.map((d, index) => {
          const isWeekend = d.dayOfWeek === 'Saturday' || d.dayOfWeek === 'Sunday';
          const holidayEvent = d.events.find((e) => e.type === 'holiday');
          const completion =
            mode === 'jurnal' && d.isCurrentMonth
              ? getDayCompletion(d.dateStr, d.classSlots.length, monthMeetingsMap, monthSummary, store)
              : null;

          return (
            <div
              key={`${d.dateStr}-${index}`}
              onClick={() => {
                if (d.isCurrentMonth) onSelectDate(d.dateStr);
              }}
              className={`min-h-[120px] p-2 border-r border-slate-200/70 last:border-r-0 relative group transition-colors flex flex-col justify-between ${
                !d.isCurrentMonth
                  ? 'bg-slate-50/40 text-slate-300 pointer-events-none'
                  : isWeekend
                  ? 'bg-slate-50/30 hover:bg-amber-50/40 cursor-pointer'
                  : 'bg-white hover:bg-indigo-50/30 cursor-pointer'
              } ${
                d.dateStr === selectedDateStr
                  ? 'ring-2 ring-inset ring-amber-500 bg-amber-50/40 shadow-xs z-1'
                  : d.isToday
                  ? 'ring-1 ring-inset ring-amber-400/80 bg-amber-50/15'
                  : ''
              }`}
            >
              <div>
                {/* Cell header: day number, quick add, jurnal completion */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold leading-none ${
                        d.isToday
                          ? 'w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-2xs font-black'
                          : !d.isCurrentMonth
                          ? 'text-slate-300'
                          : isWeekend
                          ? 'text-rose-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {d.dayNumber}
                    </span>

                    {d.isToday && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                        Hari Ini
                      </span>
                    )}
                  </div>

                  {mode === 'kaldik' && isAdmin && d.isCurrentMonth && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAddEvent(d.dateStr);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                      title="Tambah Event pada Tanggal Ini"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {completion && completion.total > 0 && (
                    <div className="flex items-center gap-1">
                      {completion.hasDraft && (
                        <span
                          className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ring-1 ring-white"
                          title="Ada perubahan draft belum disimpan di tanggal ini"
                        />
                      )}
                      <span
                        className={`w-2 h-2 rounded-full ${
                          completion.isAllDone
                            ? 'bg-emerald-500 ring-2 ring-emerald-200'
                            : completion.isPartial
                            ? 'bg-amber-500 ring-2 ring-amber-200'
                            : 'bg-slate-300'
                        }`}
                        title={`${completion.completed}/${completion.total} sesi presensi terisi`}
                      />
                    </div>
                  )}
                </div>

                {/* Event badges (max 3) */}
                <div className="space-y-1">
                  {d.events.slice(0, 3).map((evt) => {
                    const isKbmMissingPeriod = Boolean(
                      evt.isKbm && (!evt.periodId || !periods.some((p) => p.id === evt.periodId))
                    );

                    return (
                      <div
                        key={evt.id}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate flex items-center gap-1 shadow-2xs ${
                          isKbmMissingPeriod
                            ? 'border border-dashed border-amber-500 bg-amber-50 text-amber-900'
                            : ''
                        }`}
                        style={{
                          backgroundColor: isKbmMissingPeriod ? undefined : `${evt.color || '#6366F1'}15`,
                          color: isKbmMissingPeriod ? undefined : evt.color || '#6366F1',
                          borderLeft: isKbmMissingPeriod ? undefined : `3px solid ${evt.color || '#6366F1'}`
                        }}
                        title={
                          isKbmMissingPeriod
                            ? `${evt.title} (Peringatan: Periode tidak ditemukan atau telah dihapus)`
                            : evt.title
                        }
                      >
                        {isKbmMissingPeriod && <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                        <span className="truncate">{evt.title}</span>
                      </div>
                    );
                  })}

                  {d.events.length > 3 && (
                    <span className="text-[9px] font-bold text-slate-500 block px-1">
                      +{d.events.length - 3} agenda lainnya
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom summary: holiday, jurnal progress, or lesson count */}
              {d.isCurrentMonth && (
                <div className="pt-1.5 mt-1 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-500">
                  {holidayEvent ? (
                    <span className="text-rose-600 font-semibold truncate">Libur</span>
                  ) : completion ? (
                    completion.total === 0 ? (
                      <span className="text-slate-300">Tidak ada sesi</span>
                    ) : (
                      <span
                        className={`font-semibold flex items-center gap-1 truncate ${
                          completion.isAllDone
                            ? 'text-emerald-700'
                            : completion.completed > 0
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                        title={`${completion.completed} dari ${completion.total} sesi telah dicatat presensinya`}
                      >
                        <CheckCircle2
                          className={`w-3 h-3 shrink-0 ${
                            completion.isAllDone
                              ? 'text-emerald-500'
                              : completion.completed > 0
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          }`}
                        />
                        <span>
                          {completion.completed}/{completion.total} Sesi
                        </span>
                      </span>
                    )
                  ) : d.classSlots.length > 0 ? (
                    <span className="font-medium text-slate-600 flex items-center gap-1 truncate">
                      <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{d.classSlots.length} Sesi KBM</span>
                    </span>
                  ) : (
                    <span className="text-slate-300">Tidak ada sesi</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
