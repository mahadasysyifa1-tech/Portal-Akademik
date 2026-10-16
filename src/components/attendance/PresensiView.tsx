import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  Filter,
  Check,
  CalendarCheck2,
  CalendarSync,
  Sparkles,
  BookOpen,
  MapPin,
  RefreshCw,
  Plus
} from 'lucide-react';
import type {
  DatabaseState,
  AttendanceMeetingSummary,
  DayOfWeek
} from '../../types';
import { AttendanceModal } from './AttendanceModal';

interface PresensiViewProps {
  db: DatabaseState;
  initialDate?: string;
  initialClassId?: string;
  initialSessionId?: string;
  onClearDeepLink?: () => void;
  onNavigateToEnrollment?: () => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Ahd'];

export const PresensiView: React.FC<PresensiViewProps> = ({
  db,
  initialDate,
  initialClassId,
  initialSessionId,
  onClearDeepLink,
  onNavigateToEnrollment,
}) => {
  // Calendar Navigation
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const [currentYear, setCurrentYear] = useState<number>(() => {
    if (initialDate) return parseInt(initialDate.slice(0, 4), 10);
    return today.getFullYear();
  });

  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    if (initialDate) return parseInt(initialDate.slice(5, 7), 10) - 1;
    return today.getMonth();
  });

  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    return initialDate || todayStr;
  });

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>(() => initialClassId || 'all');

  // Month overview stats map: 'YYYY-MM-DD' => stats
  const [monthSummary, setMonthSummary] = useState<
    Record<string, { totalSessions: number; completedSessions: number; hadirStudents: number; absentStudents: number }>
  >({});

  // Day sessions list
  const [dayMeetings, setDayMeetings] = useState<AttendanceMeetingSummary[]>([]);
  const [loadingDayMeetings, setLoadingDayMeetings] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Active Roll Call Modal
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

  // Jadwalkan Pertemuan Modal & Action state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleSuccessMessage, setScheduleSuccessMessage] = useState<string | null>(null);
  const [scheduleErrorMessage, setScheduleErrorMessage] = useState<string | null>(null);

  // Load Month Summary from API
  useEffect(() => {
    let isMounted = true;
    const fetchYear = currentYear;
    const fetchMonth = currentMonth + 1;

    fetch(`/api/attendance/month-summary?year=${fetchYear}&month=${fetchMonth}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (isMounted) setMonthSummary(data || {});
      })
      .catch((err) => console.warn('Failed to load month summary:', err));

    return () => {
      isMounted = false;
    };
  }, [currentYear, currentMonth, refreshTrigger]);

  // Client-side cache for day sessions
  const daySessionsCacheRef = useRef<Map<string, AttendanceMeetingSummary[]>>(new Map());

  // Load Day Meetings with SWR cache when selectedDateStr changes
  useEffect(() => {
    if (!selectedDateStr) return;

    let isMounted = true;
    const cached = daySessionsCacheRef.current.get(selectedDateStr);
    if (cached) {
      setDayMeetings(cached);
      setLoadingDayMeetings(false);
    } else {
      setLoadingDayMeetings(true);
    }

    fetch(`/api/attendance/day-sessions?date=${selectedDateStr}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: AttendanceMeetingSummary[]) => {
        if (!isMounted) return;
        daySessionsCacheRef.current.set(selectedDateStr, data || []);
        setDayMeetings(data || []);
        setLoadingDayMeetings(false);

        // Auto-launch modal if deep-linked to this class and session
        if (initialClassId && initialSessionId) {
          const match = data.find(
            (m) => m.classId === initialClassId && m.sessionId === initialSessionId
          );
          if (match) {
            setActiveMeetingId(match.id);
            if (onClearDeepLink) onClearDeepLink();
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Failed to load day meetings:', err);
          setLoadingDayMeetings(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDateStr, refreshTrigger]);

  // Calendar matrix calculations
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Monday-based index: 0 = Mon, 6 = Sun
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: boolean;
    }> = [];

    // Preceding padding days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const pMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const pYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const padStr = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const padDate = new Date(padStr + 'T00:00:00');
      days.push({
        dateStr: padStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: padStr === todayStr,
        isWeekend: padDate.getDay() === 0 || padDate.getDay() === 6,
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const padStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(padStr + 'T00:00:00');
      days.push({
        dateStr: padStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: padStr === todayStr,
        isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
      });
    }

    // Trailing padding to make full 35 or 42 grid
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const padStr = `${nYear}-${String(nMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const padDate = new Date(padStr + 'T00:00:00');
      days.push({
        dateStr: padStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: padStr === todayStr,
        isWeekend: padDate.getDay() === 0 || padDate.getDay() === 6,
      });
    }

    return days;
  }, [currentYear, currentMonth, todayStr]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleTodayClick = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDateStr(todayStr);
  };

  // Filtered day meetings
  const filteredMeetings = useMemo(() => {
    if (selectedClassId === 'all') return dayMeetings;
    return dayMeetings.filter((m) => m.classId === selectedClassId);
  }, [dayMeetings, selectedClassId]);

  // Overall month statistics
  const monthMetrics = useMemo(() => {
    let totalSess = 0;
    let completedSess = 0;
    let hadirTotal = 0;
    let absentTotal = 0;

    for (const d of Object.values(monthSummary) as Array<{
      totalSessions?: number;
      completedSessions?: number;
      hadirStudents?: number;
      absentStudents?: number;
    }>) {
      totalSess += d.totalSessions || 0;
      completedSess += d.completedSessions || 0;
      hadirTotal += d.hadirStudents || 0;
      absentTotal += d.absentStudents || 0;
    }

    const pct = totalSess > 0 ? Math.round((completedSess / totalSess) * 100) : 0;
    return { totalSess, completedSess, pct, hadirTotal, absentTotal };
  }, [monthSummary]);

  // Format date readable
  const selectedDateLabel = useMemo(() => {
    if (!selectedDateStr) return '';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const days = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = days[dateObj.getDay()];
    return `${dayName}, ${d} ${MONTH_NAMES[m - 1]} ${y}`;
  }, [selectedDateStr]);

  // Schedule preview summary computed from db
  const schedulePreview = useMemo(() => {
    const activeRules = (db.rules || []).filter((r) => r.active !== false);
    const periods = db.periods || [];
    const nonKbmEvents = (db.kaldikEvents || []).filter((e) => e.isKbm === false || e.type === 'holiday');
    
    // Earliest and latest period dates
    const allStarts = periods.map((p) => p.startDate || (p as any).start_date).filter(Boolean).sort();
    const allEnds = periods.map((p) => p.endDate || (p as any).end_date).filter(Boolean).sort();
    const dateRangeLabel = allStarts.length > 0 && allEnds.length > 0
      ? `${allStarts[0]} s/d ${allEnds[allEnds.length - 1]}`
      : 'Sepanjang kalender aktif';

    return {
      activeRulesCount: activeRules.length,
      periodsCount: periods.length,
      nonKbmCount: nonKbmEvents.length,
      dateRangeLabel,
    };
  }, [db.rules, db.periods, db.kaldikEvents]);

  const handleExecuteScheduling = async () => {
    setIsScheduling(true);
    setScheduleErrorMessage(null);
    try {
      const res = await fetch('/api/attendance/generate-all-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.details || data?.error || 'Gagal menjadwalkan pertemuan');
      }

      setIsScheduleModalOpen(false);
      setScheduleSuccessMessage(
        `Berhasil menjadwalkan ${data.totalUpserted} pertemuan ke database. (${data.preservedCompleted} pertemuan terisi tetap dipertahankan, ${data.holidaysSkipped} hari libur dilewati).`
      );
      // Trigger instant UI refresh
      setRefreshTrigger((t) => t + 1);

      // Auto dismiss success toast after 6 seconds
      setTimeout(() => {
        setScheduleSuccessMessage(null);
      }, 6000);
    } catch (err: any) {
      console.error('Error generating meetings:', err);
      setScheduleErrorMessage(err?.message || 'Terjadi kesalahan saat menyimpan jadwal.');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner & Title */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <CalendarCheck2 className="w-4 h-4" />
            <span>Presensi Terpadu & Jurnal Harian</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Kalender Presensi KBM
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Kelola kehadiran santri dan ustadz per sesi pelajaran secara langsung dengan basis data independen.
          </p>
        </div>

        {/* Quick Month Metrics Badges */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="px-3.5 py-2 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-center">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Sesi Terjadwal</div>
            <div className="text-base font-extrabold text-amber-900">{monthMetrics.totalSess} Sesi</div>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-center">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Presensi Terisi</div>
            <div className="text-base font-extrabold text-emerald-900">
              {monthMetrics.completedSess} ({monthMetrics.pct}%)
            </div>
          </div>

          {onNavigateToEnrollment && (
            <button
              type="button"
              onClick={onNavigateToEnrollment}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Kelola Roster &amp; Penugasan</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setRefreshTrigger((t) => t + 1)}
            className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Muat ulang data presensi"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Schedule Feedback Banner / Toast */}
      {scheduleSuccessMessage && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{scheduleSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setScheduleSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {scheduleErrorMessage && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-medium">{scheduleErrorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setScheduleErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 font-bold text-xs cursor-pointer ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Grid: Left Calendar (7 cols), Right Daily Session Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Calendar Month View (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          {/* Calendar Month Navigation Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                Kaldik Aktif
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                title="Bulan sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleTodayClick}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                title="Bulan berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#024884] text-white rounded-xl text-xs font-bold hover:bg-[#0359a3] transition-colors whitespace-nowrap shadow-2xs cursor-pointer ml-1"
                title="Jadwalkan seluruh sesi KBM berdasarkan aturan jadwal ke database"
              >
                <CalendarSync className="w-3.5 h-3.5 text-amber-400" />
                <span>Jadwalkan Pertemuan</span>
              </button>
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
                  onClick={() => setSelectedDateStr(cell.dateStr)}
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

        {/* Right: Selected Day Sessions Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            {/* Header: Selected Date Title & Class Filter */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  Sesi Terjadwal
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                  {selectedDateLabel}
                </h3>
              </div>

              {/* Class Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="all">Semua Kelas</option>
                  {(db.classes || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.section})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List of Sessions for Selected Day */}
            {loadingDayMeetings ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Clock className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
                <p className="text-xs font-medium">Memuat jadwal sesi...</p>
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="py-12 px-4 rounded-2xl bg-slate-50/70 border border-dashed border-slate-200 text-center space-y-2">
                <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">Tidak Ada Sesi KBM</div>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Tidak ada jadwal kelas aktif yang terjadwal pada tanggal ini. Periksa kalender akademik atau aturan jadwal.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMeetings.map((mtg) => {
                  const isCompleted = mtg.status === 'completed';
                  const summary = mtg.summary;

                  return (
                    <div
                      key={mtg.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCompleted
                          ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-300'
                          : 'border-slate-200 bg-white hover:border-amber-300 hover:shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {/* Badges: Time & Class */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-100 text-slate-700 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {mtg.startTime} - {mtg.endTime} ({mtg.sessionName})
                            </span>
                            <span
                              className="px-2 py-0.5 text-[11px] font-bold rounded-md border"
                              style={{
                                backgroundColor: `${mtg.classColor || '#E2E8F0'}25`,
                                borderColor: `${mtg.classColor || '#CBD5E1'}`,
                                color: '#1E293B',
                              }}
                            >
                              Kelas: {mtg.className}
                            </span>
                          </div>

                          {/* Subject & Room */}
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: mtg.subjectColor || '#3B82F6' }}
                            />
                            <span>{mtg.subjectName}</span>
                          </h4>

                          {/* Teacher & Room subtitle */}
                          <div className="text-xs text-slate-500 flex items-center gap-3 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {mtg.teacherName}
                            </span>
                            {mtg.roomName && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {mtg.roomName}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Icon */}
                        <div>
                          {isCompleted ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-xl">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Selesai</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                              Belum Diisi
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Summary Row & Action Button */}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <div className="text-xs">
                          {isCompleted ? (
                            <div className="flex items-center gap-2 text-slate-600 font-medium">
                              <span className="text-emerald-700 font-bold">{summary.hadirCount} Hadir</span>
                              {summary.izinCount > 0 && <span>· {summary.izinCount} Izin</span>}
                              {summary.sakitCount > 0 && <span>· {summary.sakitCount} Sakit</span>}
                              {summary.alpaCount > 0 && <span className="text-rose-600 font-bold">· {summary.alpaCount} Alpa</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              {summary.totalEnrolled} santri terdaftar
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveMeetingId(mtg.id)}
                          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs ${
                            isCompleted
                              ? 'text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/80'
                              : 'text-white bg-amber-500 hover:bg-amber-600'
                          }`}
                        >
                          <CalendarCheck2 className="w-3.5 h-3.5" />
                          <span>{isCompleted ? 'Ubah Presensi' : 'Isi Presensi'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Roll-Call Sheet / Modal */}
      {activeMeetingId && (
        <AttendanceModal
          meetingId={activeMeetingId}
          isOpen={Boolean(activeMeetingId)}
          onClose={() => setActiveMeetingId(null)}
          onSaved={() => setRefreshTrigger((t) => t + 1)}
        />
      )}

      {/* Modal Konfirmasi Penjadwalan Pertemuan Minimalis */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#024884]/10 text-[#024884] flex items-center justify-center">
                  <CalendarSync className="w-5 h-5 text-[#024884]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    Jadwalkan Pertemuan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sinkronisasi seluruh aturan KBM ke basis data
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body: Ringkasan Perubahan */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Sistem akan memetakan seluruh aturan jadwal aktif ke tabel pertemuan (
                <code className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-mono">
                  attnd_meeting
                </code>
                ) untuk tahun ajaran aktif.
              </p>

              {/* Minimal Changes Summary Card */}
              <div className="space-y-2.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-xs">
                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-slate-500">Aturan Jadwal Aktif:</span>
                  <span className="font-bold text-slate-900">
                    {schedulePreview.activeRulesCount} aturan
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-slate-500">Rentang Tanggal Kalender:</span>
                  <span className="font-semibold text-slate-800 text-[11px]">
                    {schedulePreview.dateRangeLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-slate-500">Agenda Non-KBM / Libur Kaldik:</span>
                  <span className="font-semibold text-amber-700">
                    {schedulePreview.nonKbmCount} agenda (otomatis dilewati)
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-slate-700">
                  <span className="text-slate-500">Presensi &amp; Log Roll-Call:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Tetap terlindungi &amp; tidak tertimpa
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 bg-amber-50/70 p-3 rounded-xl border border-amber-200/60">
                <span className="font-semibold text-amber-800">Catatan Kalibrasi Guru:</span> Pengaturan urutan materi dan laju kurikulum di Jurnal tidak akan diubah atau terganggu.
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isScheduling}
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isScheduling || schedulePreview.activeRulesCount === 0}
                onClick={handleExecuteScheduling}
                className="flex items-center gap-2 px-4 py-2 bg-[#024884] hover:bg-[#0359a3] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isScheduling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Menjadwalkan...</span>
                  </>
                ) : (
                  <>
                    <CalendarSync className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mulai Penjadwalan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

