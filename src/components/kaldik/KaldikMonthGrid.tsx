import React, { useMemo } from 'react';
import { Plus, AlertTriangle, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import type { Period, KaldikEvent } from '../../types';
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
  totalEnrolledCount: number;
  dayPercent: number | null; // 0-100, null when no logged students
}

interface WeekEventBar {
  event: KaldikEvent;
  startCol: number; // 1..7
  endCol: number;   // 1..7
  span: number;     // 1..7
  isStartsThisWeek: boolean;
  isEndsThisWeek: boolean;
  isMultiDay: boolean;
  trackIndex: number;
  isKbmMissingPeriod: boolean;
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
  let totalEnrolledCount = 0;

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

    let hadir = 0;
    let enrolled = 0;
    let isLogged = false;

    if (draft?.studentLogs && draft.studentLogs.length > 0) {
      const loggedStudents = draft.studentLogs.filter((s: any) => Boolean(s.status));
      if (loggedStudents.length > 0) {
        isLogged = true;
        hadir = loggedStudents.filter((s: any) => s.status === 'Hadir' || s.status === 'Terlambat').length;
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
      hadir = (m.summary?.hadirCount ?? m.present_count ?? 0) + (m.summary?.terlambatCount ?? 0);
      enrolled = m.summary?.totalEnrolled ?? m.enrolled_count ?? (hadir > 0 ? hadir : 1);
    }

    if (isLogged && enrolled > 0) {
      totalHadirCount += hadir;
      totalEnrolledCount += enrolled;
    }
  }

  const dayPercent =
    totalEnrolledCount > 0
      ? Math.min(100, Math.round((totalHadirCount / totalEnrolledCount) * 100))
      : null;

  return {
    totalMeetings,
    completedMeetings,
    scheduledMeetings,
    cancelledMeetings,
    hasDraft,
    totalHadirCount,
    totalEnrolledCount,
    dayPercent
  };
}

// 0% = red, 100% = green, via HSL hue (0 to 120)
function getAttendanceColor(percent: number): string {
  const hue = Math.round(Math.min(100, Math.max(0, percent)) * 1.2);
  return `hsl(${hue} 65% 45%)`;
}

function stepDateStr(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays, 12, 0, 0);
  const yStr = dt.getFullYear();
  const mStr = String(dt.getMonth() + 1).padStart(2, '0');
  const dStr = String(dt.getDate()).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Computes non-overlapping horizontal event tracks across a 7-day week row.
 */
function computeWeekEventBars(week: CalendarDay[], periods: Period[]): { bars: WeekEventBar[]; maxTrack: number } {
  if (!week || week.length === 0) return { bars: [], maxTrack: 0 };
  const weekStartStr = week[0].dateStr;
  const weekEndStr = week[week.length - 1].dateStr;

  // Gather unique events appearing in any day of this week
  const eventMap = new Map<string, KaldikEvent>();
  for (const d of week) {
    for (const evt of d.events) {
      if (!eventMap.has(evt.id)) {
        eventMap.set(evt.id, evt);
      }
    }
  }

  const rawEvents = Array.from(eventMap.values());
  const rawBars: WeekEventBar[] = [];

  for (const evt of rawEvents) {
    const start = evt.startDate;
    const end = evt.endDate || evt.startDate;

    const clampedStart = start < weekStartStr ? weekStartStr : start;
    const clampedEnd = end > weekEndStr ? weekEndStr : end;

    const startColIdx = week.findIndex((d) => d.dateStr === clampedStart);
    const endColIdx = week.findIndex((d) => d.dateStr === clampedEnd);

    const safeStartIdx = startColIdx !== -1 ? startColIdx : 0;
    const safeEndIdx = endColIdx !== -1 ? endColIdx : 6;

    const startCol = safeStartIdx + 1; // 1-indexed (1..7)
    const endCol = Math.max(startCol, safeEndIdx + 1);
    const span = endCol - startCol + 1;

    const isKbmMissingPeriod = Boolean(
      evt.isKbm && (!evt.periodId || !periods.some((p) => p.id === evt.periodId))
    );

    rawBars.push({
      event: evt,
      startCol,
      endCol,
      span,
      isStartsThisWeek: start >= weekStartStr,
      isEndsThisWeek: end <= weekEndStr,
      isMultiDay: start !== end,
      trackIndex: 0,
      isKbmMissingPeriod
    });
  }

  // Sort: Multi-day events first (longer span first, then earlier startCol), then single-day events
  rawBars.sort((a, b) => {
    if (a.isMultiDay !== b.isMultiDay) return a.isMultiDay ? -1 : 1;
    if (b.span !== a.span) return b.span - a.span;
    return a.startCol - b.startCol;
  });

  // Assign non-overlapping tracks
  const trackOccupancy: Array<Array<{ startCol: number; endCol: number }>> = [];
  const bars: WeekEventBar[] = [];
  let maxTrack = 0;

  for (const bar of rawBars) {
    let track = 0;
    while (true) {
      if (!trackOccupancy[track]) {
        trackOccupancy[track] = [];
        break;
      }
      const hasOverlap = trackOccupancy[track].some(
        (occ) => Math.max(bar.startCol, occ.startCol) <= Math.min(bar.endCol, occ.endCol)
      );
      if (!hasOverlap) {
        break;
      }
      track++;
    }

    trackOccupancy[track].push({ startCol: bar.startCol, endCol: bar.endCol });
    bars.push({ ...bar, trackIndex: track });
    if (track > maxTrack) maxTrack = track;
  }

  return { bars, maxTrack: trackOccupancy.length };
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

  // Divide calendar days into 7-day week chunks
  const weeks = useMemo(() => {
    const list: CalendarDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      list.push(days.slice(i, i + 7));
    }
    return list;
  }, [days]);

  const handleCellClick = (dateStr: string) => {
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

  // Render a 7-day week row with horizontal spanning bars
  const renderWeekRow = (weekDays: CalendarDay[], isCompactMobile: boolean = false) => {
    const { bars, maxTrack } = mode === 'kaldik'
      ? computeWeekEventBars(weekDays, periods)
      : { bars: [], maxTrack: 0 };

    // Limit maximum tracks rendered as bars on compact mobile
    const visibleBars = isCompactMobile ? bars.filter((b) => b.trackIndex < 2) : bars;
    const effectiveTracks = isCompactMobile ? Math.min(2, maxTrack) : maxTrack;

    // Jurnal day bar: one fixed height for every cell, so the grid stays even
    const dayBarHeight = isCompactMobile ? 28 : 36;

    // Minimum height adjusted for event bar tracks
    const minHeightPx = isCompactMobile
      ? Math.max(68, 32 + effectiveTracks * 24 + 18)
      : Math.max(96, 36 + effectiveTracks * 26 + 22);

    return (
      <div key={weekDays[0]?.dateStr || 'week'} className="relative border-b border-slate-200/70 last:border-b-0">
        {/* Layer 1: Background & Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-slate-200/70">
          {weekDays.map((d) => {
            const isWeekend = d.dayOfWeek === 'Saturday' || d.dayOfWeek === 'Sunday';
            const holidayEvent = d.events.find((e) => e.type === 'holiday' || e.isKbm === false);
            const isSelected = d.dateStr === selectedDateStr;
            const stats =
              mode === 'jurnal' && d.isCurrentMonth
                ? getJurnalCellStats(d.dateStr, monthMeetingsMap, store)
                : null;
            const dayPercent = stats?.dayPercent ?? null;

            return (
              <div
                key={d.dateStr}
                onClick={() => handleCellClick(d.dateStr)}
                style={{ minHeight: `${minHeightPx}px` }}
                className={`p-1.5 transition-all flex flex-col justify-between group ${
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
                {/* Header: Day number, today badge, quick add */}
                <div className="flex items-center justify-between mb-1">
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
                      <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1 py-px rounded">
                        Hari Ini
                      </span>
                    )}
                  </div>

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

                  {stats && stats.hasDraft && (
                    <span
                      className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ring-1 ring-white"
                      title="Ada perubahan draft di tanggal ini"
                    />
                  )}
                </div>

                {/* Middle zone: jurnal = one vertical day bar, kaldik = spacer for overlay bars */}
                {mode === 'jurnal' ? (
                  <div
                    className="my-1 flex items-center justify-center gap-1.5"
                    style={{ height: `${dayBarHeight}px` }}
                    title={
                      stats && dayPercent !== null
                        ? `Kehadiran hari ini: ${dayPercent}% (${stats.totalHadirCount}/${stats.totalEnrolledCount} santri)`
                        : 'Belum ada data presensi'
                    }
                  >
                    {d.isCurrentMonth && (
                      <div className="relative w-3.5 h-full rounded-sm bg-slate-100 overflow-hidden">
                        {dayPercent !== null && (
                          <div
                            className="absolute bottom-0 inset-x-0 transition-all duration-300"
                            style={{
                              height: `${dayPercent}%`,
                              backgroundColor: getAttendanceColor(dayPercent)
                            }}
                          />
                        )}
                      </div>
                    )}
                    {dayPercent !== null && (
                      <span className="text-[9px] font-bold text-slate-600 tabular-nums">
                        {dayPercent}%
                      </span>
                    )}
                  </div>
                ) : (
                  // Empty space reserved for overlay bars
                  <div style={{ height: `${effectiveTracks * (isCompactMobile ? 24 : 26)}px` }} />
                )}

                {/* Footer Zone */}
                {d.isCurrentMonth && (
                  <div className="pt-1 mt-auto border-t border-slate-100 flex items-center justify-between w-full">
                    {mode === 'kaldik' ? (
                      <span className="text-[9px] text-slate-500 font-medium truncate w-full">
                        {holidayEvent ? (
                          <span className="text-rose-600 font-bold">Libur/Non-KBM</span>
                        ) : d.events.length > 0 ? (
                          `${d.events.length} Agenda`
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </span>
                    ) : (
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
                          {stats.cancelledMeetings > 0 && (
                            <div
                              style={{ width: `${(stats.cancelledMeetings / stats.totalMeetings) * 100}%` }}
                              className="bg-slate-400 h-full"
                            />
                          )}
                          {stats.scheduledMeetings > 0 && (
                            <div
                              style={{ width: `${(stats.scheduledMeetings / stats.totalMeetings) * 100}%` }}
                              className="bg-slate-200 h-full"
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
          })}
        </div>

        {/* Layer 2: Spanning Event Bars Overlay (Mode Kaldik Only) */}
        {mode === 'kaldik' && visibleBars.length > 0 && (
          <div
            className="absolute inset-x-0 pointer-events-none flex flex-col z-10"
            style={{
              top: isCompactMobile ? '28px' : '32px',
              gap: isCompactMobile ? '3px' : '4px'
            }}
          >
            {Array.from({ length: effectiveTracks }).map((_, trackIdx) => {
              const trackBars = visibleBars.filter((b) => b.trackIndex === trackIdx);
              return (
                <div key={trackIdx} className="grid grid-cols-7 relative h-5.5">
                  {trackBars.map((bar) => {
                    const evtColor = bar.event.color || '#6366F1';

                    // Shape classes: rounded edges when event starts or ends this week
                    let shapeClass = 'rounded-md mx-1';
                    if (bar.isMultiDay) {
                      if (bar.isStartsThisWeek && bar.isEndsThisWeek) {
                        shapeClass = 'rounded-md mx-1';
                      } else if (bar.isStartsThisWeek) {
                        shapeClass = 'rounded-l-md rounded-r-none ml-1 mr-0';
                      } else if (bar.isEndsThisWeek) {
                        shapeClass = 'rounded-r-md rounded-l-none mr-1 ml-0';
                      } else {
                        shapeClass = 'rounded-none mx-0';
                      }
                    }

                    return (
                      <div
                        key={`${bar.event.id}_${bar.startCol}`}
                        style={{
                          gridColumn: `${bar.startCol} / span ${bar.span}`,
                          backgroundColor: evtColor
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDate(bar.event.startDate);
                        }}
                        className={`h-5.5 px-2 text-[10px] font-semibold flex items-center gap-1.5 text-white shadow-2xs pointer-events-auto cursor-pointer transition-transform hover:brightness-105 select-none ${shapeClass}`}
                        title={`${bar.event.title} (${bar.event.startDate} s.d. ${bar.event.endDate})`}
                      >
                        {bar.isKbmMissingPeriod && (
                          <AlertTriangle className="w-3 h-3 text-amber-200 shrink-0" />
                        )}
                        <span className="truncate flex-1 font-bold">
                          {bar.event.title}
                        </span>
                        {bar.isMultiDay && bar.span > 1 && !isCompactMobile && (
                          <span className="text-[9px] opacity-80 shrink-0 font-normal hidden sm:inline">
                            {bar.event.isKbm ? 'KBM' : bar.event.type}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* ------------------------------------------------------------- */}
      {/* Mobile-only Collapsed 7-Day Week Strip with Edge Navigation  */}
      {/* ------------------------------------------------------------- */}
      {isWeekSelected && (
        <div className="block lg:hidden border-b border-slate-200 bg-slate-50/90 p-1.5">
          {renderWeekRow(mobileWeekDays, true)}

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

        {/* Day cells grid week by week */}
        <div className="divide-y divide-slate-200/70">
          {weeks.map((week) => renderWeekRow(week, false))}
        </div>
      </div>
    </div>
  );
};