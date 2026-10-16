import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Sparkles,
  Layers,
  GraduationCap,
  BookOpen,
  CalendarDays,
  Clock,
  CheckCircle2,
  HelpCircle,
  FileSpreadsheet,
  AlertTriangle,
  Users,
  Pencil,
  Trash2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { DatabaseState, KaldikEvent, DayOfWeek, ResolvedSlot, Period } from '../../types';
import { computeResolvedSlots } from '../../utils/scheduleEngine';
import { isDateInRanges } from '../../utils/dateNormalizer';
import { computePacingProjection } from '../../utils/pacingEngine';
import { KaldikEventModal } from './KaldikEventModal';
import { KaldikModeSwitch, KaldikMode } from './KaldikModeSwitch';
import { KaldikDayMatrix } from './KaldikDayMatrix';
import { AttendancePendingStore, useAttendancePendingStore } from '../../utils/useAttendancePendingStore';
import { AttendanceModal } from '../attendance/AttendanceModal';
import { getScopedUnits } from '../../utils/pacingEngine';

interface KaldikViewProps {
  db: DatabaseState;
  onUpdateDb: React.Dispatch<React.SetStateAction<DatabaseState>>;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
  onNavigateToJournal?: (subjectId?: string, classId?: string, date?: string) => void;
  onNavigateToBooks?: (bookId?: string) => void;
  initialMode?: 'kaldik' | 'jurnal';
  pendingStore?: AttendancePendingStore;
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const INDONESIAN_DAYS = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const WEEKDAY_COLUMNS: { name: string; day: DayOfWeek; isWeekend?: boolean }[] = [
  { name: 'Senin', day: 'Monday' },
  { name: 'Selasa', day: 'Tuesday' },
  { name: 'Rabu', day: 'Wednesday' },
  { name: 'Kamis', day: 'Thursday' },
  { name: 'Jumat', day: 'Friday' },
  { name: 'Sabtu', day: 'Saturday', isWeekend: true },
  { name: 'Ahad', day: 'Sunday', isWeekend: true }
];

const DAY_NAME_MAP: Record<number, DayOfWeek> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

export const KaldikView: React.FC<KaldikViewProps> = ({
  db,
  onUpdateDb,
  isAdmin = true,
  onOpenAdminLogin,
  onNavigateToJournal,
  onNavigateToBooks,
  initialMode = 'kaldik',
  pendingStore
}) => {
  // Mode switch state: 'kaldik' | 'jurnal'
  const [mode, setMode] = useState<KaldikMode>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  const fallbackStore = useAttendancePendingStore();
  const store = pendingStore || fallbackStore;

  // Month-at-Once attendance meetings and density summary state
  const [monthMeetings, setMonthMeetings] = useState<any[]>([]);
  const [monthSummary, setMonthSummary] = useState<Record<string, any>>({});
  const [activeAttendance, setActiveAttendance] = useState<{ slot: ResolvedSlot; meeting?: any } | null>(null);

  // Calendar View State: Year and Month (0-11)
  // Default to September 2026 to match initial sample data, or current date if in range
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(8); // 8 is September (0-indexed)

  // Filters
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<KaldikEvent | null>(null);
  const [eventModalDefaultDate, setEventModalDefaultDate] = useState<string | undefined>(undefined);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    return '2026-09-16';
  });

  // Month-at-Once Fetch: single lightweight call per month change
  useEffect(() => {
    let isMounted = true;
    const fetchYear = currentYear;
    const fetchMonth = currentMonth + 1;

    Promise.all([
      fetch(`/api/attendance/month-meetings?year=${fetchYear}&month=${fetchMonth}`)
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => []),
      fetch(`/api/attendance/month-summary?year=${fetchYear}&month=${fetchMonth}`)
        .then((res) => (res.ok ? res.json() : {}))
        .catch(() => ({}))
    ]).then(([meetingsData, summaryData]) => {
      if (!isMounted) return;
      setMonthMeetings(Array.isArray(meetingsData) ? meetingsData : []);
      setMonthSummary(summaryData || {});
    });

    return () => {
      isMounted = false;
    };
  }, [currentYear, currentMonth]);

  // Index meetings by dateStr ('YYYY-MM-DD') for instant 0ms switching
  const monthMeetingsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of monthMeetings) {
      const dateKey = m.meetingDate || m.meeting_date;
      if (!dateKey) continue;
      const list = map.get(dateKey) || [];
      list.push(m);
      map.set(dateKey, list);
    }
    return map;
  }, [monthMeetings]);

  const selectedDayMeetings = useMemo(() => {
    return monthMeetingsMap.get(selectedDateStr) || [];
  }, [monthMeetingsMap, selectedDateStr]);

  // Auto-sync selectedDateStr if month or year changes and selected date is outside current month
  useEffect(() => {
    const parts = selectedDateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (y !== currentYear || m !== currentMonth) {
        setSelectedDateStr(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);
      }
    }
  }, [currentYear, currentMonth, selectedDateStr]);

  // Lookup maps for fast access
  const subjectMap = useMemo(() => new Map(db.subjects.map((s) => [s.id, s])), [db.subjects]);
  const teacherMap = useMemo(() => new Map(db.teachers.map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map(db.rooms.map((r) => [r.id, r])), [db.rooms]);
  const classMap = useMemo(() => new Map(db.classes.map((c) => [c.id, c])), [db.classes]);
  const sessionMap = useMemo(() => new Map(db.sessions.map((s) => [s.id, s])), [db.sessions]);
  const bookMap = useMemo(() => new Map((db.books || []).map((b) => [b.id, b])), [db.books]);
  const sortedSessions = useMemo(() => [...db.sessions].sort((a, b) => a.order - b.order), [db.sessions]);
  const sortedClasses = useMemo(() => {
    return [...db.classes].sort((a, b) => (a.grade || 0) - (b.grade || 0) || a.name.localeCompare(b.name));
  }, [db.classes]);

  // Compute resolved slots for class timetable rules
  const allResolvedSlots = useMemo(() => {
    return computeResolvedSlots(db.rules, db.periods);
  }, [db.rules, db.periods]);

  // All events list from database
  const events = useMemo(() => {
    return db.kaldikEvents || [];
  }, [db.kaldikEvents]);

  // Navigation handlers
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

  const handleToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Check which periods intersect with this month
  const monthStartStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthEndStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInCurrentMonth).padStart(2, '0')}`;

  const periodsInMonth = useMemo(() => {
    return db.periods.filter((p) => {
      return p.startDate <= monthEndStr && p.endDate >= monthStartStr;
    });
  }, [db.periods, monthStartStr, monthEndStr]);

  // Generate calendar grid days for this month (starting on Monday)
  const calendarDays = useMemo(() => {
    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      dayOfWeek: DayOfWeek;
      activePeriods: Period[];
      events: KaldikEvent[];
      classSlots: ResolvedSlot[];
    }[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);

    // First day of current month
    const firstDay = new Date(currentYear, currentMonth, 1);
    // Sunday is 0, Monday is 1 ... we want Monday to be index 0
    let startDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    let leadDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    // Previous month filler days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = leadDays - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const pMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const pYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
      const dObj = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = DAY_NAME_MAP[dObj.getDay()];

      days.push({
        dateStr,
        dayNumber: pDay,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek,
        activePeriods: [],
        events: [],
        classSlots: []
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dObj = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = DAY_NAME_MAP[dObj.getDay()];

      // Filter active academic periods for this date
      const activePeriods = db.periods.filter(
        (p) => dateStr >= p.startDate && dateStr <= p.endDate
      );

      // Filter events occurring on this date
      const dayEvents = events.filter((evt) => {
        // If event type filter is active
        if (eventTypeFilter === 'kbm' && !evt.isKbm) return false;
        if (eventTypeFilter === 'holiday' && evt.type !== 'holiday') return false;
        if (eventTypeFilter === 'exam' && evt.type !== 'exam') return false;
        if (eventTypeFilter === 'activity' && evt.type !== 'activity') return false;

        // Check period filter
        if (selectedPeriodFilter !== 'all' && evt.periodId && evt.periodId !== selectedPeriodFilter) {
          return false;
        }

        // Recurring event check
        if (evt.isRecurring) {
          if (evt.daysOfWeek && evt.daysOfWeek.includes(dayOfWeek)) {
            let start = evt.startDate;
            let end = evt.endDate;
            if (evt.isKbm) {
              const livePeriod = evt.periodId ? db.periods.find((p) => p.id === evt.periodId) : undefined;
              if (livePeriod) {
                start = livePeriod.startDate;
                end = livePeriod.endDate;
              }
            }
            if (start && dateStr < start) return false;
            if (end && dateStr > end) return false;
            return true;
          }
          return false;
        }

        // Standard range check: For KBM events, look up active date range live from db.periods
        let start = evt.startDate;
        let end = evt.endDate || evt.startDate;

        if (evt.isKbm) {
          const livePeriod = evt.periodId ? db.periods.find((p) => p.id === evt.periodId) : undefined;
          if (livePeriod) {
            start = livePeriod.startDate;
            end = livePeriod.endDate;
          }
        }

        return dateStr >= start && dateStr <= end;
      });

      // Filter class slots scheduled on this weekday and period:
      // Sessions can strictly ONLY occur on dates that fall within an active date range!
      // If a date falls outside the selected period filter, classSlots MUST be empty.
      let classSlots: ResolvedSlot[] = [];

      const targetPeriod = selectedPeriodFilter !== 'all'
        ? (db.periods || []).find((p) => p.id === selectedPeriodFilter)
        : null;

      const isDateInFilter = !targetPeriod || !targetPeriod.startDate || !targetPeriod.endDate ||
        (dateStr >= targetPeriod.startDate && dateStr <= targetPeriod.endDate);

      if (isDateInFilter) {
        classSlots = allResolvedSlots.filter((slot) => {
          if (slot.day !== dayOfWeek) return false;
          if (slot.dateRanges && slot.dateRanges.length > 0) {
            return isDateInRanges(dateStr, slot.dateRanges);
          }
          return true;
        });

        // RuleId dedup step: ensure no duplicate rule slot on the same calendar date
        const seenRuleIds = new Set<string>();
        classSlots = classSlots.filter((slot) => {
          if (!slot.ruleId) return true;
          if (seenRuleIds.has(slot.ruleId)) return false;
          seenRuleIds.add(slot.ruleId);
          return true;
        });
      }

      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        dayOfWeek,
        activePeriods,
        events: dayEvents,
        classSlots
      });
    }

    // Trailing days to fill 5 or 6 rows (multiple of 7)
    const totalCurrentCount = days.length;
    const targetCount = totalCurrentCount <= 35 ? 35 : 42;
    const nextDaysNeeded = targetCount - totalCurrentCount;
    for (let n = 1; n <= nextDaysNeeded; n++) {
      const nMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nYear}-${String(nMonth + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
      const dObj = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = DAY_NAME_MAP[dObj.getDay()];

      days.push({
        dateStr,
        dayNumber: n,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek,
        activePeriods: [],
        events: [],
        classSlots: []
      });
    }

    return days;
  }, [
    currentYear,
    currentMonth,
    daysInCurrentMonth,
    db.periods,
    events,
    allResolvedSlots,
    selectedPeriodFilter,
    eventTypeFilter
  ]);

  // Handle Event Saving
  const handleSaveEvent = (savedEvent: KaldikEvent) => {
    onUpdateDb((prev) => {
      const currentList = prev.kaldikEvents || [];
      const existsIndex = currentList.findIndex((e) => e.id === savedEvent.id);
      let nextEvents: KaldikEvent[];
      if (existsIndex >= 0) {
        nextEvents = currentList.map((e) => (e.id === savedEvent.id ? savedEvent : e));
      } else {
        nextEvents = [savedEvent, ...currentList];
      }
      return {
        ...prev,
        kaldikEvents: nextEvents
      };
    });
  };

  // Handle Event Deleting
  const handleDeleteEvent = (id: string) => {
    onUpdateDb((prev) => ({
      ...prev,
      kaldikEvents: (prev.kaldikEvents || []).filter((e) => e.id !== id)
    }));
  };

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    let kbmDaysCount = 0;
    let holidayCount = 0;
    let examCount = 0;
    let totalSessions = 0;

    for (const d of calendarDays) {
      if (!d.isCurrentMonth) continue;
      if (d.activePeriods.length > 0 || d.events.some((e) => e.isKbm)) {
        kbmDaysCount++;
      }
      if (d.events.some((e) => e.type === 'holiday')) {
        holidayCount++;
      }
      if (d.events.some((e) => e.type === 'exam')) {
        examCount++;
      }
      totalSessions += d.classSlots.length;
    }

    return {
      kbmDaysCount,
      holidayCount,
      examCount,
      totalSessions
    };
  }, [calendarDays]);

  // Selected Day data for persistent view below calendar
  const selectedDayData = useMemo(() => {
    const found = calendarDays.find((d) => d.dateStr === selectedDateStr && d.isCurrentMonth);
    if (found) return found;
    return calendarDays.find((d) => d.isCurrentMonth) || null;
  }, [selectedDateStr, calendarDays]);

  const sortedDaySlots = useMemo(() => {
    if (!selectedDayData) return [];
    return [...selectedDayData.classSlots].sort((a, b) => {
      const sesA = sessionMap.get(a.sessionId)?.order ?? 99;
      const sesB = sessionMap.get(b.sessionId)?.order ?? 99;
      if (sesA !== sesB) return sesA - sesB;
      const clsA = classMap.get(a.classId)?.name || '';
      const clsB = classMap.get(b.classId)?.name || '';
      return clsA.localeCompare(clsB);
    });
  }, [selectedDayData, sessionMap, classMap]);

  // Precompute pacing projection for each subject + class present in the selected day
  const dayPacingMap = useMemo(() => {
    if (!selectedDayData) return new Map<string, ReturnType<typeof computePacingProjection>>();
    const map = new Map<string, ReturnType<typeof computePacingProjection>>();
    for (const slot of selectedDayData.classSlots) {
      const key = `${slot.subjectId}_${slot.classId}`;
      if (!map.has(key)) {
        map.set(key, computePacingProjection(db, slot.subjectId, slot.classId));
      }
    }
    return map;
  }, [db, selectedDayData]);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDayData) return '';
    const [yStr, mStr, dStr] = selectedDayData.dateStr.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;
    const d = parseInt(dStr, 10);
    const dateObj = new Date(y, m, d);
    const dayName = INDONESIAN_DAYS[dateObj.getDay()];
    return `${dayName}, ${d} ${INDONESIAN_MONTHS[m]} ${y}`;
  }, [selectedDayData]);

  return (
    <div className="space-y-4">
      {/* Top Header & Toolbar (Simplified & Clean) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Month Navigation & Toolbar (Simple & Compact) */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto flex-nowrap whitespace-nowrap">
            <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition-colors cursor-pointer"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center text-xs font-bold text-slate-800">
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-slate-800 px-1.5 py-1 cursor-pointer focus:outline-none hover:text-slate-900 appearance-none"
                >
                  {INDONESIAN_MONTHS.map((mName, idx) => (
                    <option key={mName} value={idx}>
                      {mName}
                    </option>
                  ))}
                </select>

                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-slate-800 pr-1.5 py-1 cursor-pointer focus:outline-none hover:text-slate-900 appearance-none"
                >
                  {[2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition-colors cursor-pointer"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              Hari Ini
            </button>

            {/* Mode Segmented Control: Kaldik | Jurnal */}
            <KaldikModeSwitch mode={mode} onChange={setMode} />
          </div>

          {/* Collapsible / Simplified Filters Field */}
          {showFilters && (
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Simplified Period Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                  <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedPeriodFilter}
                    onChange={(e) => setSelectedPeriodFilter(e.target.value)}
                    className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="all">Semua Periode</option>
                    {db.periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Simplified Event Category Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={eventTypeFilter}
                    onChange={(e) => setEventTypeFilter(e.target.value)}
                    className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="all">Semua Kategori</option>
                    <option value="kbm">Hanya KBM</option>
                    <option value="holiday">Hanya Libur</option>
                    <option value="exam">Hanya Ujian</option>
                    <option value="activity">Hanya Agenda</option>
                  </select>
                </div>

                {(selectedPeriodFilter !== 'all' || eventTypeFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPeriodFilter('all');
                      setEventTypeFilter('all');
                    }}
                    className="text-xs text-amber-700 hover:text-amber-800 underline font-medium cursor-pointer ml-1"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {mode === 'kaldik' && isAdmin && (
                <button
                  type="button"
                  id="kaldik-add-event-btn"
                  onClick={() => {
                    setEditingEvent(null);
                    setEventModalDefaultDate(
                      `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
                    );
                    setIsEventModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Event Baru</span>
                </button>
              )}
            </div>
          )}

          {/* Filter Toggle Button */}
          <span>            
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shadow-2xs ${
                showFilters || selectedPeriodFilter !== 'all' || eventTypeFilter !== 'all'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Filter Event & Agenda"
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filter</span>
              {(selectedPeriodFilter !== 'all' || eventTypeFilter !== 'all') && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          </span>
        </div>

      </div>

      {/* Main Month Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Days of Week Column Headers */}
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

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-7 divide-y divide-slate-200/70 auto-rows-fr">
          {calendarDays.map((d, index) => {
            const isWeekend = d.dayOfWeek === 'Saturday' || d.dayOfWeek === 'Sunday';
            const isKbmActive = d.activePeriods.length > 0 || d.events.some((e) => e.isKbm);
            const holidayEvent = d.events.find((e) => e.type === 'holiday');

            return (
              <div
                key={`${d.dateStr}-${index}`}
                onClick={() => {
                  if (d.isCurrentMonth) {
                    setSelectedDateStr(d.dateStr);
                  }
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
                {/* Cell Header: Day number & Quick Add */}
                <div>
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

                    {/* Quick add event button on cell hover (Kaldik mode only) */}
                    {mode === 'kaldik' && isAdmin && d.isCurrentMonth && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEvent(null);
                          setEventModalDefaultDate(d.dateStr);
                          setIsEventModalOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                        title="Tambah Event pada Tanggal Ini"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Completion / Draft status indicators (Jurnal mode only) */}
                    {mode === 'jurnal' && d.isCurrentMonth && (() => {
                      const dayM = monthMeetingsMap.get(d.dateStr) || [];
                      const dayStat = monthSummary[d.dateStr];
                      const total = dayStat?.totalSessions ?? d.classSlots.length;
                      const completed = dayStat?.completedSessions ?? dayM.filter((m: any) => store.getEffectiveStatus(m.id, m.status) === 'completed').length;
                      const hasDraft = dayM.some((m: any) => store.isMeetingDrafted(m.id));

                      if (total === 0) return null;
                      const isAllDone = completed >= total && total > 0;
                      const isPartial = completed > 0 && !isAllDone;

                      return (
                        <div className="flex items-center gap-1">
                          {hasDraft && (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ring-1 ring-white"
                              title="Ada perubahan draft belum disimpan di tanggal ini"
                            />
                          )}
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isAllDone
                                ? 'bg-emerald-500 ring-2 ring-emerald-200'
                                : isPartial
                                ? 'bg-amber-500 ring-2 ring-amber-200'
                                : 'bg-slate-300'
                            }`}
                            title={`${completed}/${total} sesi presensi terisi`}
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Event Badges */}
                  <div className="space-y-1">
                    {d.events.slice(0, 3).map((evt) => {
                      const isKbmMissingPeriod = Boolean(
                        evt.isKbm && (!evt.periodId || !db.periods.some((p) => p.id === evt.periodId))
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
                            color: isKbmMissingPeriod ? undefined : (evt.color || '#6366F1'),
                            borderLeft: isKbmMissingPeriod ? undefined : `3px solid ${evt.color || '#6366F1'}`
                          }}
                          title={
                            isKbmMissingPeriod
                              ? `${evt.title} (Peringatan: Periode tidak ditemukan atau telah dihapus)`
                              : evt.title
                          }
                        >
                          {isKbmMissingPeriod && (
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          )}
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

                {/* Bottom Day Cell Summary: Timetable Lessons Count / Jurnal Attendance Progress */}
                {d.isCurrentMonth && (
                  <div className="pt-1.5 mt-1 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-500">
                    {holidayEvent ? (
                      <span className="text-rose-600 font-semibold truncate">Libur</span>
                    ) : mode === 'jurnal' ? (
                      (() => {
                        const dayM = monthMeetingsMap.get(d.dateStr) || [];
                        const dayStat = monthSummary[d.dateStr];
                        const total = dayStat?.totalSessions ?? d.classSlots.length;
                        const completed = dayStat?.completedSessions ?? dayM.filter((m: any) => store.getEffectiveStatus(m.id, m.status) === 'completed').length;
                        const isAllDone = completed >= total && total > 0;

                        if (total === 0) {
                          return <span className="text-slate-300">Tidak ada sesi</span>;
                        }

                        return (
                          <span
                            className={`font-semibold flex items-center gap-1 truncate ${
                              isAllDone ? 'text-emerald-700' : completed > 0 ? 'text-amber-700' : 'text-slate-600'
                            }`}
                            title={`${completed} dari ${total} sesi telah dicatat presensinya`}
                          >
                            <CheckCircle2
                              className={`w-3 h-3 shrink-0 ${
                                isAllDone ? 'text-emerald-500' : completed > 0 ? 'text-amber-500' : 'text-slate-400'
                              }`}
                            />
                            <span>{completed}/{total} Sesi</span>
                          </span>
                        );
                      })()
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

      {/* Super Compact Legend & Monthly Stats Strip */}
      <div className="bg-white rounded-xl border border-slate-200/90 px-3.5 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-slate-500">
        {/* Left: Title + Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
            Keterangan & Statistik Bulan {INDONESIAN_MONTHS[currentMonth]}:
          </span>
        </div>

        {/* Right: Monthly Stats */}
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
          <span className="font-semibold text-slate-800">{monthlyStats.kbmDaysCount} Hari KBM</span>
          <span>•</span>
          <span className="font-semibold text-rose-600">{monthlyStats.holidayCount} Hari Libur</span>
          <span>•</span>
          <span className="font-semibold text-indigo-600">{monthlyStats.totalSessions} Sesi Pelajaran</span>
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

      {/* Persistent Day Detail View (Below Legend & Stats) */}
      {selectedDayData && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Header of Persistent Day View */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex flex-col items-center justify-center font-bold shadow-xs shrink-0">
                <span className="text-[10px] uppercase font-semibold leading-tight">
                  {selectedDayData.dayNumber}
                </span>
                <span className="text-[11px] font-bold leading-none">
                  {INDONESIAN_MONTHS[currentMonth].slice(0, 3)}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Rincian Tanggal: {formattedSelectedDate}
                  </h3>
                  {selectedDayData.isToday && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      Hari Ini
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  {selectedDayData.activePeriods.length > 0 ? (
                    selectedDayData.activePeriods.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 font-semibold text-amber-800"
                      >
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>{p.name} ({p.startDate} s.d. {p.endDate})</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">Di luar rentang periode KBM aktif</span>
                  )}
                </div>
              </div>
            </div>

            {mode === 'kaldik' && isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditingEvent(null);
                  setEventModalDefaultDate(selectedDayData.dateStr);
                  setIsEventModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Event Tanggal Ini</span>
              </button>
            )}
          </div>

          <div className="p-4 sm:p-5 space-y-6">
            {/* 1. Agenda & Event Kaldik Section (Kaldik mode only) */}
            {mode === 'kaldik' && (
              <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-amber-600" />
                  <span>Agenda &amp; Event Kaldik ({selectedDayData.events.length})</span>
                </h4>
              </div>

              {selectedDayData.events.length === 0 ? (
                <div className="p-3.5 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium">
                    Tidak ada agenda atau event khusus pada tanggal ini.
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEvent(null);
                        setEventModalDefaultDate(selectedDayData.dateStr);
                        setIsEventModalOpen(true);
                      }}
                      className="mt-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                    >
                      + Tambahkan Event Baru
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayData.events.map((evt) => {
                    const isKbmMissingPeriod = Boolean(
                      evt.isKbm && (!evt.periodId || !db.periods.some((p) => p.id === evt.periodId))
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
                              onClick={() => {
                                setEditingEvent(evt);
                                setIsEventModalOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit Event"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(evt.id)}
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
            )}

            {/* Mode Jurnal: Matriks Kelas & Materi Silabus (KaldikDayMatrix) */}
            {mode === 'jurnal' && (
              <KaldikDayMatrix
                db={db}
                selectedDayData={selectedDayData}
                formattedSelectedDate={formattedSelectedDate}
                sortedClasses={sortedClasses}
                sortedSessions={sortedSessions}
                sortedDaySlots={sortedDaySlots}
                subjectMap={subjectMap}
                teacherMap={teacherMap}
                roomMap={roomMap}
                classMap={classMap}
                sessionMap={sessionMap}
                bookMap={bookMap}
                dayPacingMap={dayPacingMap}
                onNavigateToBooks={onNavigateToBooks}
                onNavigateToJournal={onNavigateToJournal}
                meetingsForDay={selectedDayMeetings}
                getEffectiveStatus={store.getEffectiveStatus}
                isMeetingDrafted={store.isMeetingDrafted}
                onToggleSessionStatus={(meetingId, currentStatus) => {
                  const next = currentStatus === 'cancelled' ? 'scheduled' : 'cancelled';
                  store.setSessionStatusDraft(meetingId, next);
                }}
                onOpenAttendanceModal={(slot, meeting) => {
                  setActiveAttendance({ slot, meeting });
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Attendance Roll-Call Modal (when clicked from matrix cell or list) */}
      {activeAttendance && (
        (() => {
          const slot = activeAttendance.slot;
          const meeting = activeAttendance.meeting;
          const meetingId = meeting?.id || `mtg-${selectedDayData.dateStr}-${slot.classId}-${slot.sessionId}`;
          const scopedUnits = getScopedUnits(db, slot.subjectId, slot.classId);
          const projection = dayPacingMap.get(`${slot.subjectId}_${slot.classId}`) || [];
          const matchedSession = projection.find(
            (p) =>
              p.session.date === selectedDayData.dateStr &&
              (p.session.sessionId === slot.sessionId || p.session.ruleId === slot.ruleId)
          );
          const scheduledUnits = matchedSession ? matchedSession.units : [];
          const titles = scheduledUnits.map((u: any) => u.title).join(', ');
          const firstUnit = scheduledUnits[0];
          const lastUnit = scheduledUnits[scheduledUnits.length - 1];
          const maxPage = lastUnit?.page_end ?? lastUnit?.page_start;

          return (
            <AttendanceModal
              meetingId={meetingId}
              isOpen={Boolean(activeAttendance)}
              onClose={() => setActiveAttendance(null)}
              onSaved={() => {
                setActiveAttendance(null);
              }}
              initialDraft={store.getRollCallDraft(meetingId) as any}
              onSaveDraft={(payload) => {
                store.setRollCallDraft(meetingId, payload);
              }}
              targetMateri={titles || undefined}
              targetHal={typeof maxPage === 'number' ? maxPage : parseInt(String(maxPage), 10) || undefined}
              targetUnitId={firstUnit?.id}
              availableUnits={scopedUnits}
            />
          );
        })()
      )}

      {/* Event Add/Edit Modal (Only in Kaldik mode) */}
      {mode === 'kaldik' && (
        <KaldikEventModal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          initialEvent={editingEvent}
          defaultDate={eventModalDefaultDate}
          periods={db.periods}
        />
      )}
    </div>
  );
};
