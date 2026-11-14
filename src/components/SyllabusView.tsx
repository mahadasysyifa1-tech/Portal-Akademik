import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BookmarkCheck } from 'lucide-react';
import {
  DatabaseState,
  Teacher,
  Room,
  ScheduledSessionOccurrence
} from '../types';
import {
  computePacingProjection,
  getScopedUnits
} from '../utils/pacingEngine';
import {
  SyllabusSubjectPicker,
  SyllabusFilterMode
} from './syllabus/SyllabusSubjectPicker';
import { SyllabusTimeline } from './syllabus/SyllabusTimeline';
import { AttendanceModal } from './attendance/AttendanceModal';
import { useAttendancePendingStore, AttendancePendingStore } from '../utils/useAttendancePendingStore';
import { buildMeetingId } from '../utils/kaldikHelpers';
import { useAuth } from '../context/AuthContext';


export type ViewerRole = 'student' | 'teacher' | 'admin';

export interface SyllabusViewProps {
  db: DatabaseState;
  isAdmin: boolean;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
  pendingStore?: AttendancePendingStore;
  viewerRole?: ViewerRole;
  setViewerRole?: (role: ViewerRole) => void;
  viewerId?: string;
  setViewerId?: (id: string) => void;
  initialSubjectId?: string;
  initialClassId?: string;
  highlightDate?: string;
  onClearInitialDeepLink?: () => void;
  onOpenAdminLogin: () => void;
  onNavigateToRuleManager?: () => void;
  onNavigateToSyllabusScope?: (subjectId?: string, classId?: string) => void;
  onNavigateToBooks?: (bookId?: string) => void;
}

export const SyllabusView: React.FC<SyllabusViewProps> = ({
  db,
  isAdmin,
  onUpdateDb,
  pendingStore,
  initialSubjectId,
  initialClassId,
  highlightDate,
  onClearInitialDeepLink,
  onOpenAdminLogin,
  onNavigateToRuleManager,
  onNavigateToSyllabusScope,
  onNavigateToBooks
}) => {
  const fallbackStore = useAttendancePendingStore();
  const store = pendingStore || fallbackStore;
  const auth = useAuth();
  const effectiveIsAdmin = isAdmin || auth.isAdmin;
  const [activeAttendanceSession, setActiveAttendanceSession] = useState<ScheduledSessionOccurrence | null>(null);


  // Navigation states
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(initialSubjectId || null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(initialClassId || null);
  const [subjectSearch, setSubjectSearch] = useState('');

  // Local filter for "Pilih Mata Pelajaran" page
  const [filterMode, setFilterMode] = useState<SyllabusFilterMode>('all');
  const [filterClassId, setFilterClassId] = useState<string>(db.classes[0]?.id || '');
  const [filterTeacherId, setFilterTeacherId] = useState<string>(db.teachers[0]?.id || '');

  // 1-time token state for row highlight
  const [activeHighlightDate, setActiveHighlightDate] = useState<string | null>(highlightDate || null);

  // References for scrolling
  const todayRowRef = useRef<HTMLDivElement | null>(null);
  const currentSessionRef = useRef<HTMLDivElement | null>(null);

  // Today string YYYY-MM-DD
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Handle deep link updates from Home tab or Pelajaran tab (strictly 1-time token)
  useEffect(() => {
    if (initialSubjectId) {
      setSelectedSubjectId(initialSubjectId);
      if (initialClassId) {
        setSelectedClassId(initialClassId);
      } else {
        const allRules = (db.rules || []).filter(
          (r) => r.active !== false && r.subjectId === initialSubjectId
        );
        const uniqueClassIds = Array.from(new Set(allRules.map((r) => r.classId)));
        if (uniqueClassIds.length === 1) {
          setSelectedClassId(uniqueClassIds[0]);
        } else {
          setSelectedClassId(null);
        }
      }
      if (highlightDate) {
        setActiveHighlightDate(highlightDate);
      }
      onClearInitialDeepLink?.();
    }
  }, [initialSubjectId, initialClassId, highlightDate, db.rules, onClearInitialDeepLink]);

  // Ensure any token is cleared when unmounting / exiting page
  useEffect(() => {
    return () => {
      onClearInitialDeepLink?.();
    };
  }, [onClearInitialDeepLink]);


  // Filter subjects in "Pilih Mata Pelajaran" page
  const availableSubjects = useMemo(() => {
    const allSubjects = db.subjects || [];
    const allRules = (db.rules || []).filter((r) => r.active !== false);

    if (filterMode === 'class') {
      const targetClassId = filterClassId || db.classes[0]?.id;
      const classRules = allRules.filter((r) => r.classId === targetClassId);
      const subjectIds = new Set(classRules.map((r) => r.subjectId));
      return allSubjects.filter((s) => subjectIds.has(s.id));
    } else if (filterMode === 'teacher') {
      const targetTeacherId = filterTeacherId || db.teachers[0]?.id;
      const teacherRules = allRules.filter((r) => r.teacherId === targetTeacherId);
      const subjectIds = new Set(teacherRules.map((r) => r.subjectId));
      return allSubjects.filter((s) => subjectIds.has(s.id));
    } else {
      return allSubjects;
    }
  }, [db.subjects, db.rules, db.classes, db.teachers, filterMode, filterClassId, filterTeacherId]);

  // Find applicable class-sections for selectedSubjectId
  const applicableClasses = useMemo(() => {
    if (!selectedSubjectId) return [];
    const allRules = (db.rules || []).filter(
      (r) => r.active !== false && (r.subjectId === selectedSubjectId || (r as any).subject_id === selectedSubjectId)
    );
    const classIds = allRules.map((r) => r.classId || (r as any).class_id);
    if (db.meetings && db.meetings.length > 0) {
      const meetingClassIds = db.meetings
        .filter((m) => m.subject_id === selectedSubjectId)
        .map((m) => m.class_id);
      classIds.push(...meetingClassIds);
    }
    const uniqueClassIds = Array.from(new Set(classIds));
    const classMap = new Map((db.classes || []).map((c) => [c.id, c]));
    return uniqueClassIds
      .map((cid) => classMap.get(cid) || (db.classes || []).find((c) => c.display_code === cid || c.code === cid))
      .filter(Boolean) as typeof db.classes;
  }, [selectedSubjectId, db.rules, db.classes, db.meetings]);

  const handleSelectSubject = (subId: string) => {
    setSelectedSubjectId(subId);
    onClearInitialDeepLink?.();

    const allRules = (db.rules || []).filter(
      (r) => r.active !== false && (r.subjectId === subId || (r as any).subject_id === subId)
    );
    const classIds = allRules.map((r) => r.classId || (r as any).class_id);
    if (db.meetings && db.meetings.length > 0) {
      const meetingClassIds = db.meetings
        .filter((m) => m.subject_id === subId)
        .map((m) => m.class_id);
      classIds.push(...meetingClassIds);
    }
    const uniqueClassIds = Array.from(new Set(classIds));

    if (uniqueClassIds.length === 1) {
      setSelectedClassId(uniqueClassIds[0]);
    } else {
      setSelectedClassId(null);
    }
  };

  const selectedFilterClass = useMemo(() => {
    return db.classes.find((c) => c.id === filterClassId) || db.classes[0];
  }, [db.classes, filterClassId]);

  const selectedFilterTeacher = useMemo(() => {
    return db.teachers.find((t) => t.id === filterTeacherId) || db.teachers[0];
  }, [db.teachers, filterTeacherId]);

  const currentSubject = db.subjects.find((s) => s.id === selectedSubjectId);
  const currentClass = db.classes.find((c) => c.id === selectedClassId);
  const teacherMap = useMemo(() => new Map<string, Teacher>((db.teachers || []).map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map<string, Room>((db.rooms || []).map((r) => [r.id, r])), [db.rooms]);
  const bookMap = useMemo(() => new Map<string, any>((db.books || []).map((b) => [b.id, b])), [db.books]);

  // Scope status
  const existingScope = useMemo(() => {
    if (!selectedSubjectId || !selectedClassId) return null;
    return (db.syllabusScopes || []).find((s) => {
      const matchSubj =
        s.subject_id === selectedSubjectId ||
        (currentSubject && (s.subject_id === currentSubject.id || s.subject_id === currentSubject.code));
      const matchClass =
        s.class_section_id === selectedClassId ||
        (s as any).class_code === selectedClassId ||
        (s as any).classId === selectedClassId;
      return matchSubj && matchClass;
    });
  }, [db.syllabusScopes, selectedSubjectId, selectedClassId, currentSubject]);

  // Scoped pacing data for the selected (subject, class)
  const pacingData = useMemo(() => {
    if (!selectedSubjectId || !selectedClassId) return null;
    const projection = computePacingProjection(db, selectedSubjectId, selectedClassId);
    const scopedUnits = getScopedUnits(db, selectedSubjectId, selectedClassId);

    const totalPages = scopedUnits.reduce((acc, u) => {
      const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
      const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
      if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
        return acc + (pEnd - pStart + 1);
      }
      return acc + 1;
    }, 0);

    const activeProjections = projection.filter((p) => !p.session.isCancelled);
    const activeCount = activeProjections.length;

    let pagesPerSession = activeCount > 0
      ? (totalPages / activeCount).toFixed(1)
      : '0';

    let adj = existingScope?.adjustment;
    if (!adj && activeCount > 0) {
      const recordedActiveSessions = activeProjections.filter(
        (p) => typeof p.session.actual_page === 'number' && p.session.actual_page > 0
      );
      if (recordedActiveSessions.length > 0) {
        const latestRecorded = recordedActiveSessions[recordedActiveSessions.length - 1];
        adj = {
          checkpointSessionIndex: latestRecorded.session.meetingIndex,
          checkpointSessionId: latestRecorded.session.id,
          checkpointDate: latestRecorded.session.date,
          checkpointUnitId: latestRecorded.session.actual_materi_id || '',
          checkpointPage: latestRecorded.session.actual_page || 1,
          strategy: 'accelerate',
          cutUnitIds: []
        };
      }
    }

    if (adj && activeCount > 0) {
      let checkpointIdx = activeProjections.findIndex(
        (p) => p.session.meetingIndex === adj!.checkpointSessionIndex
      );
      if (checkpointIdx === -1 && adj.checkpointSessionId) {
        checkpointIdx = activeProjections.findIndex((p) => p.session.id === adj!.checkpointSessionId);
      }
      if (checkpointIdx === -1 && adj.checkpointDate) {
        checkpointIdx = activeProjections.findIndex((p) => p.session.date === adj!.checkpointDate);
      }
      if (checkpointIdx === -1) {
        checkpointIdx = 0;
      }

      const remainingSessionCount = Math.max(1, activeProjections.length - (checkpointIdx + 1));
      let currUnitIdx = -1;
      if (adj.checkpointUnitId) {
        currUnitIdx = scopedUnits.findIndex((u) => u.id === adj!.checkpointUnitId);
      }
      if (currUnitIdx === -1 && typeof adj.checkpointPage === 'number') {
        currUnitIdx = scopedUnits.findIndex((u) => {
          const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10) || 1;
          const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10) || 100;
          return adj!.checkpointPage >= pStart && adj!.checkpointPage <= pEnd;
        });
      }

      const cutSet = new Set(adj.strategy === 'cut' ? (adj.cutUnitIds || []) : []);

      let remPages = 0;
      if (currUnitIdx !== -1) {
        const currentUnit = scopedUnits[currUnitIdx];
        const uStart = typeof currentUnit.page_start === 'number' ? currentUnit.page_start : parseInt(String(currentUnit.page_start), 10) || 1;
        const uEnd = typeof currentUnit.page_end === 'number' ? currentUnit.page_end : parseInt(String(currentUnit.page_end), 10) || 100;
        if (!isNaN(uEnd) && adj.checkpointPage <= uEnd) {
          if (!cutSet.has(currentUnit.id)) {
            remPages += Math.max(0, uEnd - adj.checkpointPage + 1);
          }
        }
        for (let j = currUnitIdx + 1; j < scopedUnits.length; j++) {
          const u = scopedUnits[j];
          if (!cutSet.has(u.id)) {
            const s = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10) || 1;
            const e = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10) || 1;
            remPages += Math.max(1, e - s + 1);
          }
        }
      } else {
        for (const u of scopedUnits) {
          if (!cutSet.has(u.id)) {
            const s = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10) || 1;
            const e = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10) || 1;
            remPages += Math.max(1, e - s + 1);
          }
        }
      }

      pagesPerSession = (remPages / remainingSessionCount).toFixed(1);
    }

    return {
      projection,
      scopedUnits,
      totalPages,
      pagesPerSession
    };
  }, [db, selectedSubjectId, selectedClassId, existingScope]);

  // Baseline unadjusted target pacing data
  const targetPacingData = useMemo(() => {
    if (!selectedSubjectId || !selectedClassId) return null;
    const projection = computePacingProjection(db, selectedSubjectId, selectedClassId, { viewMode: 'target' });
    const scopedUnits = getScopedUnits(db, selectedSubjectId, selectedClassId);

    const totalPages = scopedUnits.reduce((acc, u) => {
      const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
      const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
      if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
        return acc + (pEnd - pStart + 1);
      }
      return acc + 1;
    }, 0);

    const activeCount = projection.length;
    const pagesPerSession = activeCount > 0 ? (totalPages / activeCount).toFixed(1) : '0';

    return {
      projection,
      scopedUnits,
      totalPages,
      pagesPerSession
    };
  }, [db, selectedSubjectId, selectedClassId]);

  const displayNumber = (slotIdx: number) => {
    return Math.max(1, slotIdx);
  };

  const currentSessionItem = useMemo(() => {
    if (!pacingData || pacingData.projection.length === 0) return null;
    return (
      pacingData.projection.find((p) => p.session.date === todayStr) ||
      pacingData.projection.find((p) => p.session.date > todayStr) ||
      pacingData.projection[pacingData.projection.length - 1]
    );
  }, [pacingData, todayStr]);

  // Auto-scroll to today or highlighted date once journal view renders
  const scrollTargetDate = useMemo(() => {
    if (activeHighlightDate) return activeHighlightDate;
    if (pacingData?.projection.some((p) => p.session.date === todayStr)) return todayStr;
    return currentSessionItem?.session.date ?? null;
  }, [activeHighlightDate, pacingData, todayStr, currentSessionItem]);

  useEffect(() => {
    if (!selectedSubjectId || !selectedClassId || !scrollTargetDate) return;

    let tries = 0;
    let frame = 0;
    const tryScroll = () => {
      const el = document.querySelector<HTMLElement>(`[data-session-date="${scrollTargetDate}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (++tries < 30) frame = requestAnimationFrame(tryScroll);
    };

      frame = requestAnimationFrame(tryScroll);
      return () => cancelAnimationFrame(frame);
  }, [selectedSubjectId, selectedClassId, scrollTargetDate]);

  return (
    <div className="space-y-6">
      {/* STEP 1 & 2: Subject Picker & Class Selector */}
      {(!selectedSubjectId || !selectedClassId) && (
        <SyllabusSubjectPicker
          db={db}
          selectedSubjectId={selectedSubjectId}
          selectedClassId={selectedClassId}
          onSelectSubject={handleSelectSubject}
          onSelectClass={(clsId) => setSelectedClassId(clsId)}
          onBackToSubjects={() => {
            setSelectedSubjectId(null);
            setSelectedClassId(null);
            onClearInitialDeepLink?.();
          }}
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          filterClassId={filterClassId}
          setFilterClassId={setFilterClassId}
          filterTeacherId={filterTeacherId}
          setFilterTeacherId={setFilterTeacherId}
          subjectSearch={subjectSearch}
          setSubjectSearch={setSubjectSearch}
          availableSubjects={availableSubjects}
          applicableClasses={applicableClasses}
          currentSubject={currentSubject}
          selectedFilterClass={selectedFilterClass}
          selectedFilterTeacher={selectedFilterTeacher}
        />
      )}

      {/* STEP 3: Timeline & Session Sequence */}
      {selectedSubjectId && selectedClassId && (
        <SyllabusTimeline
          currentSubject={currentSubject}
          currentClass={currentClass}
          applicableClasses={applicableClasses}
          pacingData={pacingData}
          targetPacingData={targetPacingData}
          existingScope={existingScope}
          isAdmin={isAdmin}
          onNavigateToSyllabusScope={onNavigateToSyllabusScope}
          onNavigateToRuleManager={onNavigateToRuleManager}
          onNavigateToBooks={onNavigateToBooks}
          onOpenAdminLogin={onOpenAdminLogin}
          onBackToClasses={() => setSelectedClassId(null)}
          onBackToSubjects={() => {
            onClearInitialDeepLink?.();
            setSelectedSubjectId(null);
            setSelectedClassId(null);
          }}
          todayStr={todayStr}
          activeHighlightDate={activeHighlightDate}
          currentSessionItem={currentSessionItem}
          teacherMap={teacherMap}
          roomMap={roomMap}
          bookMap={bookMap}
          todayRowRef={todayRowRef}
          currentSessionRef={currentSessionRef}
          displayNumber={displayNumber}
          onOpenAttendance={(session) => setActiveAttendanceSession(session)}
        />
      )}

      {/* In-Place Attendance & Material Calibration Modal */}
      {activeAttendanceSession && (() => {
        const session = activeAttendanceSession;
        const meetingId = buildMeetingId(
          session.date,
          session.classId,
          session.sessionId,
          session.id?.startsWith('mtg-') ? session.id : undefined
        );
        const scopedUnits = pacingData?.scopedUnits || [];
        const sessionObj = db.sessions.find((s) => s.id === session.sessionId);
        const classObj = db.classes.find((c) => c.id === session.classId);

        const canEditSession = effectiveIsAdmin || auth.canEditSession(session.teacherId);

        return (
          <AttendanceModal
            key={meetingId}
            isAdmin={canEditSession}
            meetingId={meetingId}

            meetingNumber={session.meetingIndex}
            isOpen={true}
            onClose={() => setActiveAttendanceSession(null)}
            initialDraft={store.getRollCallDraft(meetingId)}
            onSaveDraft={(payload, options) => {
              const isSessionCancelled =
                options?.preserveCancelled ??
                store.getEffectiveStatus(meetingId, session.status) === 'cancelled';
              store.setRollCallDraft(meetingId, payload, { preserveCancelled: isSessionCancelled });
              store.syncMeetingDraftToDb(onUpdateDb, meetingId, payload, {
                meeting_date: session.date,
                meeting_index: session.meetingIndex,
                class_id: session.classId,
                subject_id: session.subjectId,
                teacher_id: session.teacherId,
                room_id: session.roomId,
                session_id: session.sessionId,
                status: isSessionCancelled ? 'cancelled' : (session.status || 'scheduled'),
              });
            }}
            onDiscardDraft={() => {
              store.discardDraft(meetingId);
              store.restoreMeetingDraftInDb(onUpdateDb, meetingId);
            }}
            getEffectiveStatus={store.getEffectiveStatus}
            hasDraft={store.isMeetingDrafted(meetingId)}
            onSetSessionStatus={(id, next) => store.setSessionStatusDraft(id, next)}
            targetMateri={scopedUnits[0]?.title}
            targetHal={scopedUnits[0]?.page_end ? Number(scopedUnits[0].page_end) : undefined}
            targetUnitId={scopedUnits[0]?.id}
            availableUnits={scopedUnits}
            sessionTitle={sessionObj?.name || session.sessionName}
            classTitle={classObj?.name}
            formattedDate={`${session.day}, ${session.date}`}
          />
        );
      })()}
    </div>
  );
};
