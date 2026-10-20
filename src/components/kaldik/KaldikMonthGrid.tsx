import React, { useMemo } from 'react';
import { Plus, AlertTriangle, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
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
  store: AttendancePendingStore;
}

interface JurnalCellStats {
  totalMeetings: number;
  completedMeetings: number;
  scheduledMeetings: number;
  cancelledMeetings: number;
  hasDraft: boolean;
  totalHadirCount: number;
  densityBars: number[];
}

function getJurnalCellStats(
  dateStr: string,
  monthMeetingsMap: Map<string, any[]>,
  store: AttendancePendingStore
): JurnalCellStats {
  const dayMeetings = monthMeetingsMap.get(dateStr) || [];
  const totalMeetings = dayMeetings.length;
  let completedMeetings = 0;
  let scheduledMeetings = 0;
  let cancelledMeetings = 0;
  let hasDraft = false;
  let totalHadirCount = 0;

  const densityBars: number[] = [];

  for (const m of dayMeetings) {
    const status = store.getEffectiveStatus(m.id, m.status);
    const draft = store.getRollCallDraft(m.id);
    if (store.isMeetingDrafted(m.id)) hasDraft = true;

    if (status === 'completed') {
      completedMeetings++;
    } else if (status === 'cancelled') {
      cancelledMeetings++;
    } else {
      scheduledMeetings++;
    }

    // Check if people are actually registered / logged for this meeting
    let hadir = 0;
    let enrolled = 0;
    let isLogged = false;

    if (draft?.studentLogs && draft.studentLogs.length > 0) {
      const loggedStudents = draft.studentLogs.filter((s: any) => Boolean(s.status));
      if (loggedStudents.length > 0) {
        isLogged = true;
        hadir = loggedStudents.filter((s: any) => s.status === 'Hadir').length;
        enrolled = draft.studentLogs.length;
      }
    } else if (
      m.is_logged ||
      (m.summary &&
        ((m.summary.hadirCount ?? 0) > 0 ||
          (m.summary.izinCount ?? 0) > 0 ||
          (m.summary.sakitCount ?? 0) > 0 ||
          (m.summary.terlambatCount ?? 0) > 0 ||
          (m.summary.alpaCount ?? 0) > 0)) ||
      (m.present_count ?? 0) > 0 ||
      status === 'completed'
    ) {
      isLogged = true;
      hadir = m.summary?.hadirCount ?? m.present_count ?? 0;
      enrolled = m.summary?.totalEnrolled ?? m.enrolled_count ?? (hadir > 0 ? hadir : 1);
    }

    // Only push bar when attendance has actually been logged/registered!
    if (isLogged && enrolled > 0) {
      totalHadirCount += hadir;
      const ratio = Math.max(0.15, Math.min(1.0, hadir / Math.max(1, enrolled)));
      densityBars.push(Math.round(ratio * 100));
    }
  }

  return {
    totalMeetings,
    completedMeetings,
    scheduledMeetings,
    cancelledMeetings,
    hasDraft,
    totalHadirCount,
    densityBars
  };
}

function stepDateStr(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays, 12, 0, 0);
  const yStr = dt.getFullYear();
  const mStr = String(dt.getMonth() + 1).padStart(2, '0');
  const dStr = String(dt.getDate()).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
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
  store
}) => {
  // Mobile week slice calculations
  const selectedIndex = useMemo(
    () => days.findIndex((d) => d.dateStr === selectedDateStr),
    [days, selectedDateStr]
  );

  const isWeekSelected = Boolean(selectedDateStr);
  const activeWeekRow = selectedIndex !== -1 ? Math.floor(selectedIndex / 7) : 0;
  const mobileWeekDays = useMemo(() => {
    if (!isWeekSelected) return days.slice(0, 7);
    if (selectedIndex !== -1) {
      return days.slice(activeWeekRow * 7, activeWeekRow * 7 + 7);
    }
    return days.slice(0, 7);
  }, [days, isWeekSelected, selectedIndex, activeWeekRow]);

  const handleCellClick = (dateStr: string) => {
    // Tap active date again to deselect / expand full calendar on mobile!
    if (selectedDateStr === dateStr) {
      onSelectDate('');
    } else {
      onSelectDate(dateStr);
    }
  };

  const handlePrevDay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedDateStr) return;
    onSelectDate(stepDateStr(selectedDateStr, -1));
  };

  const handleNextDay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedDateStr) return;
    onSelectDate(stepDateStr(selectedDateStr, 1));
  };

  // Reusable cell renderer for both mobile week strip & desktop month grid
  const renderCell = (d: CalendarDay, isCompactMobile: boolean = false) => {
    const isWeekend = d.dayOfWeek === 'Saturday' || d.dayOfWeek === 'Sunday';
    const holidayEvent = d.events.find((e) => e.type === 'holiday');
    const isSelected = d.dateStr === selectedDateStr;
    const stats =
      mode === 'jurnal' && d.isCurrentMonth
        ? getJurnalCellStats(d.dateStr, monthMeetingsMap, store)
        : null;

    return (
      <div
        key={d.dateStr}
        onClick={() => {
          handleCellClick(d.dateStr);
        }}
        className={`${
          isCompactMobile ? 'min-h-[64px] p-1.5' : 'min-h-[86px] p-2'
        } border-r border-slate-200/70 last:border-r-0 relative group transition-all flex flex-col justify-between ${
          !d.isCurrentMonth
            ? isCompactMobile
              ? 'bg-slate-50/70 text-slate-400 hover:bg-slate-100/70 cursor-pointer'
              : 'bg-slate-50/40 text-slate-300 hover:bg-slate-100/50 cursor-pointer'
            : isWeekend
            ? 'bg-slate-50/40 hover:bg-amber-50/50 cursor-pointer'
            : 'bg-white hover:bg-indigo-50/30 cursor-pointer'
        } ${
          isSelected
            ? 'ring-2 ring-inset ring-amber-500 bg-amber-50/60 shadow-xs z-1'
            : d.isToday
            ? 'ring-1 ring-inset ring-amber-400/80 bg-amber-50/20'
            : ''
        }`}
      >
        {/* Cell header: day number, today badge, quick add */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1">
              <span
                className={`text-xs font-bold leading-none ${
                  d.isToday
                    ? 'w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-2xs font-black'
                    : !d.isCurrentMonth
                    ? 'text-slate-300'
                    : isWeekend
                    ? 'text-rose-600'
                    : 'text-slate-800'
                }`}
              >
                {d.dayNumber}
              </span>
              {d.isToday && !isCompactMobile && (
                <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded">
                  Hari Ini
                </span>
              )}
            </div>

            {/* Quick add event in Kaldik mode */}
            {mode === 'kaldik' && isAdmin && d.isCurrentMonth && !isCompactMobile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAddEvent(d.dateStr);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                title="Tambah Event"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}

            {/* Draft unsaved pulse dot */}
            {stats && stats.hasDraft && (
              <span
                className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ring-1 ring-white"
                title="Ada perubahan draft di tanggal ini"
              />
            )}
          </div>

          {/* Center Zone: Mode Kaldik = Event pills; Mode Jurnal = Attendance Density Column Diagram */}
          {mode === 'kaldik' ? (
            <div className="space-y-0.5 my-1">
              {d.events.slice(0, isCompactMobile ? 1 : 2).map((evt) => {
                const isKbmMissingPeriod = Boolean(
                  evt.isKbm && (!evt.periodId || !periods.some((p) => p.id === evt.periodId))
                );

                return (
                  <div
                    key={evt.id}
                    className={`px-1 py-0.5 rounded text-[9px] font-semibold truncate flex items-center gap-0.5 shadow-2xs ${
                      isKbmMissingPeriod
                        ? 'border border-dashed border-amber-500 bg-amber-50 text-amber-900'
                        : ''
                    }`}
                    style={{
                      backgroundColor: isKbmMissingPeriod ? undefined : `${evt.color || '#6366F1'}15`,
                      color: isKbmMissingPeriod ? undefined : evt.color || '#6366F1',
                      borderLeft: isKbmMissingPeriod ? undefined : `2.5px solid ${evt.color || '#6366F1'}`
                    }}
                    title={evt.title}
                  >
                    {isKbmMissingPeriod && <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                    <span className="truncate">{evt.title}</span>
                  </div>
                );
              })}

              {!isCompactMobile && d.events.length > 2 && (
                <span className="text-[8px] font-bold text-slate-400 block px-0.5">
                  +{d.events.length - 2}
                </span>
              )}
            </div>
          ) : (
            /* Mode Jurnal: Vertical column diagram chart representing attendance density / trend across sessions */
            stats && stats.densityBars.length > 0 ? (
              <div
                className="my-1 flex items-end justify-center gap-1 h-5 px-0.5"
                title={`${stats.completedMeetings}/${stats.totalMeetings} pertemuan selesai (${stats.totalHadirCount} santri hadir)`}
              >
                {stats.densityBars.slice(0, 6).map((heightPercent, bIdx) => (
                  <div
                    key={bIdx}
                    style={{ height: `${Math.max(16, heightPercent)}%` }}
                    className={`w-1.5 rounded-t-xs transition-all ${
                      heightPercent > 50
                        ? 'bg-emerald-500'
                        : heightPercent > 25
                        ? 'bg-amber-400'
                        : 'bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            ) : (
              <div className="h-5 my-1" />
            )
          )}
        </div>

        {/* Footer Zone */}
        {d.isCurrentMonth && (
          <div className="pt-1 mt-0.5 border-t border-slate-100 flex items-center justify-between w-full">
            {mode === 'kaldik' ? (
              /* Kaldik Mode: Event count instead of lesson count */
              <span className="text-[9px] text-slate-500 font-medium truncate w-full">
                {holidayEvent ? (
                  <span className="text-rose-600 font-bold">Libur</span>
                ) : d.events.length > 0 ? (
                  `${d.events.length} Agenda`
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </span>
            ) : (
              /* Jurnal Mode: Stacked horizontal progress bar replacing text count */
              stats && stats.totalMeetings > 0 ? (
                <div
                  className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5"
                  title={`${stats.completedMeetings}/${stats.totalMeetings} Pertemuan Selesai`}
                >
                  {stats.completedMeetings > 0 && (
                    <div
                      style={{ width: `${(stats.completedMeetings / stats.totalMeetings) * 100}%` }}
                      className="bg-emerald-500 h-full"
                    />
                  )}
                  {stats.scheduledMeetings > 0 && (
                    <div
                      style={{ width: `${(stats.scheduledMeetings / stats.totalMeetings) * 100}%` }}
                      className="bg-amber-400 h-full"
                    />
                  )}
                  {stats.cancelledMeetings > 0 && (
                    <div
                      style={{ width: `${(stats.cancelledMeetings / stats.totalMeetings) * 100}%` }}
                      className="bg-slate-300 h-full"
                    />
                  )}
                </div>
              ) : (
                <span className="text-[9px] text-slate-300">—</span>
              )
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* ------------------------------------------------------------- */}
      {/* Mobile-only Collapsed 7-Day Week Strip with Edge Navigation  */}
      {/* Visible only when on small screen (< lg) and a date is picked */}
      {/* ------------------------------------------------------------- */}
      {isWeekSelected && (
        <div className="block lg:hidden border-b border-slate-200 bg-slate-50/90 p-1.5">
          <div className="flex items-center justify-between gap-1">

            <div className="grid grid-cols-7 gap-1 flex-1">
              {mobileWeekDays.map((d) => renderCell(d, true))}
            </div>

          </div>

          <div className="flex items-center justify-between px-2 pt-1.5 text-[10px] text-slate-400">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0 shadow-2xs"
              title="Hari Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="flex gap-1">Ketuk tanggal aktif lagi untuk
              <button
                type="button"
                onClick={() => onSelectDate('')}
                className="flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Buka Kalender</span>
              </button>
            </span>

            <button
              type="button"
              onClick={handleNextDay}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0 shadow-2xs"
              title="Hari Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Full 5-Week Month Grid (Always on Desktop, or when unselected on Mobile) */}
      {/* ------------------------------------------------------------- */}
      <div className={`${isWeekSelected ? 'hidden lg:block' : 'block'}`}>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-700">
          {WEEKDAY_COLUMNS.map((col) => (
            <div
              key={col.name}
              className={`py-2 border-r border-slate-200/70 last:border-r-0 ${
                col.isWeekend ? 'bg-slate-100/60 text-rose-600' : ''
              }`}
            >
              <span>{col.name}</span>
            </div>
          ))}
        </div>

        {/* Day cells grid */}
        <div className="grid grid-cols-7 divide-y divide-slate-200/70 auto-rows-fr">
          {days.map((d) => renderCell(d, false))}
        </div>
      </div>
    </div>
  );
};
