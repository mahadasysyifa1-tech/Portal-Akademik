import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, CalendarCheck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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
import { KaldikDayAgenda } from './KaldikDayAgenda';
import { useAuth } from '../../context/AuthContext';


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
  const auth = useAuth();
  const effectiveIsAdmin = isAdmin || auth.isAdmin;
  const [mode, setMode] = useState<KaldikMode>(initialMode);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  const fallbackStore = useAttendancePendingStore();
  const store = pendingStore || fallbackStore;

  // Calendar position (defaults to today, local time)
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth()); // 0-11
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');

  // Filters
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<KaldikEvent | null>(null);
  const [eventModalDefaultDate, setEventModalDefaultDate] = useState<string | undefined>(undefined);
  const [activeAttendance, setActiveAttendance] = useState<{ slot: ResolvedSlot; meeting?: any } | null>(null);

  // Jadwalkan Pertemuan (Generate All Meetings) states
  const [isGenerateConfirmOpen, setIsGenerateConfirmOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{
    success: boolean;
    totalUpserted?: number;
    preservedCompleted?: number;
    holidaysSkipped?: number;
    message?: string;
  } | null>(null);

  const handleConfirmGenerateMeetings = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/attendance/generate-all-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || 'Gagal menjadwalkan pertemuan');
      }
      const data = await res.json();
      setIsGenerateConfirmOpen(false);
      setGenerateResult({
        success: true,
        totalUpserted: data.totalUpserted || 0,
        preservedCompleted: data.preservedCompleted || 0,
        holidaysSkipped: data.holidaysSkipped || 0,
      });
      // Global broadcast to refresh month meetings and App db.meetings
      window.dispatchEvent(new Event('attendance:saved'));
      fetch('/api/database')
        .then((r) => r.json())
        .then((fresh) => {
          if (fresh && Array.isArray(fresh.meetings)) {
            onUpdateDb((prev) => ({ ...prev, meetings: fresh.meetings }));
          }
        })
        .catch(() => {});
    } catch (err: any) {
      setGenerateResult({
        success: false,
        message: err.message || 'Terjadi kesalahan saat menjadwalkan pertemuan',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const { monthMeetingsMap } = useMonthMeetings(currentYear, currentMonth + 1);

  const selectedDayMeetings = useMemo(
    () => monthMeetingsMap.get(selectedDateStr) || [],
    [monthMeetingsMap, selectedDateStr]
  );

  const handleSelectDate = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (!isNaN(y) && !isNaN(m)) {
        if (y !== currentYear) setCurrentYear(y);
        if (m !== currentMonth) setCurrentMonth(m);
      }
    }
  };

  // Lookup maps for fast access
  const subjectMap = useMemo(() => new Map(db.subjects.map((s) => [s.id, s])), [db.subjects]);
  const teacherMap = useMemo(() => new Map(db.teachers.map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map(db.rooms.map((r) => [r.id, r])), [db.rooms]);
  const classMap = useMemo(() => new Map(db.classes.map((c) => [c.id, c])), [db.classes]);
  const sessionMap = useMemo(() => new Map(db.sessions.map((s) => [s.id, s])), [db.sessions]);
  const bookMap = useMemo(() => new Map((db.books || []).map((b) => [b.id, b])), [db.books]);
  const sortedSessions = useMemo(
    () => [...db.sessions].sort((a, b) => a.order - b.order),
    [db.sessions]
  );
  const sortedClasses = useMemo(() => {
    return [...db.classes].sort(
      (a, b) => (a.grade || 0) - (b.grade || 0) || a.name.localeCompare(b.name)
    );
  }, [db.classes]);

  // Timetable slots & active periods
  const allResolvedSlots = useMemo(
    () => computeResolvedSlots(db.rules, db.periods),
    [db.rules, db.periods]
  );

  const periodsInMonth = useMemo(() => {
    const { startStr, endStr } = getMonthBounds(currentYear, currentMonth);
    return db.periods.filter((p) => p.startDate <= endStr && p.endDate >= startStr);
  }, [db.periods, currentYear, currentMonth]);

  // Pure calendar days for the visible month
  const calendarDays = useMemo(
    () =>
      buildCalendarDays({
        year: currentYear,
        month: currentMonth,
        periods: db.periods,
        events: db.kaldikEvents || [],
        slots: allResolvedSlots,
        filters: {
          selectedPeriodFilter,
          eventTypeFilter
        },
        todayStr: toLocalDateStr(new Date())
      }),
    [
      currentYear,
      currentMonth,
      db.periods,
      db.kaldikEvents,
      allResolvedSlots,
      selectedPeriodFilter,
      eventTypeFilter
    ]
  );

  // In Jurnal mode, swap resolved timetable slots for actual meetings
  const jurnalDays = useMemo(() => {
    if (mode !== 'jurnal') return calendarDays;
    return calendarDays.map((d) => {
      const meetings = monthMeetingsMap.get(d.dateStr) || [];
      const classSlots = meetings.map((m: any) => ({
        dateStr: d.dateStr,
        classId: m.classId,
        sessionId: m.sessionId,
        subjectId: m.subjectId,
        teacherId: m.teacherId || '',
        roomId: m.roomId || '',
        ruleId: m.id,
        hasException: false,
      }));
      return { ...d, classSlots };
    });
  }, [mode, calendarDays, monthMeetingsMap]);

  const monthlyStats = useMemo(() => computeMonthlyStats(jurnalDays), [jurnalDays]);

  const selectedDayData = useMemo(() => {
    if (!selectedDateStr) return null;
    return jurnalDays.find((d) => d.dateStr === selectedDateStr) || null;
  }, [selectedDateStr, jurnalDays]);

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

  // Keep active attendance modal in sync when the selected day changes in KaldikMonthGrid
  useEffect(() => {
    if (!activeAttendance || !selectedDayData) return;
    const daySlots = selectedDayData.classSlots || [];
    if (daySlots.length === 0) return;

    // 1. Exact match for session and class
    const exactMatch = daySlots.find(
      (s) => s.classId === activeAttendance.slot.classId && s.sessionId === activeAttendance.slot.sessionId
    );
    if (exactMatch) {
      const nextMeeting = (monthMeetingsMap.get(selectedDayData.dateStr) || []).find(
        (m) => m.sessionId === exactMatch.sessionId && m.classId === exactMatch.classId
      );
      if (
        activeAttendance.slot !== exactMatch ||
        activeAttendance.meeting !== nextMeeting
      ) {
        setActiveAttendance({ slot: exactMatch, meeting: nextMeeting });
      }
      return;
    }

    // 2. Class match
    const classMatch = daySlots.find((s) => s.classId === activeAttendance.slot.classId);
    if (classMatch) {
      const nextMeeting = (monthMeetingsMap.get(selectedDayData.dateStr) || []).find(
        (m) => m.sessionId === classMatch.sessionId && m.classId === classMatch.classId
      );
      setActiveAttendance({ slot: classMatch, meeting: nextMeeting });
      return;
    }

    // 3. Session match
    const sessionMatch = daySlots.find((s) => s.sessionId === activeAttendance.slot.sessionId);
    if (sessionMatch) {
      const nextMeeting = (monthMeetingsMap.get(selectedDayData.dateStr) || []).find(
        (m) => m.sessionId === sessionMatch.sessionId && m.classId === sessionMatch.classId
      );
      setActiveAttendance({ slot: sessionMatch, meeting: nextMeeting });
      return;
    }

    // 4. Fallback to first slot of the day
    const firstSlot = daySlots[0];
    const nextMeeting = (monthMeetingsMap.get(selectedDayData.dateStr) || []).find(
      (m) => m.sessionId === firstSlot.sessionId && m.classId === firstSlot.classId
    );
    setActiveAttendance({ slot: firstSlot, meeting: nextMeeting });
  }, [selectedDayData?.dateStr, monthMeetingsMap]);

  // If day selection is cleared, close any open attendance drawer
  useEffect(() => {
    if (!selectedDayData && activeAttendance) {
      setActiveAttendance(null);
    }
  }, [selectedDayData, activeAttendance]);

  // Navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      const newYear = currentYear - 1;
      setCurrentMonth(11);
      setCurrentYear(newYear);
      if (selectedDateStr) {
        setSelectedDateStr(`${newYear}-12-01`);
      }
    } else {
      const newMonth = currentMonth - 1;
      setCurrentMonth(newMonth);
      if (selectedDateStr) {
        setSelectedDateStr(`${currentYear}-${String(newMonth + 1).padStart(2, '0')}-01`);
      }
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      const newYear = currentYear + 1;
      setCurrentMonth(0);
      setCurrentYear(newYear);
      if (selectedDateStr) {
        setSelectedDateStr(`${newYear}-01-01`);
      }
    } else {
      const newMonth = currentMonth + 1;
      setCurrentMonth(newMonth);
      if (selectedDateStr) {
        setSelectedDateStr(`${currentYear}-${String(newMonth + 1).padStart(2, '0')}-01`);
      }
    }
  };

  const handleMonthChange = (m: number) => {
    setCurrentMonth(m);
    if (selectedDateStr) {
      setSelectedDateStr(`${currentYear}-${String(m + 1).padStart(2, '0')}-01`);
    }
  };

  const handleYearChange = (y: number) => {
    setCurrentYear(y);
    if (selectedDateStr) {
      setSelectedDateStr(`${y}-${String(currentMonth + 1).padStart(2, '0')}-01`);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDateStr(toLocalDateStr(today));
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

  const setStatusOrClear = (meetingId: string, nextStatus: 'scheduled' | 'cancelled') => {
    const baseline = selectedDayMeetings.find((m) => m.id === meetingId)?.status ?? 'scheduled';
    if (baseline === nextStatus) {
      store.discardDraft(meetingId);
    } else {
      store.setSessionStatusDraft(meetingId, nextStatus);
    }
  };

  const showKaldikAdmin = effectiveIsAdmin && mode === 'kaldik';

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* Top Toolbar (Month nav & filters, sticky floating)           */}
      {/* ------------------------------------------------------------- */}
      <div className="sticky top-26 shadow-2xl z-20">
        <KaldikToolbar
          currentYear={currentYear}
          currentMonth={currentMonth}
          mode={mode}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
          onMonthChange={handleMonthChange}
          onYearChange={handleYearChange}
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
            openEventModal(selectedDateStr || `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
          }
          showGenerateMeetings={effectiveIsAdmin && mode === 'jurnal'}
          onGenerateMeetings={() => setIsGenerateConfirmOpen(true)}
        />
      </div>


      {/* ------------------------------------------------------------- */}
      {/* Symmetrical Split-Pane Layout: 38% Left / 62% Right           */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Calendar Grid & Legend (38% on Desktop) */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-4">
          <KaldikMonthGrid
            days={jurnalDays}
            mode={mode}
            isAdmin={isAdmin}
            periods={db.periods}
            selectedDateStr={selectedDateStr}
            onSelectDate={handleSelectDate}
            onQuickAddEvent={(dateStr) => openEventModal(dateStr)}
            monthMeetingsMap={monthMeetingsMap}
            store={store}
          />

          <KaldikLegendStrip
            monthName={INDONESIAN_MONTHS[currentMonth]}
            stats={monthlyStats}
            periodsInMonth={periodsInMonth}
          />
        </div>

        {/* Right Column: Workstation Canvas (62% on Desktop, Zero Day Header) */}
        <div className="lg:col-span-7">
          {selectedDayData ? (
            mode === 'kaldik' ? (
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
                isAdmin={isAdmin}
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
                onToggleSessionStatus={(meetingId, currentStatus) =>
                  setStatusOrClear(meetingId, currentStatus === 'cancelled' ? 'scheduled' : 'cancelled')
                }
                onDiscardSessionDraft={(meetingId) => store.discardDraft(meetingId)}
                onOpenAttendanceModal={(slot, meeting) => setActiveAttendance({ slot, meeting })}
              />
            )
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-medium">
                Pilih tanggal pada kalender untuk melihat rincian {mode === 'kaldik' ? 'agenda' : 'jadwal KBM'}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Slide-Over Attendance Drawer                                  */}
      {/* ------------------------------------------------------------- */}
      {activeAttendance && (() => {
        const { slot } = activeAttendance;
        const dateStr = selectedDayData?.dateStr ?? '';
        const dayMeeting = selectedDayMeetings.find(
          (m) => m.sessionId === slot.sessionId && m.classId === slot.classId
        );
        const meetingId = buildMeetingId(dateStr, slot.classId, slot.sessionId, dayMeeting?.id);
        const scopedUnits = getScopedUnits(db, slot.subjectId, slot.classId);
        const { units } = resolveSlotUnits(db, slot, dateStr, dayPacingMap);
        const titles = units.map((u) => u.title).join(', ');
        const lastUnit = units[units.length - 1] || scopedUnits[0];
        const maxPage = lastUnit?.page_end ?? lastUnit?.page_start;
        const targetPage = typeof maxPage === 'number' ? maxPage : parseInt(String(maxPage), 10) || undefined;

        // Current slot index for Prev / Next session navigation
        const currentSlotIdx = sortedDaySlots.findIndex(
          (s) => s.sessionId === slot.sessionId && s.classId === slot.classId
        );
        const hasPrevSession = currentSlotIdx > 0;
        const hasNextSession = currentSlotIdx !== -1 && currentSlotIdx < sortedDaySlots.length - 1;

        const handlePrevSession = () => {
          if (!hasPrevSession) return;
          const prevSlot = sortedDaySlots[currentSlotIdx - 1];
          const prevMeeting = selectedDayMeetings.find(
            (m) => m.sessionId === prevSlot.sessionId && m.classId === prevSlot.classId
          );
          setActiveAttendance({ slot: prevSlot, meeting: prevMeeting });
        };

        const handleNextSession = () => {
          if (!hasNextSession) return;
          const nextSlot = sortedDaySlots[currentSlotIdx + 1];
          const nextMeeting = selectedDayMeetings.find(
            (m) => m.sessionId === nextSlot.sessionId && m.classId === nextSlot.classId
          );
          setActiveAttendance({ slot: nextSlot, meeting: nextMeeting });
        };

        const sessionObj = sessionMap.get(slot.sessionId);
        const classObj = classMap.get(slot.classId);
        const canEditSlot = effectiveIsAdmin || auth.canEditSession(slot.teacherId);

        return (
          <AttendanceModal
            key={meetingId}
            isAdmin={canEditSlot}
            meetingId={meetingId}

            meetingNumber={dayMeeting?.meeting_index ?? (dayMeeting as any)?.meetingIndex}
            isOpen={true}
            onClose={() => setActiveAttendance(null)}
            onSaved={() => setActiveAttendance(null)}
            initialDraft={store.getRollCallDraft(meetingId)}
            onSaveDraft={(payload) => {
              store.setRollCallDraft(meetingId, payload);
              if (payload.materialProgress) {
                const {
                  materi: draftMateri,
                  unitId,
                  hal: draftHal,
                  startMateri: draftStartMateri,
                  startUnitId,
                  startHal: draftStartHal,
                } = payload.materialProgress as any;
                const numHal = draftHal !== undefined && draftHal !== '' ? Number(draftHal) : undefined;
                const numStartHal = draftStartHal !== undefined && draftStartHal !== '' ? Number(draftStartHal) : undefined;
                onUpdateDb((prev) => {
                  const meetings = prev.meetings || [];
                  const exists = meetings.some((m) => m.id === meetingId);
                  const updated = exists
                    ? meetings.map((m) =>
                        m.id === meetingId
                          ? {
                              ...m,
                              actual_materi_id: unitId || draftMateri || m.actual_materi_id,
                              actual_page: numHal !== undefined ? numHal : m.actual_page,
                              actual_start_materi_id: startUnitId || draftStartMateri || m.actual_start_materi_id,
                              actual_start_page: numStartHal !== undefined ? numStartHal : m.actual_start_page,
                              notes: payload.meetingNotes !== undefined ? payload.meetingNotes : m.notes,
                            }
                          : m
                      )
                    : [
                        ...meetings,
                        {
                          id: meetingId,
                          meeting_date: dateStr,
                          class_id: slot.classId,
                          subject_id: slot.subjectId,
                          teacher_id: slot.teacherId,
                          room_id: slot.roomId,
                          session_id: slot.sessionId,
                          status: 'scheduled',
                          actual_materi_id: unitId || draftMateri,
                          actual_page: numHal,
                          actual_start_materi_id: startUnitId || draftStartMateri,
                          actual_start_page: numStartHal,
                          notes: payload.meetingNotes,
                        } as any,
                      ];
                  return { ...prev, meetings: updated };
                });
              }
            }}
            onDiscardDraft={() => {
              store.discardDraft(meetingId);
              onUpdateDb((prev) => {
                const meetings = prev.meetings || [];
                return {
                  ...prev,
                  meetings: meetings.map((m) =>
                    m.id === meetingId
                      ? {
                          ...m,
                          actual_materi_id: (dayMeeting as any)?.actual_materi_id,
                          actual_page: (dayMeeting as any)?.actual_page,
                          actual_start_materi_id: (dayMeeting as any)?.actual_start_materi_id,
                          actual_start_page: (dayMeeting as any)?.actual_start_page,
                          notes: (dayMeeting as any)?.notes,
                        }
                      : m
                  ),
                };
              });
            }}
            getEffectiveStatus={store.getEffectiveStatus}
            hasDraft={store.isMeetingDrafted(meetingId)}
            onSetSessionStatus={(id, next) => store.setSessionStatusDraft(id, next)}
            targetMateri={titles || scopedUnits[0]?.title || undefined}
            targetHal={targetPage}
            targetUnitId={units[0]?.id || scopedUnits[0]?.id}
            availableUnits={scopedUnits}
            onPrevSession={handlePrevSession}
            onNextSession={handleNextSession}
            hasPrevSession={hasPrevSession}
            hasNextSession={hasNextSession}
            sessionTitle={sessionObj?.name}
            classTitle={classObj?.name}
            formattedDate={formattedSelectedDate}
          />
        );
      })()}

      {/* Event Add/Edit Modal (Kaldik mode only) */}
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

      {/* Modal Konfirmasi Jadwalkan Pertemuan */}
      {isGenerateConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900">Jadwalkan Pertemuan KBM</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tindakan ini akan menjadwalkan pertemuan sesuai aturan jadwal KBM yang ada sepanjang semua semester/periode.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Pertemuan yang telah selesai/tercatat presensi tetap dipertahankan.</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Hari libur dan agenda non-KBM otomatis dilewati.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setIsGenerateConfirmOpen(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleConfirmGenerateMeetings}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menjadwalkan...</span>
                  </>
                ) : (
                  <span>Jadwalkan Sekarang</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hasil Jadwalkan Pertemuan */}
      {generateResult && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                generateResult.success ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {generateResult.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900">
                  {generateResult.success ? 'Penjadwalan Selesai' : 'Gagal Menjadwalkan'}
                </h3>
                <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {generateResult.success ? (
                    <div className="space-y-1">
                      <p>
                        Berhasil menjadwalkan <strong>{generateResult.totalUpserted}</strong> pertemuan KBM.
                      </p>
                      {generateResult.preservedCompleted !== undefined && generateResult.preservedCompleted > 0 && (
                        <p className="text-emerald-700">
                          Sebanyak <strong>{generateResult.preservedCompleted}</strong> pertemuan yang telah selesai dipertahankan.
                        </p>
                      )}
                      {generateResult.holidaysSkipped !== undefined && generateResult.holidaysSkipped > 0 && (
                        <p className="text-slate-500">
                          Sebanyak <strong>{generateResult.holidaysSkipped}</strong> hari libur dilewati.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p>{generateResult.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setGenerateResult(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
