import React, { useState, useMemo, useEffect } from 'react';
import type { DatabaseState, KaldikEvent, ResolvedSlot } from '../../types';
import { computeResolvedSlots } from '../../utils/scheduleEngine';
import { computePacingProjection, getScopedUnits } from '../../utils/pacingEngine';
import { toLocalDateStr, buildMeetingId, resolveSlotUnits } from '../../utils/kaldikHelpers';
import {
  buildCalendarDays,
  computeMonthlyStats,
  getMonthBounds,
  INDONESIAN_DAYS,
  INDONESIAN_MONTHS
} from '../../utils/kaldikCalendar';
import {
  useAttendancePendingStore,
  type AttendancePendingStore
} from '../../utils/useAttendancePendingStore';
import { useMonthMeetings } from '../../hooks/useMonthMeetings';
import { AttendanceModal } from '../attendance/AttendanceModal';
import { KaldikEventModal } from './KaldikEventModal';
import type { KaldikMode } from './KaldikModeSwitch';
import { KaldikDayMatrix } from './KaldikDayMatrix';
import { KaldikToolbar } from './KaldikToolbar';
import { KaldikMonthGrid } from './KaldikMonthGrid';
import { KaldikLegendStrip } from './KaldikLegendStrip';
import { KaldikDayPanel } from './KaldikDayPanel';
import { KaldikDayAgenda } from './KaldikDayAgenda';

interface KaldikViewProps {
  db: DatabaseState;
  onUpdateDb: React.Dispatch<React.SetStateAction<DatabaseState>>;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
  onNavigateToJournal?: (subjectId?: string, classId?: string, date?: string) => void;
  onNavigateToBooks?: (bookId?: string) => void;
  initialMode?: KaldikMode;
  pendingStore?: AttendancePendingStore;
}

export const KaldikView: React.FC<KaldikViewProps> = ({
  db,
  onUpdateDb,
  isAdmin = false,
  onNavigateToJournal,
  onNavigateToBooks,
  initialMode = 'kaldik',
  pendingStore
}) => {
  const [mode, setMode] = useState<KaldikMode>(initialMode);
  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  const fallbackStore = useAttendancePendingStore();
  const store = pendingStore || fallbackStore;

  // Calendar position (defaults to today, local time)
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth()); // 0-11
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => toLocalDateStr(new Date()));

  // Filters
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<KaldikEvent | null>(null);
  const [eventModalDefaultDate, setEventModalDefaultDate] = useState<string | undefined>(undefined);
  const [activeAttendance, setActiveAttendance] = useState<{ slot: ResolvedSlot; meeting?: any } | null>(null);

  const { monthMeetingsMap, monthSummary } = useMonthMeetings(currentYear, currentMonth + 1);

  const selectedDayMeetings = useMemo(
    () => monthMeetingsMap.get(selectedDateStr) || [],
    [monthMeetingsMap, selectedDateStr]
  );

  // Keep the selected date inside the visible month
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

  // Lookup maps
  const subjectMap = useMemo(() => new Map(db.subjects.map((s) => [s.id, s])), [db.subjects]);
  const teacherMap = useMemo(() => new Map(db.teachers.map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map(db.rooms.map((r) => [r.id, r])), [db.rooms]);
  const classMap = useMemo(() => new Map(db.classes.map((c) => [c.id, c])), [db.classes]);
  const sessionMap = useMemo(() => new Map(db.sessions.map((s) => [s.id, s])), [db.sessions]);
  const bookMap = useMemo(() => new Map((db.books || []).map((b) => [b.id, b])), [db.books]);
  const sortedSessions = useMemo(() => [...db.sessions].sort((a, b) => a.order - b.order), [db.sessions]);
  const sortedClasses = useMemo(
    () =>
      [...db.classes].sort(
        (a, b) => (a.grade || 0) - (b.grade || 0) || a.name.localeCompare(b.name)
      ),
    [db.classes]
  );

  const allResolvedSlots = useMemo(
    () => computeResolvedSlots(db.rules, db.periods),
    [db.rules, db.periods]
  );
  const events = useMemo(() => db.kaldikEvents || [], [db.kaldikEvents]);

  const { startStr: monthStartStr, endStr: monthEndStr } = getMonthBounds(currentYear, currentMonth);
  const periodsInMonth = useMemo(
    () => db.periods.filter((p) => p.startDate <= monthEndStr && p.endDate >= monthStartStr),
    [db.periods, monthStartStr, monthEndStr]
  );

  const calendarDays = useMemo(
    () =>
      buildCalendarDays({
        year: currentYear,
        month: currentMonth,
        periods: db.periods,
        events,
        slots: allResolvedSlots,
        filters: { selectedPeriodFilter, eventTypeFilter },
        todayStr: toLocalDateStr(new Date())
      }),
    [currentYear, currentMonth, db.periods, events, allResolvedSlots, selectedPeriodFilter, eventTypeFilter]
  );

  const monthlyStats = useMemo(() => computeMonthlyStats(calendarDays), [calendarDays]);

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

  const dayPacingMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computePacingProjection>>();
    if (!selectedDayData) return map;
    for (const slot of selectedDayData.classSlots) {
      const key = `${slot.subjectId}_${slot.classId}`;
      if (!map.has(key)) map.set(key, computePacingProjection(db, slot.subjectId, slot.classId));
    }
    return map;
  }, [db, selectedDayData]);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDayData) return '';
    const [yStr, mStr, dStr] = selectedDayData.dateStr.split('-');
    const dateObj = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10));
    return `${INDONESIAN_DAYS[dateObj.getDay()]}, ${parseInt(dStr, 10)} ${INDONESIAN_MONTHS[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  }, [selectedDayData]);

  // Navigation
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

  // Event modal helpers
  const openEventModal = (defaultDate: string | undefined, evt: KaldikEvent | null = null) => {
    setEditingEvent(evt);
    setEventModalDefaultDate(defaultDate);
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = (savedEvent: KaldikEvent) => {
    onUpdateDb((prev) => {
      const currentList = prev.kaldikEvents || [];
      const exists = currentList.some((e) => e.id === savedEvent.id);
      const nextEvents = exists
        ? currentList.map((e) => (e.id === savedEvent.id ? savedEvent : e))
        : [savedEvent, ...currentList];
      return { ...prev, kaldikEvents: nextEvents };
    });
  };

  const handleDeleteEvent = (id: string) => {
    onUpdateDb((prev) => ({
      ...prev,
      kaldikEvents: (prev.kaldikEvents || []).filter((e) => e.id !== id)
    }));
  };

  const showKaldikAdmin = mode === 'kaldik' && isAdmin;

  return (
    <div className="space-y-4">
      <KaldikToolbar
        currentYear={currentYear}
        currentMonth={currentMonth}
        mode={mode}
        onModeChange={setMode}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
        onMonthChange={setCurrentMonth}
        onYearChange={setCurrentYear}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
        selectedPeriodFilter={selectedPeriodFilter}
        onPeriodFilterChange={setSelectedPeriodFilter}
        eventTypeFilter={eventTypeFilter}
        onEventTypeFilterChange={setEventTypeFilter}
        onResetFilters={() => {
          setSelectedPeriodFilter('all');
          setEventTypeFilter('all');
        }}
        periods={db.periods}
        showAddEvent={showKaldikAdmin}
        onAddEvent={() =>
          openEventModal(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
        }
      />

      <KaldikMonthGrid
        days={calendarDays}
        mode={mode}
        isAdmin={isAdmin}
        periods={db.periods}
        selectedDateStr={selectedDateStr}
        onSelectDate={setSelectedDateStr}
        onQuickAddEvent={(dateStr) => openEventModal(dateStr)}
        monthMeetingsMap={monthMeetingsMap}
        monthSummary={monthSummary}
        store={store}
      />

      <KaldikLegendStrip
        monthName={INDONESIAN_MONTHS[currentMonth]}
        stats={monthlyStats}
        periodsInMonth={periodsInMonth}
      />

      {selectedDayData && (
        <KaldikDayPanel
          dayNumber={selectedDayData.dayNumber}
          monthAbbr={INDONESIAN_MONTHS[currentMonth].slice(0, 3)}
          formattedDate={formattedSelectedDate}
          isToday={selectedDayData.isToday}
          activePeriods={selectedDayData.activePeriods}
          showAddEvent={showKaldikAdmin}
          onAddEvent={() => openEventModal(selectedDayData.dateStr)}
        >
          {mode === 'kaldik' ? (
            <KaldikDayAgenda
              events={selectedDayData.events}
              periods={db.periods}
              isAdmin={isAdmin}
              onAddEvent={() => openEventModal(selectedDayData.dateStr)}
              onEditEvent={(evt) => openEventModal(selectedDayData.dateStr, evt)}
              onDeleteEvent={handleDeleteEvent}
            />
          ) : (
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
              onOpenAttendanceModal={(slot, meeting) => setActiveAttendance({ slot, meeting })}
            />
          )}
        </KaldikDayPanel>
      )}

      {/* Attendance roll-call modal */}
      {activeAttendance && (() => {
        const { slot, meeting } = activeAttendance;
        const dateStr = selectedDayData?.dateStr ?? '';
        const meetingId = buildMeetingId(dateStr, slot.classId, slot.sessionId, meeting?.id);
        const { units } = resolveSlotUnits(db, slot, dateStr, dayPacingMap);
        const titles = units.map((u) => u.title).join(', ');
        const lastUnit = units[units.length - 1];
        const maxPage = lastUnit?.page_end ?? lastUnit?.page_start;

        return (
          <AttendanceModal
            meetingId={meetingId}
            isOpen={true}
            onClose={() => setActiveAttendance(null)}
            onSaved={() => setActiveAttendance(null)}
            initialDraft={store.getRollCallDraft(meetingId)}
            onSaveDraft={(payload) => store.setRollCallDraft(meetingId, payload)}
            targetMateri={titles || undefined}
            targetHal={typeof maxPage === 'number' ? maxPage : parseInt(String(maxPage), 10) || undefined}
            targetUnitId={units[0]?.id}
            availableUnits={getScopedUnits(db, slot.subjectId, slot.classId)}
          />
        );
      })()}

      {/* Event add/edit modal (Kaldik mode only) */}
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
