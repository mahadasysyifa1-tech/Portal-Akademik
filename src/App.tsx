import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DatabaseState, ScheduleRule, ScheduleConflict, DayOfWeek, SaveStatus } from './types';
import { detectConflicts } from './utils/scheduleEngine';
import { normalizeDatabaseState, normalizeRule } from './utils/normalize';
import { Header, ActiveTabType, DatabaseSubTab } from './components/Header';
import { UnifiedStudio } from './components/UnifiedStudio';
import { ScheduleViewMode } from './components/JadwalView';
import { SubjectsDirectory } from './components/directory/SubjectsDirectory';
import { BooksDirectory } from './components/directory/BooksDirectory';
import { TeachersDirectory } from './components/directory/TeachersDirectory';
import { StudentsDirectory } from './components/directory/StudentsDirectory';
import { ConflictCenter } from './components/ConflictCenter';
import { EntityManager } from './components/EntityManager';
import { RuleModal } from './components/RuleModal';
import { AuthGate } from './components/AuthGate';
import { HomeTab } from './components/HomeTab';
import { SyllabusView } from './components/SyllabusView';
import { ExportImportView } from './components/ExportImportView';
import { KaldikView } from './components/kaldik/KaldikView';
import { EnrollmentView } from './components/attendance/EnrollmentView';
import { RuleManagerView } from './components/ruleManager/RuleManagerView';
import { parseUrlRoute, updateUrlRoute } from './utils/routing';
import { useAttendancePendingStore } from './utils/useAttendancePendingStore';
import type { ViewerRole } from './types/viewer';
import { useAuth } from './context/AuthContext';

const defaultEmptyDb: DatabaseState = {

  classes: [],
  teachers: [],
  rooms: [],
  subjects: [],
  periods: [],
  sessions: [],
  rules: [],
  kaldikEvents: [],
  materials: [],
  syllabusUnits: [],
  syllabusScopes: [],
  books: [],
  students: [],
  enrollments: [],
};

export default function App() {
  const initialRoute = useMemo(() => parseUrlRoute(), []);

  const [activeTab, setActiveTab] = useState<ActiveTabType>(() => {
    if (initialRoute.tab) return initialRoute.tab;
    try {
      const savedTab = localStorage.getItem('ijma_last_tab') as ActiveTabType;
      if (savedTab && ['home', 'studio', 'kaldik'].includes(savedTab)) {
        return savedTab;
      }
    } catch {}
    return 'home';
  });

  const [db, setDb] = useState<DatabaseState>(() => {
    try {
      const cached = localStorage.getItem('school_schedule_db');
      if (cached) {
        return normalizeDatabaseState(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('Could not parse cached database', e);
    }
    return normalizeDatabaseState(defaultEmptyDb);
  });

  // Permanently purge any residual legacy admin flag from browser localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('ijma_admin_auth');
    } catch {}
  }, []);

  const auth = useAuth();
  const effectiveIsAdmin = auth.isAdmin;

  const [databaseSubTab, setDatabaseSubTab] = useState<DatabaseSubTab>('classes');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [displayCodeDrafts, setDisplayCodeDrafts] = useState<
    Record<string, { personType: 'teacher' | 'student'; personId: string; displayCode: string }>
  >({});
  const hasDisplayCodeDrafts = Object.keys(displayCodeDrafts).length > 0;
  const attendancePendingStore = useAttendancePendingStore();
  const combinedIsDirty = isDirty || attendancePendingStore.isDirty || hasDisplayCodeDrafts;

  const draftItems = useMemo(() => {
    const items: string[] = [];
    if (attendancePendingStore.pendingCount > 0) {
      items.push(`presensi (${attendancePendingStore.pendingCount} sesi)`);
    } else if (attendancePendingStore.isDirty) {
      items.push('presensi');
    }
    const codeCount = Object.keys(displayCodeDrafts).length;
    if (codeCount > 0) {
      items.push(`kode tampilan (${codeCount})`);
    }
    if (isDirty) {
      items.push('jadwal/database');
    }
    return items;
  }, [attendancePendingStore.pendingCount, attendancePendingStore.isDirty, displayCodeDrafts, isDirty]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [cloudLoad, setCloudLoad] = useState<'loading' | 'ok' | 'failed'>('loading');
  const editVersion = useRef(0);
  const [showRules, setShowRules] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [kaldikMode, setKaldikMode] = useState<'kaldik' | 'jurnal'>('kaldik');
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null);
  const [slotPrefill, setSlotPrefill] = useState<{
    day?: DayOfWeek;
    periodId?: string;
    sessionId?: string;
    classId?: string;
    subjectId?: string;
  } | undefined>(undefined);

  // Viewer role & identity state for Home, Studio/Jadwal & Journal
  const [viewerRole, setViewerRole] = useState<ViewerRole>(() => {
    if (initialRoute.role) return initialRoute.role;
    try {
      const savedRole = localStorage.getItem('ijma_viewer_role') as ViewerRole;
      if (savedRole === 'student' || savedRole === 'teacher') return savedRole;
    } catch {}
    return 'student';
  });

  const [viewerId, setViewerId] = useState<string>(() => {
    if (initialRoute.id) return initialRoute.id;
    try {
      const savedId = localStorage.getItem('ijma_viewer_id');
      if (savedId) return savedId;
    } catch {}
    return '';
  });

  // Automatically align viewerRole and viewerId with authenticated teacher or student identity from Turso
  useEffect(() => {
    if (auth.isTeacher && auth.teacherId) {
      setViewerRole('teacher');
      setViewerId(auth.teacherId);
      setStudioViewMode(ScheduleViewMode.TEACHER_WEEK);
      setStudioSelectedTeacherId(auth.teacherId);
    } else if (auth.isStudent && auth.classId) {
      setViewerRole('student');
      setViewerId(auth.classId);
      setStudioViewMode(ScheduleViewMode.STUDENT_WEEK);
      setStudioSelectedClassId(auth.classId);
    }
  }, [auth.isTeacher, auth.teacherId, auth.isStudent, auth.classId]);

  // Unified Studio schedule view state (persisted across rule edits, navigation, and reloads)
  const [studioViewMode, setStudioViewMode] = useState<ScheduleViewMode>(() => {
    if (initialRoute.view) return initialRoute.view;
    try {
      const saved = localStorage.getItem('ijma_studio_view_mode') as ScheduleViewMode;
      if (saved && Object.values(ScheduleViewMode).includes(saved)) {
        return saved;
      }
      const savedRole = localStorage.getItem('ijma_viewer_role');
      if (savedRole === 'teacher') return ScheduleViewMode.TEACHER_WEEK;
    } catch {}
    return initialRoute.role === 'teacher' ? ScheduleViewMode.TEACHER_WEEK : ScheduleViewMode.STUDENT_WEEK;
  });

  const [studioSelectedClassId, setStudioSelectedClassId] = useState<string>(() => {
    if (initialRoute.role === 'student' && initialRoute.id) return initialRoute.id;
    try {
      const saved = localStorage.getItem('ijma_studio_selected_class');
      if (saved) return saved;
      const savedId = localStorage.getItem('ijma_viewer_id');
      if (savedId) return savedId;
    } catch {}
    return '';
  });

  const [studioSelectedTeacherId, setStudioSelectedTeacherId] = useState<string>(() => {
    if (initialRoute.role === 'teacher' && initialRoute.id) return initialRoute.id;
    try {
      const saved = localStorage.getItem('ijma_studio_selected_teacher');
      if (saved) return saved;
      const savedId = localStorage.getItem('ijma_viewer_id');
      if (savedId) return savedId;
    } catch {}
    return '';
  });

  const [studioSelectedPeriodId, setStudioSelectedPeriodId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ijma_studio_selected_period');
      if (saved) return saved;
    } catch {}
    return 'all';
  });

  // Deep linking to Journal view
  const [journalNavParams, setJournalNavParams] = useState<{
    subjectId?: string;
    classId?: string;
    date?: string;
  } | null>(null);

  // Selected book for Books Directory view
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  // Selected subject for Subjects Directory view
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Deep linking to Presensi view
  const [attendanceNavParams, setAttendanceNavParams] = useState<{
    date?: string;
    classId?: string;
    sessionId?: string;
    subjectId?: string;
  }>({});

  const handleSetViewerRole = (role: ViewerRole) => {
    setViewerRole(role);
  };

  const handleSetViewerId = (id: string) => {
    setViewerId(id);
  };

  const [ruleManagerNavParams, setRuleManagerNavParams] = useState<{
    activePanels?: ('rules' | 'kaldik' | 'syllabus')[];
    subjectId?: string;
    classId?: string;
  } | null>(null);

  const handleNavigateToAttendance = (date: string, classId: string, sessionId: string, subjectId?: string) => {
    setAttendanceNavParams({ date, classId, sessionId, subjectId });
    setActiveTab('journal');
    updateUrlRoute('journal', viewerRole, viewerId, 'push');
  };

  const handleNavigateToSyllabusScope = (subjectId?: string, classId?: string) => {
    setRuleManagerNavParams({
      activePanels: ['syllabus'],
      subjectId,
      classId,
    });
    setActiveTab('rule-manager');
    updateUrlRoute('rule-manager', viewerRole, viewerId, 'push');
  };

  const handleNavigateToJournal = (_subjectId?: string, _classId?: string, _date?: string) => {
    setKaldikMode('jurnal');
    setActiveTab('kaldik');
  };

  const handleNavigateToSyllabus = (subjectId?: string, classId?: string, date?: string) => {
    setJournalNavParams({ subjectId, classId, date });
    setActiveTab('syllabus');
    updateUrlRoute('syllabus', viewerRole, viewerId, 'push');
  };

  const handleNavigateToBooks = (bookId?: string) => {
    if (bookId) {
      setSelectedBookId(bookId);
    }
    setActiveTab('books');
    updateUrlRoute('books', viewerRole, viewerId, 'push');
  };

  const handleNavigateToSubjects = (subjectId?: string) => {
    if (subjectId) {
      setSelectedSubjectId(subjectId);
    }
    setActiveTab('subjects');
    updateUrlRoute('subjects', viewerRole, viewerId, 'push');
  };

  const selectKaldikView = (view: 'kaldik' | 'jurnal') => {
    setKaldikMode(view);
    setActiveTab('kaldik');
  };
  const handleTabChange = (tab: ActiveTabType) => {
    // Navigating between tabs clears all 1-time deep link tokens
    setJournalNavParams(null);
    setSelectedBookId(null);
    setSelectedSubjectId(null);
    if (tab === 'studio') {
      if (auth.isTeacher && auth.teacherId) {
        setStudioViewMode(ScheduleViewMode.TEACHER_WEEK);
        setStudioSelectedTeacherId(auth.teacherId);
        setViewerRole('teacher');
        setViewerId(auth.teacherId);
      } else if (auth.isStudent && auth.classId) {
        setStudioViewMode(ScheduleViewMode.STUDENT_WEEK);
        setStudioSelectedClassId(auth.classId);
        setViewerRole('student');
        setViewerId(auth.classId);
      }
    }
    setActiveTab(tab);
    updateUrlRoute(tab, viewerRole, viewerId, 'push', tab === 'studio' ? studioViewMode : undefined);
  };

  // Catch Journal routes
  useEffect(() => {
    if (activeTab === 'journal' || activeTab === 'presensi') {
      setKaldikMode('jurnal');
      setActiveTab('kaldik');
    }
  }, [activeTab]);

  // Role-based route guard:
  // - guest: const allowedNonAdminTabs: ActiveTabType[] = ['home', 'studio', 'kaldik', 'books', 'teachers'];
  // - student: ro all pages (except admin pages in submenu: rule-manager, database, conflicts, export-import)
  // - teacher: student + personal attndmodal permission
  // - admin: full access
  useEffect(() => {
    if (!auth.isAuthenticated) return;

    if (auth.role === 'guest') {
      const allowedNonAdminTabs: ActiveTabType[] = ['home', 'studio', 'kaldik', 'books', 'teachers'];
      if (!allowedNonAdminTabs.includes(activeTab)) {
        setActiveTab('studio');
      }
      if (kaldikMode === 'jurnal') {
        setKaldikMode('kaldik');
      }
    } else if (!effectiveIsAdmin) {
      // student & teacher: access to all normal pages except the 4 admin submenus
      const adminOnlyTabs: ActiveTabType[] = ['rule-manager', 'database', 'conflicts', 'export-import'];
      if (adminOnlyTabs.includes(activeTab)) {
        setActiveTab('studio');
      }
    }
  }, [auth.isAuthenticated, auth.role, effectiveIsAdmin, activeTab, kaldikMode]);

  // Sync token in localStorage & URL
  useEffect(() => {
    try {
      localStorage.setItem('ijma_last_tab', activeTab);
      if (activeTab === 'home' || activeTab === 'studio') {
        if (viewerRole) localStorage.setItem('ijma_viewer_role', viewerRole);
        if (viewerId) localStorage.setItem('ijma_viewer_id', viewerId);
      }
    } catch {}

    updateUrlRoute(activeTab, viewerRole, viewerId, 'replace', activeTab === 'studio' ? studioViewMode : undefined);
  }, [activeTab, viewerRole, viewerId, studioViewMode]);

  // Handle browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const route = parseUrlRoute(db);
      if (route.tab) setActiveTab(route.tab);
      if (route.role) setViewerRole(route.role);
      if (route.id) setViewerId(route.id);
      if (route.view) setStudioViewMode(route.view);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [db]);

  // Fetch from backend API on mount
  useEffect(() => {
    fetch('/api/database')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: any) => {
        setCloudLoad('ok');
        if (data && data.subjects && data.subjects.length > 0) {
          const normalized = normalizeDatabaseState(data);
          setDb(normalized);
          try {
            localStorage.setItem('school_schedule_db', JSON.stringify(normalized));
          } catch {}
        }
      })
      .catch((err) => {
        console.warn('Failed to load from Turso; showing local cache only:', err);
        setCloudLoad('failed');
      });
  }, []);

  // Keep db.meetings in sync whenever attendance or meetings are updated
  useEffect(() => {
    const handleAttendanceSaved = () => {
      fetch('/api/database')
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data: any) => {
          if (data && Array.isArray(data.meetings)) {
            setDb((prev) => ({
              ...prev,
              meetings: data.meetings,
            }));
          }
        })
        .catch((err) => console.warn('Failed to refresh meetings on attendance:saved', err));
    };
    window.addEventListener('attendance:saved', handleAttendanceSaved);
    return () => window.removeEventListener('attendance:saved', handleAttendanceSaved);
  }, []);

  // Keep teachers / students email in sync immediately when admin approves a role request
  useEffect(() => {
    const handleRoleApproved = (e: Event) => {
      const detail = (e as CustomEvent<{ role?: 'teacher' | 'student'; personId?: string; email?: string }>).detail;
      if (detail?.personId && detail?.email) {
        setDb((prev) => {
          const nextTeachers =
            detail.role === 'teacher'
              ? (prev.teachers || []).map((t) =>
                  t.id === detail.personId ? { ...t, email: detail.email! } : t
                )
              : prev.teachers;
          const nextStudents =
            detail.role === 'student'
              ? (prev.students || []).map((s) =>
                  s.id === detail.personId ? { ...s, email: detail.email! } : s
                )
              : prev.students;
          const nextDb = { ...prev, teachers: nextTeachers, students: nextStudents };
          try {
            localStorage.setItem('school_schedule_db', JSON.stringify(nextDb));
          } catch {}
          return nextDb;
        });
      }

      if (!isDirty && !hasDisplayCodeDrafts) {
        fetch('/api/database')
          .then((res) => (res.ok ? res.json() : null))
          .then((data: any) => {
            if (data && data.subjects && data.subjects.length > 0) {
              const normalized = normalizeDatabaseState(data);
              setDb(normalized);
              try {
                localStorage.setItem('school_schedule_db', JSON.stringify(normalized));
              } catch {}
            }
          })
          .catch((err) => console.warn('Failed to refresh database after role approval', err));
      }
    };

    window.addEventListener('role-request:approved', handleRoleApproved);
    return () => window.removeEventListener('role-request:approved', handleRoleApproved);
  }, [isDirty, hasDisplayCodeDrafts]);
  useEffect(() => {
    if (viewerRole === 'student') {
      const valid = db.classes.some((c) => c.id === viewerId);

      if (!valid && db.classes.length > 0) {
        handleSetViewerId(db.classes[0].id);
      }
    }

    if (viewerRole === 'teacher') {
      const valid = db.teachers.some((t) => t.id === viewerId);

      if (!valid && db.teachers.length > 0) {
        handleSetViewerId(db.teachers[0].id);
      }
    }
  }, [db.classes, db.teachers, viewerRole, viewerId]);

  // Sync save to server and local cache
  const saveDatabase = useCallback((newDb: DatabaseState | ((prev: DatabaseState) => DatabaseState)) => {
    setDb((prev) => {
      const nextDb = typeof newDb === 'function' ? newDb(prev) : newDb;

      // Check if this update only modified in-memory meetings cache or unchanged structural state
      const isStructuralUnchanged =
        (nextDb.rules === prev.rules || (nextDb.rules?.length === prev.rules?.length && JSON.stringify(nextDb.rules) === JSON.stringify(prev.rules))) &&
        (nextDb.classes === prev.classes || (nextDb.classes?.length === prev.classes?.length && JSON.stringify(nextDb.classes) === JSON.stringify(prev.classes))) &&
        (nextDb.teachers === prev.teachers || (nextDb.teachers?.length === prev.teachers?.length && JSON.stringify(nextDb.teachers) === JSON.stringify(prev.teachers))) &&
        (nextDb.subjects === prev.subjects || (nextDb.subjects?.length === prev.subjects?.length && JSON.stringify(nextDb.subjects) === JSON.stringify(prev.subjects))) &&
        (nextDb.rooms === prev.rooms || (nextDb.rooms?.length === prev.rooms?.length && JSON.stringify(nextDb.rooms) === JSON.stringify(prev.rooms))) &&
        (nextDb.periods === prev.periods || (nextDb.periods?.length === prev.periods?.length && JSON.stringify(nextDb.periods) === JSON.stringify(prev.periods))) &&
        (nextDb.sessions === prev.sessions || (nextDb.sessions?.length === prev.sessions?.length && JSON.stringify(nextDb.sessions) === JSON.stringify(prev.sessions))) &&
        (nextDb.kaldikEvents === prev.kaldikEvents || (nextDb.kaldikEvents?.length === prev.kaldikEvents?.length && JSON.stringify(nextDb.kaldikEvents) === JSON.stringify(prev.kaldikEvents))) &&
        (nextDb.books === prev.books || (nextDb.books?.length === prev.books?.length && JSON.stringify(nextDb.books) === JSON.stringify(prev.books))) &&
        (nextDb.syllabusUnits === prev.syllabusUnits || (nextDb.syllabusUnits?.length === prev.syllabusUnits?.length && JSON.stringify(nextDb.syllabusUnits) === JSON.stringify(prev.syllabusUnits))) &&
        (nextDb.syllabusScopes === prev.syllabusScopes || (nextDb.syllabusScopes?.length === prev.syllabusScopes?.length && JSON.stringify(nextDb.syllabusScopes) === JSON.stringify(prev.syllabusScopes))) &&
        (nextDb.students === prev.students || (nextDb.students?.length === prev.students?.length && JSON.stringify(nextDb.students) === JSON.stringify(prev.students))) &&
        (nextDb.enrollments === prev.enrollments || (nextDb.enrollments?.length === prev.enrollments?.length && JSON.stringify(nextDb.enrollments) === JSON.stringify(prev.enrollments))) &&
        (nextDb.materials === prev.materials || (nextDb.materials?.length === prev.materials?.length && JSON.stringify(nextDb.materials) === JSON.stringify(prev.materials)));

      if (isStructuralUnchanged) {
        // Purely local meetings or unchanged structural state: update meetings in state without marking database as dirty
        return {
          ...prev,
          meetings: nextDb.meetings,
        };
      }

      // Structural database entity changed (rules, classes, subjects, kaldikEvents, etc.)
      const normalized = normalizeDatabaseState(nextDb);
      editVersion.current += 1;
      setIsDirty(true);
      setSaveStatus({ kind: 'idle' });
      try {
        localStorage.setItem('school_schedule_db', JSON.stringify(normalized));
      } catch (e) {
        console.warn('Local storage error', e);
      }
      return normalized;
    });
  }, []);

  const handleStageDisplayCodeDraft = useCallback(
    (personType: 'teacher' | 'student', personId: string, nextDisplayCode: string) => {
      const isAllowed =
        effectiveIsAdmin ||
        (personType === 'teacher' && auth.isTeacher && auth.teacherId === personId) ||
        (personType === 'student' && auth.isStudent && auth.studentId === personId);
      if (!isAllowed || !personId) return;

      const trimmed = String(nextDisplayCode ?? '').trim();
      const key = `${personType}:${personId}`;

      setDisplayCodeDrafts((prev) => ({
        ...prev,
        [key]: { personType, personId, displayCode: trimmed },
      }));

      setDb((prev) => {
        const nextTeachers =
          personType === 'teacher'
            ? (prev.teachers || []).map((t) =>
                t.id === personId ? { ...t, displayCode: trimmed, display_code: trimmed } : t
              )
            : prev.teachers;
        const nextStudents =
          personType === 'student'
            ? (prev.students || []).map((s) =>
                s.id === personId ? { ...s, displayCode: trimmed, display_code: trimmed } : s
              )
            : prev.students;
        const nextDb = { ...prev, teachers: nextTeachers, students: nextStudents };
        try {
          localStorage.setItem('school_schedule_db', JSON.stringify(nextDb));
        } catch {}
        return nextDb;
      });
      setSaveStatus({ kind: 'idle' });
    },
    [effectiveIsAdmin, auth.isTeacher, auth.teacherId, auth.isStudent, auth.studentId]
  );

  // Global discard drafts handler
  const handleDiscardAllDrafts = useCallback(() => {
    // 1. Clear attendance pending drafts and card displayCode drafts
    attendancePendingStore.clearDrafts();
    setDisplayCodeDrafts({});

    // 2. Clear database dirty flag and reload clean state from Turso
    setIsDirty(false);
    setSaveStatus({ kind: 'idle' });
    window.dispatchEvent(new Event('database:saved'));

    fetch('/api/database')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: any) => {
        if (data && data.subjects && data.subjects.length > 0) {
          const normalized = normalizeDatabaseState(data);
          setDb(normalized);
          try {
            localStorage.setItem('school_schedule_db', JSON.stringify(normalized));
          } catch {}
        }
      })
      .catch((err) => console.warn('Failed to refresh database on discard', err));
  }, [attendancePendingStore]);

  // SAVE and WARNING
  // Actual save function
    const countDb = (d: DatabaseState): Record<string, number> => ({
    subjects: d.subjects.length,
    classes: d.classes.length,
    teachers: d.teachers.length,
    rooms: d.rooms.length,
    sessions: d.sessions.length,
    periods: d.periods.length,
    rules: d.rules.length,
    kaldikEvents: (d.kaldikEvents || []).length,
    books: (d.books || []).length,
    syllabusUnits: (d.syllabusUnits || []).length,
    syllabusScopes: (d.syllabusScopes || []).length
  });

  const handleSaveToCloud = async () => {
    // Admin (database), Teachers (attendance/displayCode), or Students (own displayCode) with drafts can save
    if (!effectiveIsAdmin && !attendancePendingStore.isDirty && !hasDisplayCodeDrafts) {
      return;
    }

    if (effectiveIsAdmin && isDirty && cloudLoad !== 'ok') {
      setSaveStatus({
        kind: 'error',
        message: 'Data awal belum berhasil dimuat dari Turso. Muat ulang halaman dulu agar data cloud tidak tertimpa cache lama.'
      });
      return;
    }

    const snapshot = normalizeDatabaseState(db);
    setIsSaving(true);
    setSaveStatus({ kind: 'saving' });

    try {
      let actualCounts: Record<string, number> | undefined;
      let savedTimestamp = new Date().toISOString();

      if (effectiveIsAdmin && isDirty) {
        const res = await fetch('/api/database/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot)
        });
        const body: any = await res.json().catch(() => ({}));
        if (!res.ok || !body.success) {
          throw new Error(body?.details || body?.error || `HTTP ${res.status}`);
        }

        const expected = countDb(snapshot);
        const actual: Record<string, number> = body.counts || {};
        const mismatched = Object.keys(expected).filter((k) => expected[k] !== actual[k]);
        if (mismatched.length > 0) {
          throw new Error(
            'Data di Turso tidak sama dengan yang dikirim: ' +
              mismatched.map((k) => `${k} (dikirim ${expected[k]}, tersimpan ${actual[k] ?? '?'})`).join(', ')
          );
        }

        actualCounts = actual;
        savedTimestamp = body.savedAt || savedTimestamp;
        setIsDirty(false);
        setDisplayCodeDrafts({});
        window.dispatchEvent(new Event('database:saved'));
      } else if (hasDisplayCodeDrafts) {
        const res = await fetch('/api/directory/display-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorUid: auth.profile?.uid,
            updates: Object.values(displayCodeDrafts),
          }),
        });
        const body: any = await res.json().catch(() => ({}));
        if (!res.ok || !body.success) {
          throw new Error(body?.details || body?.error || `HTTP ${res.status}`);
        }
        setDisplayCodeDrafts({});
        window.dispatchEvent(new Event('database:saved'));
      }

      // Also flush pending attendance drafts if any
      let flushed = false;
      if (attendancePendingStore.isDirty) {
        await attendancePendingStore.flushBatchSave();
        flushed = true;
      }
      if (flushed) window.dispatchEvent(new Event('attendance:saved'));

      setSaveStatus({
        kind: 'ok',
        at: savedTimestamp,
        counts: actualCounts || countDb(snapshot)
      });
    } catch (err: any) {
      console.error('Save to Turso failed:', err);
      setSaveStatus({ kind: 'error', message: err?.message || 'Kesalahan tidak diketahui' });
    } finally {
      setIsSaving(false);
    }
  };

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!combinedIsDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [combinedIsDirty]);

  // Conflicts calculation
  const conflicts = useMemo(() => {
    return detectConflicts(db);
  }, [db]);

  // Admin auth handlers
  const handleOpenAdminLogin = () => {
    auth.signInWithGoogle();
  };

  const handleAdminLogout = () => {
    auth.signOutUser();
  };

  // Rule Handlers
  const handleOpenNewRule = (prefillSubjectId?: string) => {
    if (!effectiveIsAdmin) return;
    setEditingRule(null);
    setSlotPrefill(prefillSubjectId ? { subjectId: prefillSubjectId } : undefined);
    if (activeTab === 'studio') {
      setShowRules(true);
    } else {
      setIsModalOpen(true);
    }
  };

  const handleOpenNewRuleForSlot = (
    day: DayOfWeek,
    periodId: string,
    sessionId: string,
    classId?: string
  ) => {
    if (!effectiveIsAdmin) return;
    setEditingRule(null);
    setSlotPrefill({ day, periodId, sessionId, classId });
    if (activeTab === 'studio') {
      setShowRules(true);
    } else {
      setIsModalOpen(true);
    }
  };

  const handleEditRule = (rule: ScheduleRule) => {
    if (!effectiveIsAdmin) return;
    setEditingRule(rule);
    setSlotPrefill(undefined);
    if (activeTab === 'studio') {
      setShowRules(true);
    } else {
      setIsModalOpen(true);
    }
  };

  const handleAddRule = () => {
    if (!effectiveIsAdmin) return;
    setEditingRule(null);
    setSlotPrefill(undefined);
    if (activeTab === 'studio') {
      setShowRules(true);
    } else {
      setIsModalOpen(true);
    }
  };

  const handleDuplicateRule = (rule: ScheduleRule) => {
    if (!effectiveIsAdmin) return;

    const duplicated: ScheduleRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      notes: `${rule.notes || 'Aturan Jadwal'} (Salinan)`,
      createdAt: new Date().toISOString(),
      exceptions: rule.exceptions.map((e) => ({
        ...e,
        id: `exc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      }))
    };
    saveDatabase({
      ...db,
      rules: [duplicated, ...db.rules]
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!effectiveIsAdmin) return;
    saveDatabase({
      ...db,
      rules: db.rules.filter((r) => r.id !== ruleId)
    });
    if (editingRule?.id === ruleId) {
      setEditingRule(null);
      setSlotPrefill(undefined);
    }
  };

  const handleToggleRuleActive = (ruleId: string, active: boolean) => {
    if (!effectiveIsAdmin) return;
    saveDatabase({
      ...db,
      rules: db.rules.map((r) => (r.id === ruleId ? { ...r, active } : r))
    });
  };

  const handleToggleSubjectRulesActive = (subjectId: string, active: boolean) => {
    if (!effectiveIsAdmin) return;

    saveDatabase({
      ...db,
      rules: db.rules.map((r) => (r.subjectId === subjectId ? { ...r, active } : r))
    });
  };

  const handleSaveRule = (rule: ScheduleRule) => {
    const normalized = normalizeRule(rule, db.periods);
    const exists = db.rules.some((r) => r.id === normalized.id);
    let updatedRules: ScheduleRule[];
    if (exists) {
      updatedRules = db.rules.map((r) => (r.id === normalized.id ? normalized : r));
    } else {
      updatedRules = [normalized, ...db.rules];
    }
    saveDatabase({
      ...db,
      rules: updatedRules
    });
    setIsModalOpen(false);
    // Keep updated rule in editingRule so inline form in studio stays synced
    setEditingRule(normalized);
  };

  // Reset demo template
  const handleResetData = () => {
    if (!effectiveIsAdmin) return;
    if (!window.confirm('Kembalikan seluruh data jadwal ke data template bawaan IJMA?')) return;
    fetch('/api/database/reset', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          const normalized = normalizeDatabaseState(data);
          setDb(normalized);
          localStorage.setItem('school_schedule_db', JSON.stringify(normalized));
        }
      })
      .catch(() => {
        setDb(defaultEmptyDb);
        localStorage.setItem('school_schedule_db', JSON.stringify(defaultEmptyDb));
      });
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jadwal_ijma_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportJson = (jsonString: string) => {
    if (!effectiveIsAdmin) return;
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Format JSON tidak valid');
    }
    const normalized = normalizeDatabaseState(parsed);
    saveDatabase(normalized);
  };

  // If user is not logged in, show the full AuthGate lock screen (nologin: no access to the app at all)
  if (!auth.isAuthenticated) {
    return <AuthGate />;
  }

  return (
    <div className="min-h-screen bg-[#024884] text-slate-900 flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-white">
      {/* Top Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        kaldikMode={kaldikMode}
        onSelectKaldikView={selectKaldikView}
        onSelectDatabaseSubTab={(subTab) => {
          setDatabaseSubTab(subTab);
          handleTabChange('database');
        }}
        conflicts={conflicts}
        db={db}
        showRules={showRules}
        onToggleRules={setShowRules}
        isSaving={isSaving}
        isDirty={combinedIsDirty}
        onSave={handleSaveToCloud}
        isAdmin={effectiveIsAdmin}
        onOpenAdminLogin={handleOpenAdminLogin}
        onAdminLogout={handleAdminLogout}
        draftItems={draftItems}
        onDiscardDrafts={handleDiscardAllDrafts}
      />
      {cloudLoad === 'failed' && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-2 text-center">
          ⚠️ Gagal memuat data dari Turso. Yang tampil adalah cache lokal browser. Penyimpanan dinonaktifkan sampai halaman dimuat ulang dengan sukses.
        </div>
      )}
      {saveStatus.kind === 'error' && (
        <div className="bg-rose-600 text-white text-xs font-semibold px-4 py-2 text-center">
          ❌ Gagal menyimpan: {saveStatus.message}
        </div>
      )}
      {saveStatus.kind === 'ok' && (
        <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2 text-center">
          ✅ Tersimpan &amp; terverifikasi di Turso pukul {new Date(saveStatus.at).toLocaleTimeString('id-ID')} — {saveStatus.counts.rules} aturan, {saveStatus.counts.kaldikEvents} event, {saveStatus.counts.syllabusUnits} materi, {saveStatus.counts.syllabusScopes} scope
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Portal Home Tab */}
        {activeTab === 'home' && (
          <HomeTab
            db={db}
            viewerRole={viewerRole}
            setViewerRole={handleSetViewerRole}
            viewerId={viewerId}
            setViewerId={handleSetViewerId}
            onNavigateToJournal={handleNavigateToJournal}
            onNavigateToSyllabus={handleNavigateToSyllabus}
            onNavigateToSchedule={() => handleTabChange('studio')}
            onSelectTeacherSchedule={(teacherId) => {
              setStudioViewMode(ScheduleViewMode.TEACHER_WEEK);
              setStudioSelectedTeacherId(teacherId);
              try {
                localStorage.setItem('ijma_studio_view_mode', ScheduleViewMode.TEACHER_WEEK);
                localStorage.setItem('ijma_studio_selected_teacher', teacherId);
              } catch {}
              setViewerRole('teacher');
              setViewerId(teacherId);
              handleTabChange('studio');
            }}
            onSelectStudentSchedule={(classId) => {
              setStudioViewMode(ScheduleViewMode.STUDENT_WEEK);
              setStudioSelectedClassId(classId);
              try {
                localStorage.setItem('ijma_studio_view_mode', ScheduleViewMode.STUDENT_WEEK);
                localStorage.setItem('ijma_studio_selected_class', classId);
              } catch {}
              setViewerRole('student');
              setViewerId(classId);
              handleTabChange('studio');
            }}
            onNavigateToBooks={handleNavigateToBooks}
            onNavigateToAttendance={handleNavigateToAttendance}
            isAdmin={effectiveIsAdmin}
            pendingStore={attendancePendingStore}
            onUpdateDb={saveDatabase}
            onEditDisplayCode={handleStageDisplayCodeDraft}
          />
        )}

        {/* Enrollment & Roster Management Tab */}
        {activeTab === 'enrollment' && (
          <EnrollmentView
            db={db}
            isAdmin={effectiveIsAdmin}
            onOpenAdminLogin={handleOpenAdminLogin}
            onBackToPresensi={() => handleTabChange('journal')}
            onUpdateDb={saveDatabase}
          />
        )}

        {/* Kaldik Tab */}
        {activeTab === 'kaldik' && (
          <KaldikView
            db={db}
            onUpdateDb={saveDatabase}
            isAdmin={effectiveIsAdmin}
            onOpenAdminLogin={handleOpenAdminLogin}
            onNavigateToJournal={handleNavigateToJournal}
            onNavigateToBooks={handleNavigateToBooks}
            pendingStore={attendancePendingStore}
            initialMode={kaldikMode}
          />
        )}

        {/* Silabus Tab (Read-Only Kurikulum & Progres Pembelajaran) */}
        {activeTab === 'syllabus' && (
          <SyllabusView
            db={db}
            isAdmin={effectiveIsAdmin}

            pendingStore={attendancePendingStore}
            onUpdateDb={saveDatabase}
            viewerRole={viewerRole}
            setViewerRole={handleSetViewerRole}
            viewerId={viewerId}
            setViewerId={handleSetViewerId}
            initialSubjectId={journalNavParams?.subjectId}
            initialClassId={journalNavParams?.classId}
            highlightDate={journalNavParams?.date}
            onClearInitialDeepLink={() => setJournalNavParams(null)}
            onOpenAdminLogin={handleOpenAdminLogin}
            onNavigateToRuleManager={() => handleTabChange('rule-manager')}
            onNavigateToSyllabusScope={handleNavigateToSyllabusScope}
            onNavigateToBooks={handleNavigateToBooks}
          />
        )}

        {/* Main Tab: Jadwal (Calendar is hero view) */}
        {activeTab === 'studio' && (
          <UnifiedStudio
            db={db}
            onUpdateDb={saveDatabase}
            conflicts={conflicts}
            showRules={showRules}
            onToggleRules={setShowRules}
            editingRule={editingRule}
            prefill={slotPrefill}
            onSaveRule={handleSaveRule}
            onOpenNewRule={handleOpenNewRule}
            onOpenNewRuleForSlot={handleOpenNewRuleForSlot}
            onEditRule={handleEditRule}
            onDuplicateRule={handleDuplicateRule}
            onDeleteRule={handleDeleteRule}
            onToggleRuleActive={handleToggleRuleActive}
            onToggleSubjectRulesActive={handleToggleSubjectRulesActive}
            onViewConflict={() => handleTabChange('conflicts')}
            isAdmin={effectiveIsAdmin}
            onOpenAdminLogin={handleOpenAdminLogin}

            viewerRole={viewerRole}
            viewerId={viewerId}
            onViewerChange={(role, id) => {
              setViewerRole(role);
              setViewerId(id);
            }}
            activeViewMode={studioViewMode}
            onViewModeChange={(mode) => {
              setStudioViewMode(mode);
              try {
                localStorage.setItem('ijma_studio_view_mode', mode);
              } catch {}
              updateUrlRoute(activeTab, viewerRole, viewerId, 'replace', mode);
            }}
            selectedClassId={studioSelectedClassId}
            onSelectClassId={(id) => {
              setStudioSelectedClassId(id);
              try {
                localStorage.setItem('ijma_studio_selected_class', id);
              } catch {}
              setViewerRole('student');
              setViewerId(id);
            }}
            selectedTeacherId={studioSelectedTeacherId}
            onSelectTeacherId={(id) => {
              setStudioSelectedTeacherId(id);
              try {
                localStorage.setItem('ijma_studio_selected_teacher', id);
              } catch {}
              setViewerRole('teacher');
              setViewerId(id);
            }}
            selectedPeriodId={studioSelectedPeriodId}
            onSelectPeriodId={(id) => {
              setStudioSelectedPeriodId(id);
              try {
                localStorage.setItem('ijma_studio_selected_period', id);
              } catch {}
            }}
          />
        )}

        {/* Menu Tab: Pelajaran */}
        {activeTab === 'subjects' && (
          <SubjectsDirectory
            db={db}
            initialSelectedSubjectId={selectedSubjectId}
            onBackToSchedule={() => handleTabChange('studio')}
            onSelectSubject={(subjectId) => {
              handleNavigateToSyllabus(subjectId);
            }}
            onNavigateToSyllabusScope={handleNavigateToSyllabusScope}
            onSelectBook={(bookId) => {
              handleNavigateToBooks(bookId);
            }}
          />
        )}

        {/* Menu Tab: Buku & Kitab Acuan */}
        {activeTab === 'books' && (
          <BooksDirectory
            db={db}
            initialSelectedBookId={selectedBookId}
            onBackToSchedule={() => handleTabChange('studio')}
            onSelectSubject={(subjectId) => {
              handleNavigateToSubjects(subjectId);
            }}
            onNavigateToJournal={handleNavigateToJournal}
          />
        )}

        {/* Menu Tab: Guru */}
        {activeTab === 'teachers' && (
          <TeachersDirectory
            db={db}
            onBackToSchedule={() => handleTabChange('studio')}
            onEditTeacherDisplayCode={(id, next) => handleStageDisplayCodeDraft('teacher', id, next)}
            onSelectTeacherSchedule={(teacherId) => {
              setStudioViewMode(ScheduleViewMode.TEACHER_WEEK);
              setStudioSelectedTeacherId(teacherId);
              try {
                localStorage.setItem('ijma_studio_view_mode', ScheduleViewMode.TEACHER_WEEK);
                localStorage.setItem('ijma_studio_selected_teacher', teacherId);
              } catch {}
              setViewerRole('teacher');
              setViewerId(teacherId);
              handleTabChange('studio');
            }}
          />
        )}

        {/* Menu Tab: Santri */}
        {activeTab === 'students' && (
          <StudentsDirectory
            db={db}
            onBackToSchedule={() => handleTabChange('studio')}
            onEditStudentDisplayCode={(id, next) => handleStageDisplayCodeDraft('student', id, next)}
            onSelectStudentSchedule={(classId) => {
              setStudioViewMode(ScheduleViewMode.STUDENT_WEEK);
              setStudioSelectedClassId(classId);
              try {
                localStorage.setItem('ijma_studio_view_mode', ScheduleViewMode.STUDENT_WEEK);
                localStorage.setItem('ijma_studio_selected_class', classId);
              } catch {}
              setViewerRole('student');
              setViewerId(classId);
              handleTabChange('studio');
            }}
          />
        )}

        {/* Menu Tab: Conflict Inspector (3rd in menu) */}
        {activeTab === 'conflicts' && (
          <ConflictCenter
            conflicts={conflicts}
            db={db}
            onEditRule={handleEditRule}
            onToggleRuleActive={handleToggleRuleActive}
            onNavigateToCalendar={() => handleTabChange('studio')}
          />
        )}

        {/* Menu Tab: Rule Manager Studio (Aturan Jadwal, Event Kaldik, & Distribusi Silabus) */}
        {activeTab === 'rule-manager' && (
          <RuleManagerView
            db={db}
            onUpdateDb={(updater) => {
              if (!effectiveIsAdmin) return;
              const updated = updater(db);
              saveDatabase(updated);
            }}
            onEditRule={handleEditRule}
            onAddRule={handleAddRule}
            onToggleRuleActive={(ruleId) => {
              const rule = db.rules.find((r) => r.id === ruleId);
              if (rule) {
                handleToggleRuleActive(ruleId, !rule.active);
              }
            }}
            onDeleteRule={handleDeleteRule}
            isAdmin={effectiveIsAdmin}
            onOpenAdminLogin={handleOpenAdminLogin}
            onNavigateToJournal={handleNavigateToJournal}
            onNavigateToSchedule={() => handleTabChange('studio')}
            initialActivePanels={ruleManagerNavParams?.activePanels}
            initialSubjectId={ruleManagerNavParams?.subjectId}
            initialClassId={ruleManagerNavParams?.classId}
          />
        )}

        {/* Menu Tab: Basis Data */}
        {activeTab === 'database' && (
          <EntityManager
            db={db}
            initialSubTab={databaseSubTab}
            onSelectSubTab={setDatabaseSubTab}
            onUpdateDb={(updater) => {
              if (!effectiveIsAdmin) return;
              const updated = updater(db);
              saveDatabase(updated);
            }}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onEditRule={handleEditRule}
            onAddRule={handleAddRule}
            onToggleRuleActive={(ruleId) => {
              const rule = db.rules.find((r) => r.id === ruleId);
              if (rule) {
                handleToggleRuleActive(ruleId, !rule.active);
              }
            }}
            onDeleteRule={handleDeleteRule}
            onNavigateToExportImport={() => handleTabChange('export-import')}
            onNavigateToRuleManager={() => handleTabChange('rule-manager')}
            onNavigateToSchedule={() => handleTabChange('studio')}
            onNavigateToKaldik={() => handleTabChange('kaldik')}
            onNavigateToJournal={() => handleTabChange('journal')}
            isAdmin={effectiveIsAdmin}
            onOpenAdminLogin={handleOpenAdminLogin}
          />
        )}


        {/* Menu Tab: Ekspor & Impor Data */}
        {activeTab === 'export-import' && (
          <ExportImportView
            db={db}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onUpdateDb={(updater) => {
              if (!effectiveIsAdmin) return;
              const updated = updater(db);
              saveDatabase(updated);
            }}
            onBackToDatabase={() => handleTabChange('database')}
            onNavigateToSchedule={() => handleTabChange('studio')}
          />
        )}
      </main>

      {/* Rule Creator / Editor Modal with dynamic Exceptions (used outside studio) */}
      <RuleModal
        isOpen={isModalOpen && activeTab !== 'studio'}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(null);
          setSlotPrefill(undefined);
        }}
        onSave={handleSaveRule}
        onDelete={(ruleId) => {
          handleDeleteRule(ruleId);
          setIsModalOpen(false);
          setEditingRule(null);
        }}
        db={db}
        editingRule={editingRule}
        prefill={slotPrefill}
      />
    </div>
  );
}
