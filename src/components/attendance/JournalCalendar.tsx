import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarSync,
  BookOpen,
  Users,
  Sparkles
} from 'lucide-react';

export interface CalendarDayCell {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export interface DayAttendanceStat {
  totalSessions: number;
  completedSessions: number;
  hadirStudents: number;
  absentStudents: number;
}

export interface JournalCalendarProps {
  currentYear: number;
  currentMonth: number;
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTodayClick: () => void;
  calendarDays: CalendarDayCell[];
  monthSummary: Record<string, DayAttendanceStat>;
  isAdmin?: boolean;
  onOpenScheduleModal: () => void;
  onNavigateToSyllabus?: () => void;
  onNavigateToEnrollment?: () => void;
  onOpenAdminLogin?: () => void;
}

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Ahd'];

export const JournalCalendar: React.FC<JournalCalendarProps> = ({
  currentYear,
  currentMonth,
  selectedDateStr,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onTodayClick,
  calendarDays,
  monthSummary,
  isAdmin = false,
  onOpenScheduleModal,
  onNavigateToSyllabus,
  onNavigateToEnrollment,
  onOpenAdminLogin,
}) => {
  const monthStats = useMemo(() => {
    let totalSessions = 0;
    let completedSessions = 0;
    let totalHadir = 0;

    Object.values(monthSummary).forEach((st: DayAttendanceStat) => {
      totalSessions += st.totalSessions || 0;
      completedSessions += st.completedSessions || 0;
      totalHadir += st.hadirStudents || 0;
    });

    const pendingSessions = Math.max(0, totalSessions - completedSessions);
    const completionRate =
      totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    return {
      totalSessions,
      completedSessions,
      pendingSessions,
      totalHadir,
      completionRate,
    };
  }, [monthSummary]);

  return (
    <div className="lg:col-span-7 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3.5">
      {/* Calendar Month Navigation Header & Action Shortcuts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <div className="inline-flex items-center border border-slate-200 rounded-xl p-0.5 bg-slate-200">
            <button
              type="button"
              onClick={onPrevMonth}
              className="p-1 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onTodayClick}
              className="px-2.5 py-1 text-xs font-bold rounded-lg text-slate-700 hover:bg-white transition-colors cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              className="p-1 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
              title="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Simplified Month Statistics Overview */}
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="flex items-center justify-between sm:flex-col sm:items-start px-2 py-0.5">
            <span className="text-[11px] font-medium text-slate-500">Sesi</span>
            <span className="text-sm font-extrabold text-slate-800">
              <span className="text-sm font-extrabold text-emerald-600">{monthStats.completedSessions}</span>
              /{monthStats.totalSessions}
              <span className="text-[11px] font-medium text-emerald-700"> ({monthStats.completionRate}%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between sm:flex-col sm:items-start px-2 py-0.5">
            <span className="text-[11px] font-medium text-indigo-700">Hadir</span>
            <span className="text-sm font-extrabold text-indigo-600">{monthStats.totalHadir}</span>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onNavigateToSyllabus && (
            <button
              type="button"
              onClick={onNavigateToSyllabus}
              className="flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 rounded-full transition-colors cursor-pointer"
              title="Buka silabus kurikulum dan target bab"
            >
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span className="hidden">Silabus</span>
            </button>
          )}

          {onNavigateToEnrollment && (
            <button
              type="button"
              onClick={onNavigateToEnrollment}
              className="flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 rounded-full transition-colors cursor-pointer"
              title="Kelola data santri dan rombel"
            >
              <Users className="w-4 h-4 text-indigo-600" />
              <span className="hidden">Santri</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={onOpenScheduleModal}
              className="flex items-center gap-1.5 px-1.5 py-1.5 text-white rounded-full text-xs font-bold hover:bg-[#0359a3] transition-colors whitespace-nowrap shadow-2xs cursor-pointer ml-1"
              title="Jadwalkan seluruh sesi KBM berdasarkan aturan jadwal ke database"
            >
              <CalendarSync className="w-4 h-4 text-amber-400" />
              <span className="hidden">Jadwalkan Pertemuan</span>
            </button>
          )}
        </div>
      </div>

      {/* Calendar Day Header */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 py-1 border-b border-slate-100">
        {DAY_HEADERS.map((h, i) => (
          <div key={h} className={i === 6 ? 'text-rose-500' : ''}>
            {h}
          </div>
        ))}
      </div>

      {/* Calendar Month Days Matrix */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {calendarDays.map((cell, idx) => {
          const isSelected = cell.dateStr === selectedDateStr;
          const dayStat = monthSummary[cell.dateStr];
          const hasSessions = dayStat && dayStat.totalSessions > 0;
          const isFullyCompleted = hasSessions && dayStat.completedSessions >= dayStat.totalSessions;
          const isPartiallyCompleted = hasSessions && dayStat.completedSessions > 0 && !isFullyCompleted;

          return (
            <button
              key={`${cell.dateStr}-${idx}`}
              type="button"
              onClick={() => onSelectDate(cell.dateStr)}
              className={`min-h-[64px] sm:min-h-[76px] p-1.5 sm:p-2 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative group ${
                isSelected
                  ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400/50 shadow-xs'
                  : cell.isCurrentMonth
                  ? 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  : 'border-slate-100/60 bg-slate-50/40 text-slate-400 opacity-60'
              }`}
            >
              {/* Top row: day number & today pill */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs sm:text-sm font-bold ${
                    cell.isToday
                      ? 'w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-extrabold shadow-2xs'
                      : cell.isCurrentMonth
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {/* Completion Dot Indicator */}
                {hasSessions && (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isFullyCompleted
                        ? 'bg-emerald-500 ring-2 ring-emerald-200'
                        : isPartiallyCompleted
                        ? 'bg-amber-500 ring-2 ring-amber-200'
                        : 'bg-slate-300'
                    }`}
                    title={`${dayStat.completedSessions}/${dayStat.totalSessions} sesi terisi`}
                  />
                )}
              </div>

              {/* Bottom: Proportional Presence Density Bar & Session Count */}
              {hasSessions ? (
                <div className="mt-1 space-y-1">
                  {/* Density Bar */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                    {isFullyCompleted ? (
                      <div className="bg-emerald-500 h-full w-full" />
                    ) : isPartiallyCompleted ? (
                      <>
                        <div
                          className="bg-emerald-500 h-full"
                          style={{
                            width: `${Math.round((dayStat.completedSessions / dayStat.totalSessions) * 100)}%`,
                          }}
                        />
                        <div className="bg-amber-400 h-full flex-1" />
                      </>
                    ) : (
                      <div className="bg-slate-200 h-full w-full" />
                    )}
                  </div>

                  <span
                    className={`block text-[10px] font-bold px-1.5 py-0.5 rounded-lg truncate text-center ${
                      isFullyCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : isPartiallyCompleted
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {dayStat.completedSessions > 0
                      ? `${dayStat.completedSessions}/${dayStat.totalSessions} Terisi`
                      : `${dayStat.totalSessions} Sesi`}
                  </span>
                </div>
              ) : (
                <div className="h-4" />
              )}
            </button>
          );
        })}
      </div>

      {/* Calendar Legend */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Semua Terisi
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            Sebagian Terisi
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
            Belum Dicatat
          </span>
        </div>
        <span className="text-slate-400">Klik tanggal untuk membuka sesi</span>
      </div>
    </div>
  );
};
