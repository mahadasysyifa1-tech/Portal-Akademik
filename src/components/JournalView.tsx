import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type {
  DatabaseState,
  AttendanceMeetingSummary,
  DayOfWeek
} from '../types';
import { AttendanceModal } from './attendance/AttendanceModal';
import {
  JournalCalendar,
  CalendarDayCell,
  DayAttendanceStat,
  MONTH_NAMES
} from './attendance/JournalCalendar';
import {
  JournalMeetingsAgenda,
  MeetingTargetInfo
} from './attendance/JournalMeetingsAgenda';
import {
  JournalScheduleModal,
  SchedulePreviewData
} from './attendance/JournalScheduleModal';
import { computePacingProjection, getScopedUnits } from '../utils/pacingEngine';

export type ViewerRole = 'student' | 'teacher' | 'admin';

export interface JournalViewProps {
  db: DatabaseState;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
  viewerRole?: ViewerRole;
  setViewerRole?: (role: ViewerRole) => void;
  viewerId?: string;
  setViewerId?: (id: string) => void;
  initialDate?: string;
  initialClassId?: string;
  initialSessionId?: string;
  initialSubjectId?: string;
  highlightDate?: string;
  onClearInitialDeepLink?: () => void;
  onClearDeepLink?: () => void;
  onNavigateToEnrollment?: () => void;
  onNavigateToRuleManager?: () => void;
  onNavigateToBooks?: (bookId?: string) => void;
  onNavigateToSyllabusScope?: (subjectId?: string, classId?: string) => void;
  onNavigateToSyllabus?: (subjectId?: string, classId?: string) => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  db,
  isAdmin = false,
  onOpenAdminLogin,
  viewerRole,
  setViewerRole,
  viewerId,
  setViewerId,
  initialDate,
  initialClassId,
  initialSessionId,
  initialSubjectId,
  highlightDate,
  onClearInitialDeepLink,
  onClearDeepLink,
  onNavigateToEnrollment,
  onNavigateToRuleManager,
  onNavigateToBooks,
  onNavigateToSyllabusScope,
  onNavigateToSyllabus
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
    if (initialDate) return initialDate;
    if (highlightDate) return highlightDate;
    return todayStr;
  });

  // Filters & Selected State
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || 'all');
  const [activeMeeting, setActiveMeeting] = useState<AttendanceMeetingSummary | null>(null);

  // Month attendance summary record: { "YYYY-MM-DD": { totalSessions, completedSessions, hadirStudents, absentStudents } }
  const [monthSummary, setMonthSummary] = useState<Record<string, DayAttendanceStat>>({});
  const [dayMeetings, setDayMeetings] = useState<AttendanceMeetingSummary[]>([]);
  const [loadingDayMeetings, setLoadingDayMeetings] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // SWR-style In-Memory Cache for Day Sessions
  const daySessionsCacheRef = useRef<Map<string, AttendanceMeetingSummary[]>>(new Map());

  // Cached pacing projections for rapid card rendering
  const pacingCacheRef = useRef<Map<string, ReturnType<typeof computePacingProjection>>>(new Map());

  // Helper to retrieve target curriculum info for a meeting without recomputing entire projection
  const getTargetInfoForMeeting = (mtg: AttendanceMeetingSummary | null): MeetingTargetInfo | null => {
    if (!mtg || !mtg.subjectId || !mtg.classId) return null;

    const cacheKey = `${mtg.subjectId}_${mtg.classId}`;
    let projection = pacingCacheRef.current.get(cacheKey);
    if (!projection) {
      projection = computePacingProjection(db, mtg.subjectId, mtg.classId);
      pacingCacheRef.current.set(cacheKey, projection);
    }

    const scopedUnits = getScopedUnits(db, mtg.subjectId, mtg.classId);

    const activeMtgIdx = mtg.activeMeetingIndex ?? mtg.meetingIndex;
    let match = projection.find((p) => p.session.meetingIndex === activeMtgIdx);
    if (!match && mtg.meetingIndex) {
      match = projection.find((p) => p.session.meetingIndex === mtg.meetingIndex);
    }
    if (!match && mtg.sessionId) {
      match = projection.find((p) => p.session.id === mtg.sessionId);
    }

    if (!match || match.units.length === 0) {
      if (scopedUnits.length > 0 && activeMtgIdx) {
        const fallbackIdx = Math.min(scopedUnits.length - 1, Math.max(0, activeMtgIdx - 1));
        const u = scopedUnits[fallbackIdx];
        return {
          unitTitles: u.title,
          minPage: typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10) || undefined,
          maxPage: typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10) || undefined,
          targetUnitId: u.id,
          availableUnits: scopedUnits,
        };
      }
      return null;
    }

    const titles = match.units.map((u) => u.title).join(', ');
    const minPage = Math.min(
      ...match.units.map((u) => (typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10) || 999999))
    );
    const maxPage = Math.max(
      ...match.units.map((u) => (typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10) || 0))
    );

    return {
      unitTitles: titles,
      minPage: minPage !== 999999 ? minPage : undefined,
      maxPage: maxPage !== 0 ? maxPage : undefined,
      targetUnitId: match.units[0]?.id,
      availableUnits: scopedUnits,
    };
  };

  const handleToggleMeetingStatus = async (
    meetingId: string,
    newStatus: 'scheduled' | 'completed' | 'cancelled'
  ) => {
    try {
      // Optimistic update
      setDayMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, status: newStatus } : m))
      );
      daySessionsCacheRef.current.delete(selectedDateStr);

      const res = await fetch(`/api/attendance/meetings/${meetingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Gagal memperbarui status sesi');
      setRefreshTrigger((t) => t + 1);
    } catch (err: any) {
      console.error('Failed to toggle meeting status:', err);
      setRefreshTrigger((t) => t + 1);
    }
  };

  // Jadwalkan Pertemuan Modal & Action state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
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

        if (initialClassId && initialSessionId) {
          const match = data.find(
            (m) => m.classId === initialClassId && m.sessionId === initialSessionId
          );
          if (match) {
            setActiveMeeting(match);
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
  const calendarDays = useMemo<CalendarDayCell[]>(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: CalendarDayCell[] = [];

    // Prev month padding
    const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthLastDate - i;
      const prevDate = new Date(currentYear, currentMonth - 1, pDay);
      const y = prevDate.getFullYear();
      const m = String(prevDate.getMonth() + 1).padStart(2, '0');
      const d = String(prevDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      days.push({
        dateStr,
        dayNumber: pDay,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
      const curDate = new Date(currentYear, currentMonth, d);
      const y = curDate.getFullYear();
      const m = String(curDate.getMonth() + 1).padStart(2, '0');
      const dayPad = String(d).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayPad}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding to fill complete grid rows (multiples of 7)
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let n = 1; n <= remaining; n++) {
        const nextDate = new Date(currentYear, currentMonth + 1, n);
        const y = nextDate.getFullYear();
        const m = String(nextDate.getMonth() + 1).padStart(2, '0');
        const dayPad = String(n).padStart(2, '0');
        const dateStr = `${y}-${m}-${dayPad}`;
        days.push({
          dateStr,
          dayNumber: n,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
        });
      }
    }

    return days;
  }, [currentYear, currentMonth, todayStr]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleTodayClick = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDateStr(todayStr);
  };

  const filteredMeetings = useMemo(() => {
    if (selectedClassId === 'all') return dayMeetings;
    return dayMeetings.filter((m) => m.classId === selectedClassId);
  }, [dayMeetings, selectedClassId]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDateStr) return '';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const days = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = days[dateObj.getDay()];
    return `${dayName}, ${d} ${MONTH_NAMES[m - 1]} ${y}`;
  }, [selectedDateStr]);

  const schedulePreview = useMemo<SchedulePreviewData>(() => {
    const activeRules = (db.rules || []).filter((r) => r.active !== false);
    const periods = db.periods || [];
    const nonKbmEvents = (db.kaldikEvents || []).filter((e) => e.isKbm === false || e.type === 'holiday');
    
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

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Success / Error Notification Toast */}
      {scheduleSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{scheduleSuccessMessage}</span>
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
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span>{scheduleErrorMessage}</span>
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
        {/* Left: Calendar Month View */}
        <JournalCalendar
          currentYear={currentYear}
          currentMonth={currentMonth}
          selectedDateStr={selectedDateStr}
          onSelectDate={setSelectedDateStr}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onTodayClick={handleTodayClick}
          calendarDays={calendarDays}
          monthSummary={monthSummary}
          isAdmin={isAdmin}
          onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
          onNavigateToSyllabus={onNavigateToSyllabus ? () => onNavigateToSyllabus() : undefined}
          onNavigateToEnrollment={onNavigateToEnrollment}
          onOpenAdminLogin={onOpenAdminLogin}
        />

        {/* Right: Selected Day Sessions Panel */}
        <JournalMeetingsAgenda
          selectedDateLabel={selectedDateLabel}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          classes={db.classes || []}
          loadingDayMeetings={loadingDayMeetings}
          filteredMeetings={filteredMeetings}
          getTargetInfoForMeeting={getTargetInfoForMeeting}
          onToggleMeetingStatus={handleToggleMeetingStatus}
          onOpenAttendanceModal={(mtg) => setActiveMeeting(mtg)}
          onNavigateToSyllabusScope={onNavigateToSyllabusScope}
          onNavigateToRuleManager={onNavigateToRuleManager}
        />
      </div>

      {/* Roll-Call Sheet / Attendance Modal with Minimal Material Progress */}
      {activeMeeting && (
        <AttendanceModal
          meetingId={activeMeeting.id}
          isOpen={Boolean(activeMeeting)}
          onClose={() => setActiveMeeting(null)}
          onSaved={() => {
            setActiveMeeting(null);
            setRefreshTrigger((t) => t + 1);
          }}
          targetMateri={getTargetInfoForMeeting(activeMeeting)?.unitTitles}
          targetHal={getTargetInfoForMeeting(activeMeeting)?.maxPage}
          targetUnitId={getTargetInfoForMeeting(activeMeeting)?.targetUnitId}
          availableUnits={getTargetInfoForMeeting(activeMeeting)?.availableUnits}
        />
      )}

      {/* Modal Konfirmasi Penjadwalan Pertemuan Minimalis (Admin Only) */}
      {isAdmin && isScheduleModalOpen && (
        <JournalScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSuccess={(msg) => {
            setScheduleSuccessMessage(msg);
            setTimeout(() => setScheduleSuccessMessage(null), 6000);
          }}
          onError={(err) => setScheduleErrorMessage(err)}
          schedulePreview={schedulePreview}
          onTriggerRefresh={() => setRefreshTrigger((t) => t + 1)}
        />
      )}
    </div>
  );
};
