import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BookmarkCheck } from 'lucide-react';
import {
  DatabaseState,
  Teacher,
  Room
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

export type ViewerRole = 'student' | 'teacher' | 'admin';

export interface SyllabusViewProps {
  db: DatabaseState;
  isAdmin: boolean;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
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
  initialSubjectId,
  initialClassId,
  highlightDate,
  onClearInitialDeepLink,
  onOpenAdminLogin,
  onNavigateToRuleManager,
  onNavigateToSyllabusScope,
  onNavigateToBooks
}) => {
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

  // Auto-scroll to today or highlighted date once journal view renders
  useEffect(() => {
    if (selectedSubjectId && selectedClassId) {
      const timer = setTimeout(() => {
        if (todayRowRef.current) {
          todayRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [selectedSubjectId, selectedClassId, activeHighlightDate]);

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
      (r) => r.active !== false && r.subjectId === selectedSubjectId
    );
    const classIds = allRules.map((r) => r.classId);
    const uniqueClassIds = Array.from(new Set(classIds));
    const classMap = new Map((db.classes || []).map((c) => [c.id, c]));
    return uniqueClassIds.map((cid) => classMap.get(cid)).filter(Boolean) as typeof db.classes;
  }, [selectedSubjectId, db.rules, db.classes]);

  const handleSelectSubject = (subId: string) => {
    setSelectedSubjectId(subId);
    onClearInitialDeepLink?.();

    const allRules = (db.rules || []).filter(
      (r) => r.active !== false && r.subjectId === subId
    );
    const uniqueClassIds = Array.from(new Set(allRules.map((r) => r.classId)));

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

    let pagesPerSession = projection.length > 0
      ? (totalPages / projection.length).toFixed(1)
      : '0';

    const adj = existingScope?.adjustment;
    if (adj && projection.length > 0) {
      let checkpointIdx = projection.findIndex(
        (p) => p.session.meetingIndex === adj.checkpointSessionIndex
      );
      if (checkpointIdx === -1 && adj.checkpointSessionId) {
        checkpointIdx = projection.findIndex((p) => p.session.id === adj.checkpointSessionId);
      }
      if (checkpointIdx === -1 && adj.checkpointDate) {
        checkpointIdx = projection.findIndex((p) => p.session.date === adj.checkpointDate);
      }
      if (checkpointIdx === -1) {
        checkpointIdx = 0;
      }

      const remainingSessionCount = Math.max(1, projection.length - checkpointIdx);
      const currUnitIdx = scopedUnits.findIndex((u) => u.id === adj.checkpointUnitId);
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

  const displayNumber = (slotIdx: number) => {
    const adj = existingScope?.adjustment;
    if (!adj?.checkpointSessionNumber || slotIdx < adj.checkpointSessionIndex) return slotIdx;
    return slotIdx - adj.checkpointSessionIndex + adj.checkpointSessionNumber;
  };

  const currentSessionItem = useMemo(() => {
    if (!pacingData || pacingData.projection.length === 0) return null;
    return (
      pacingData.projection.find((p) => p.session.date === todayStr) ||
      pacingData.projection.find((p) => p.session.date > todayStr) ||
      pacingData.projection[pacingData.projection.length - 1]
    );
  }, [pacingData, todayStr]);

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
        />
      )}
    </div>
  );
};
