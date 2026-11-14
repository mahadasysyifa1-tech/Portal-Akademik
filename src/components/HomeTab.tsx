import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  UserRoundCheck,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  CalendarCheck2,
  Flame,
  Video,
  Book,
  Newspaper,
  Bell
} from 'lucide-react';
import { DatabaseState, SyllabusUnit, DayOfWeek, ScheduledSessionOccurrence, AttendanceSummaryItem } from '../types';
import { TeacherCard } from './directory/TeachersDirectory';
import { StudentCard } from './directory/StudentsDirectory';
import { PacingStatusBadge } from './syllabus/PacingStatusBadge';
import { AttendanceHistoryModal } from './directory/AttendanceHistoryModal';
import { ClassIcon } from './ClassIcon';
import {
  resolveViewerCurrentAndNextClass,
  formatUnitDisplay,
  getScheduledSessionsForSubjectClass,
  getViewerScheduledSessions,
  get_units_for_session,
  computePacingStatus,
  getScopedUnits
} from '../utils/pacingEngine';
import type { ViewerRole } from '../types/viewer';
import { AttendanceModal } from './attendance/AttendanceModal';
import { buildMeetingId } from '../utils/kaldikHelpers';
import {
  useAttendancePendingStore,
  type AttendancePendingStore
} from '../utils/useAttendancePendingStore';
import { useAuth } from '../context/AuthContext';


const DAY_LABELS: Record<DayOfWeek, string> = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
  Saturday: 'Sabtu',
  Sunday: 'Ahad'
};

interface HomeTabProps {
  db: DatabaseState;
  viewerRole: ViewerRole;
  setViewerRole: (role: ViewerRole) => void;
  viewerId: string;
  setViewerId: (id: string) => void;
  onNavigateToJournal: (subjectId: string, classId: string, date: string) => void;
  onNavigateToSyllabus?: (subjectId: string, classId: string, date?: string) => void;
  onNavigateToSchedule: () => void;
  onSelectTeacherSchedule?: (teacherId: string) => void;
  onSelectStudentSchedule?: (classId: string, studentId?: string) => void;
  onNavigateToBooks?: (bookId?: string) => void;
  onNavigateToAttendance?: (date: string, classId: string, sessionId: string, subjectId?: string) => void;
  isAdmin?: boolean;
  pendingStore?: AttendancePendingStore;
  onUpdateDb?: (updater: (prev: DatabaseState) => DatabaseState) => void;
  onEditDisplayCode?: (personType: 'teacher' | 'student', personId: string, nextDisplayCode: string) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  db,
  viewerRole,
  setViewerRole,
  viewerId,
  setViewerId,
  onNavigateToJournal,
  onNavigateToSyllabus,
  onNavigateToSchedule,
  onSelectTeacherSchedule,
  onSelectStudentSchedule,
  onNavigateToBooks,
  onNavigateToAttendance,
  isAdmin = false,
  pendingStore,
  onUpdateDb,
  onEditDisplayCode
}) => {
  const auth = useAuth();
  const effectiveIsAdmin = isAdmin || auth.isAdmin;

  const fallbackStore = useAttendancePendingStore();
  const store = pendingStore || fallbackStore;
  const [activeAttendanceOcc, setActiveAttendanceOcc] = useState<{
    occurrence: ScheduledSessionOccurrence;
    units: SyllabusUnit[];
  } | null>(null);

  // Attendance summary for Teacher / Student profile card
  const [summaryMap, setSummaryMap] = useState<Record<string, AttendanceSummaryItem>>({});
  const [activeHistoryModal, setActiveHistoryModal] = useState<{
    personType: 'teacher' | 'student';
    personId: string;
    personName: string;
    personSubtitle: string;
    summary?: AttendanceSummaryItem;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (auth.role === 'teacher') {
      fetch('/api/attendance/summary?type=teacher')
        .then((r) => r.json())
        .then((d) => {
          if (isMounted && d && typeof d === 'object') setSummaryMap(d);
        })
        .catch(() => {});
    } else if (auth.role === 'student') {
      fetch('/api/attendance/summary?type=student')
        .then((r) => r.json())
        .then((d) => {
          if (isMounted && d && typeof d === 'object') setSummaryMap(d);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [auth.role]);

  // Current Teacher Profile computation
  const myTeacher = useMemo(() => {
    if (auth.role !== 'teacher') return null;
    return (
      db.teachers.find((t) => t.id === auth.teacherId) ||
      db.teachers.find((t) => t.email && t.email.toLowerCase() === auth.user?.email?.toLowerCase()) ||
      null
    );
  }, [auth.role, auth.teacherId, auth.user, db.teachers]);

  // Compute teaching load from active rules (exact same as TeachersDirectory)
  const teacherStats = useMemo(() => {
    if (!myTeacher) return { sessions: 0, subjects: new Set<string>() };
    const stats = { sessions: 0, subjects: new Set<string>() };
    (db.rules || []).forEach((r) => {
      if (r.active && r.teacherId === myTeacher.id) {
        const daysCount = r.daysOfWeek?.length || 1;
        stats.sessions += daysCount;
        stats.subjects.add(r.subjectId);
      }
    });
    return stats;
  }, [myTeacher, db.rules]);

  const taughtSubjects = useMemo(() => {
    if (!myTeacher) return [];
    return Array.from(teacherStats.subjects).map((sid) => db.subjects.find((s) => s.id === sid)).filter(Boolean);
  }, [myTeacher, teacherStats, db.subjects]);

  // Current Student Profile computation
  const myStudent = useMemo(() => {
    if (auth.role !== 'student') return null;
    return (
      (db.students || []).find((s) => s.id === auth.studentId) ||
      (db.students || []).find((s) => s.email && s.email.toLowerCase() === auth.user?.email?.toLowerCase()) ||
      null
    );
  }, [auth.role, auth.studentId, auth.user, db.students]);

  // Compute student enrollments (exact same as StudentsDirectory)
  const studentEnrolledClasses = useMemo(() => {
    if (!myStudent) {
      if (viewerId) {
        const cls = db.classes.find((c) => c.id === viewerId);
        return cls ? [cls] : [];
      }
      return [];
    }
    const classIdSet = new Set<string>();
    if (myStudent.enrolledClassIds && Array.isArray(myStudent.enrolledClassIds)) {
      myStudent.enrolledClassIds.forEach((cid) => classIdSet.add(cid));
    }
    (db.enrollments || []).forEach((e: any) => {
      if (e.studentId === myStudent.id) {
        classIdSet.add(e.classId);
      }
    });
    if (myStudent.classId) {
      classIdSet.add(myStudent.classId);
    }
    const matched = db.classes.filter((c) => classIdSet.has(c.id));
    if (matched.length > 0) return matched;
    if (viewerId) {
      const directCls = db.classes.find((c) => c.id === viewerId);
      if (directCls) return [directCls];
    }
    return db.classes.slice(0, 1);
  }, [myStudent, db.enrollments, db.classes, viewerId]);


  const navigateToSyllabusTimeline = (subjectId: string, classId: string, date?: string) => {
    if (onNavigateToSyllabus) {
      onNavigateToSyllabus(subjectId, classId, date);
    } else {
      onNavigateToJournal(subjectId, classId, date || '');
    }
  };

  // Live ticker clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // refresh every 15s
    return () => clearInterval(timer);
  }, []);

  // Format today string
  const todayFormatted = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return currentTime.toLocaleDateString('id-ID', options);
  }, [currentTime]);

  const clockFormatted = useMemo(() => {
    return currentTime.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [currentTime]);

  // Resolve current and next class
  const resolved = useMemo(() => {
    return resolveViewerCurrentAndNextClass(db, viewerRole, viewerId, currentTime);
  }, [db, viewerRole, viewerId, currentTime]);

  const { currentClass, nextClass } = resolved;

  const currentClassEntity = useMemo(() => {
    if (!currentClass) return null;
    return db.classes.find((c) => c.id === currentClass.occurrence.classId) || null;
  }, [currentClass, db.classes]);

  const nextClassEntity = useMemo(() => {
    if (!nextClass) return null;
    return db.classes.find((c) => c.id === nextClass.occurrence.classId) || null;
  }, [nextClass, db.classes]);

  const bookMap = useMemo(() => new Map((db.books || []).map((b) => [b.id, b])), [db.books]);

  const currentClassColor = currentClassEntity?.color || currentClass?.classColor || '#E0E7FF';

  // Helper for computing countdown / time label
  const computeCountdownLabel = (occ: ScheduledSessionOccurrence, isToday: boolean) => {
    const [ny, nm, nd] = occ.date.split('-').map(Number);
    const [startH, startM] = (occ.startTime || '00:00').split(':').map(Number);
    const targetTime = new Date(ny, nm - 1, nd, startH, startM, 0);
    const diffMs = targetTime.getTime() - currentTime.getTime();

    if (diffMs <= 0) {
      return isToday ? 'Hari Ini (Segera)' : 'Segera';
    }

    const totalMinutes = Math.max(0, Math.round(diffMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    // Whenever diffMs is less than 24 hours: show countdown time instead of days
    if (diffMs < 24 * 3600 * 1000) {
      const timeStr = hours > 0
        ? `${hours} jam ${mins > 0 ? `${mins} mnt ` : ''}lagi`
        : `${mins} mnt lagi`;

      if (isToday) {
        return `Hari Ini (${timeStr})`;
      } else {
        return `Besok (${timeStr})`;
      }
    }

    // 24 hours or more: show days
    const todayMidnight = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
    const targetMidnight = new Date(ny, nm - 1, nd);
    const diffDays = Math.max(1, Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (24 * 3600 * 1000)));
    return `${diffDays} hari lagi`;
  };

  // Helper for computing pacing badge (delegates UI to shared PacingStatusBadge)
  const renderPacingBadge = (subjectId?: string, classId?: string) => {
    if (!subjectId || !classId) return null;
    const status = computePacingStatus(db, subjectId, classId);
    if (!status) return null;
    return <PacingStatusBadge status={status} variant="compact" />;
  };

  // Remaining time logic for single view
  const nextClassCountdownLabel = useMemo(() => {
    if (!nextClass) return '';
    return computeCountdownLabel(nextClass.occurrence, nextClass.isToday);
  }, [nextClass, currentTime]);

  // Active viewer label
  const viewerLabel = useMemo(() => {
    if (viewerRole === 'student') {
      const cls = db.classes.find((c) => c.id === viewerId);
      return cls ? `Kelas ${cls.name}` : 'peserta';
    } else if (viewerRole === 'teacher') {
      const tch = db.teachers.find((t) => t.id === viewerId);
      return tch ? `${tch.panggilan || tch.name}` : 'Guru/Ustadz';
    } else {
      return 'Admin Akademik (Semua Kelas)';
    }
  }, [viewerRole, viewerId, db.classes, db.teachers]);

  // Card limit for pagination in "Semua" view
  const [cardLimit, setCardLimit] = useState<number>(8);

  // Status for Semua view: sorted strictly by status (ongoing cards first, then upcoming cards)
  const { ongoingClassItems, upcomingClassItems } = useMemo(() => {
    if (viewerRole !== 'admin') {
      return { ongoingClassItems: [], upcomingClassItems: [] };
    }

    const ongoing: Array<{
      cls: any;
      currentClass: NonNullable<ReturnType<typeof resolveViewerCurrentAndNextClass>['currentClass']>;
    }> = [];

    const upcoming: Array<{
      cls: any;
      nextClass: NonNullable<ReturnType<typeof resolveViewerCurrentAndNextClass>['nextClass']>;
      targetTimeMs: number;
    }> = [];

    (db.classes || []).forEach((cls) => {
      const res = resolveViewerCurrentAndNextClass(db, 'student', cls.id, currentTime);
      if (res.currentClass) {
        ongoing.push({ cls, currentClass: res.currentClass });
      }
      if (res.nextClass) {
        const [ny, nm, nd] = res.nextClass.occurrence.date.split('-').map(Number);
        const [startH, startM] = (res.nextClass.occurrence.startTime || '00:00').split(':').map(Number);
        const targetTimeMs = new Date(ny, nm - 1, nd, startH, startM, 0).getTime();
        upcoming.push({ cls, nextClass: res.nextClass, targetTimeMs });
      }
    });

    // Sort upcoming classes chronologically: earliest first (regardless of whether today, tomorrow, or future)
    upcoming.sort((a, b) => a.targetTimeMs - b.targetTimeMs);

    return { ongoingClassItems: ongoing, upcomingClassItems: upcoming };
  }, [db, viewerRole, currentTime]);

  // Universal Card 1: Current Class (active/live)
  const renderCurrentClassCard = (
    cClass: NonNullable<ReturnType<typeof resolveViewerCurrentAndNextClass>['currentClass']>,
    clsEntity: any,
    key?: string
  ) => {
    const cColor = clsEntity?.color || cClass.classColor || '#E0E7FF';
    return (
      <div
        key={key || cClass.occurrence.id}
        className="rounded-3xl border-2 p-5 sm:p-6 transition-all relative overflow-hidden flex flex-col justify-between shadow-md"
        style={{
          borderColor: cColor,
          background: `linear-gradient(135deg, #FFFFFF 0%, ${cColor} 100%)`,
          boxShadow: `0 4px 20px -2px ${cColor}66`
        }}
      >
        <div>
          {/* Header / Status pill */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full animate-ping shrink-0 bg-emerald-500" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                Kelas Berlangsung Saat Ini
              </span>
            </div>

            {cClass.timeRemainingMinutes !== undefined && (
              <span
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs text-slate-800"
                style={{
                  backgroundColor: cColor,
                  borderColor: 'rgba(0, 0, 0, 0.15)'
                }}
              >
                Tersisa ~{cClass.timeRemainingMinutes} mnt
              </span>
            )}
          </div>

          <div className="space-y-3.5">
            {/* Subject & Counterpart */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: cClass.subjectColor }}
                />
                <h3 className="text-base inline-flex gap-1.5 sm:text-lg font-bold text-slate-900 leading-tight">
                  {cClass.subjectName}
                  {cClass.subjectBook && (
                    <span className="text-slate-500 font-semibold"> ({cClass.subjectBook})</span>
                  )}
                  {/* Class Badge with Class Database Color & Icon */}
                  {clsEntity && (
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold border flex items-center gap-1.5 text-slate-800 shadow-2xs"
                      style={{
                        backgroundColor: cColor,
                        borderColor: 'rgba(0, 0, 0, 0.15)'
                      }}
                    >
                      <ClassIcon name={clsEntity.icon || 'GraduationCap'} className="w-3 h-3" />
                      <span className="text-sm">{clsEntity.name}</span>
                    </span>
                  )}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-5">
                <p className="text-xs font-semibold text-slate-600">
                  {viewerRole === 'student' ? 'Pengampu: ' : ''}
                  <span className="text-slate-900 font-bold">
                    {viewerRole === 'teacher' ? '' : cClass.counterpartLabel}
                  </span>
                </p>
              </div>
            </div>

            {/* Timing & Location */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 bg-white/85 backdrop-blur-xs p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-slate-600" />
                <span>
                  {cClass.occurrence.startTime} - {cClass.occurrence.endTime} (
                  {cClass.occurrence.sessionName})
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{cClass.roomName}</span>
              </div>
              <div>
                {/* Online Class Link clickable icon */}
                {clsEntity?.onlineClassLink && (
                  <a
                    href={clsEntity.onlineClassLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs cursor-pointer ml-auto"
                    title={`Buka Kelas Online: ${clsEntity.onlineClassLink}`}
                  >
                    <Video className="w-4 h-4" />
                    <span>online</span>
                  </a>
                )}
              </div>
            </div>

            {/* Material rendered via get_units_for_session */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    navigateToSyllabusTimeline(
                      cClass.occurrence.subjectId,
                      cClass.occurrence.classId,
                      cClass.occurrence.date
                    )
                  }
                  className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-800 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                  title="Klik untuk membuka Silabus & Timeline Pembelajaran"
                >
                  <span>Materi Silabus Sesi Ini</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
              </div>

              {cClass.units.length === 0 ? (
                <div className="text-xs text-slate-400 italic p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  (Pembahasan Mandiri / Sesi Latihan Soal)
                </div>
              ) : (
                <div className="space-y-1.5">
                  {cClass.units.map((unit) => (
                    <div
                      key={unit.id}
                      onClick={() =>
                        navigateToSyllabusTimeline(
                          cClass.occurrence.subjectId,
                          cClass.occurrence.classId,
                          cClass.occurrence.date
                        )
                      }
                      className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border text-slate-900 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors group shadow-2xs"
                      style={{
                        borderColor: `${cColor}99`
                      }}
                      title="Klik untuk membuka materi pada Silabus & Timeline"
                    >
                      {/* Left: (bullet) (book) (material) */}
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <span
                          className="w-2 h-2 rounded-full shrink-0 mt-1"
                          style={{ backgroundColor: cColor }}
                        />
                        {(() => {
                          const bId = unit.bookId || (db.subjects.find((s) => s.id === cClass.occurrence.subjectId) as any)?.default_book || (db.subjects.find((s) => s.id === cClass.occurrence.subjectId) as any)?.defaultBookId;
                          const book = bId ? bookMap.get(bId) : null;
                          if (!book) return null;
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToBooks?.(book.id);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer shrink-0"
                              title={`Kitab: ${book.title}${book.altTitle ? ` (${book.altTitle})` : ''} • Klik untuk melihat info kitab`}
                            >
                              <Book className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span className="truncate max-w-[110px] sm:max-w-[150px]">
                                {book.displayCode || book.altTitle || book.title}
                              </span>
                            </button>
                          );
                        })()}
                        <span className="break-words leading-snug">
                          {formatUnitDisplay(unit)}
                        </span>
                      </div>

                      {/* Right: page numbers */}
                      <div className="flex items-center gap-1 shrink-0">
                        {unit.isPartialStart && (
                          <ArrowRight
                            className="w-3 h-3 text-amber-500 shrink-0"
                            title={`Lanjutan dari sesi sebelumnya (mulai hal. ${unit.page_start} dari total hal. ${unit.raw_page_start}–${unit.raw_page_end})`}
                          />
                        )}
                        <span className="text-[10px] font-mono text-slate-700 shrink-0 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                          {String(unit.page_start) === String(unit.page_end)
                            ? `hal. ${unit.page_start}`
                            : `hal. ${unit.page_start}-${unit.page_end}`}
                        </span>
                        {unit.isPartialEnd && (
                          <ArrowRight
                            className="w-3 h-3 text-amber-500 shrink-0"
                            title={`Bersambung ke sesi berikutnya (sampai hal. ${unit.page_end} dari total hal. ${unit.raw_page_start}–${unit.raw_page_end})`}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deep link action button */}
        <div
          className="mt-5 pt-3.5 border-t flex items-center justify-between flex-wrap gap-2"
          style={{ borderColor: `${cColor}55` }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-700 font-semibold">
              {cClass.occurrence.meetingIndex > 0 ? `Pertemuan #${cClass.occurrence.meetingIndex}` : 'Sesi Dibatalkan'}
            </span>
            {renderPacingBadge(cClass.occurrence.subjectId, cClass.occurrence.classId)}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveAttendanceOcc({
                  occurrence: cClass.occurrence,
                  units: cClass.units
                })
              }
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border shadow-2xs transition-all cursor-pointer ${
                auth.canEditSession(cClass.occurrence.teacherId)
                  ? 'text-amber-900 bg-amber-50 hover:bg-amber-100 border-amber-300'
                  : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-300'
              }`}
              title={auth.canEditSession(cClass.occurrence.teacherId) ? 'Catat Presensi Kelas Ini' : 'Lihat Presensi (Hanya Ustadz Pengampu / Admin yang dapat mengedit)'}
            >
              <UserRoundCheck className={`w-3.5 h-3.5 ${auth.canEditSession(cClass.occurrence.teacherId) ? 'text-amber-600' : 'text-slate-500'}`} />
              <span>{auth.canEditSession(cClass.occurrence.teacherId) ? 'Isi Absen' : 'Lihat Presensi'}</span>
            </button>
          </div>
        </div>
      </div>

    );
  };

  // Universal Card 2: Next Class
  const renderNextClassCard = (
    nClass: NonNullable<ReturnType<typeof resolveViewerCurrentAndNextClass>['nextClass']>,
    clsEntity: any,
    key?: string
  ) => {
    const countdownLabel = computeCountdownLabel(nClass.occurrence, nClass.isToday);

    return (
      <div
        key={key || nClass.occurrence.id}
        className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
      >
        <div>
          {/* Header / Status pill */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Kelas Berikutnya
              </span>
            </div>

            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                nClass.isToday
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {countdownLabel}
            </span>
          </div>

          <div className="space-y-3.5">
            {/* Subject & Counterpart */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: nClass.subjectColor }}
                />
                <h3 className="text-base inline-flex gap-1.5 sm:text-lg font-bold text-slate-900 leading-tight">
                  {nClass.subjectName}
                  {nClass.subjectBook && (
                    <span className="text-slate-500 font-semibold"> ({nClass.subjectBook})</span>
                  )}
                  {/* Class Badge */}
                  {clsEntity && (
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold flex mb-1 border items-center gap-1.5 text-slate-800 shadow-2xs"
                      style={{
                        backgroundColor: clsEntity.color || '#E0E7FF',
                        borderColor: 'rgba(0, 0, 0, 0.15)'
                      }}
                    >
                      <ClassIcon name={clsEntity.icon || 'GraduationCap'} className="w-3 h-3" />
                      <span className="text-sm">{clsEntity.name}</span>
                    </span>
                  )}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-5">
                <p className="text-xs font-semibold text-slate-600">
                  {viewerRole === 'student' ? 'Pengampu: ' : ''}
                  <span className="text-slate-900 font-bold">
                    {viewerRole === 'teacher' ? '' : nClass.counterpartLabel}
                  </span>
                </p>
              </div>
            </div>

            {/* Timing & Location */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-1.5 font-medium">
                <CalendarIcon className="w-4 h-4 text-emerald-600" />
                <span>
                  {DAY_LABELS[nClass.occurrence.day] || nClass.occurrence.day}, {nClass.occurrence.date}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>
                  {nClass.occurrence.startTime} - {nClass.occurrence.endTime}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{nClass.roomName}</span>
              </div>
              <div>
                {/* Online Class Link clickable icon */}
                {clsEntity?.onlineClassLink && (
                  <a
                    href={clsEntity.onlineClassLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs cursor-pointer ml-auto"
                    title={`Buka Kelas Online: ${clsEntity.onlineClassLink}`}
                  >
                    <Video className="w-3 h-3" />
                    <span>online</span>
                  </a>
                )}
              </div>
            </div>

            {/* Material rendered via get_units_for_session */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    navigateToSyllabusTimeline(
                      nClass.occurrence.subjectId,
                      nClass.occurrence.classId,
                      nClass.occurrence.date
                    )
                  }
                  className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                  title="Klik untuk membuka Silabus & Timeline Pembelajaran"
                >
                  <span>Materi Target Sesi Ini</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
              </div>

              {nClass.units.length === 0 ? (
                <div className="text-xs text-slate-400 italic p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  (Pembahasan Mandiri / Sesi Praktikum)
                </div>
              ) : (
                <div className="space-y-1.5">
                  {nClass.units.map((unit) => (
                    <div
                      key={unit.id}
                      onClick={() =>
                        navigateToSyllabusTimeline(
                          nClass.occurrence.subjectId,
                          nClass.occurrence.classId,
                          nClass.occurrence.date
                        )
                      }
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-800 hover:text-emerald-950 text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                      title="Klik untuk membuka materi pada Silabus & Timeline"
                    >
                      {/* Left: (bullet) (book) (material) */}
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                        {(() => {
                          const bId = unit.bookId || (db.subjects.find((s) => s.id === nClass.occurrence.subjectId) as any)?.default_book || (db.subjects.find((s) => s.id === nClass.occurrence.subjectId) as any)?.defaultBookId;
                          const book = bId ? bookMap.get(bId) : null;
                          if (!book) return null;
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToBooks?.(book.id);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer shrink-0"
                              title={`Kitab: ${book.title}${book.altTitle ? ` (${book.altTitle})` : ''} • Klik untuk melihat info kitab`}
                            >
                              <Book className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span className="truncate max-w-[110px] sm:max-w-[150px]">
                                {book.displayCode || book.altTitle || book.title}
                              </span>
                            </button>
                          );
                        })()}
                        <span className="break-words leading-snug">
                          {formatUnitDisplay(unit)}
                        </span>
                      </div>

                      {/* Right: page numbers */}
                      <div className="flex items-center gap-1 shrink-0">
                        {unit.isPartialStart && (
                          <ArrowRight
                            className="w-3 h-3 text-amber-500 shrink-0"
                            title={`Lanjutan dari sesi sebelumnya (mulai hal. ${unit.page_start} dari total hal. ${unit.raw_page_start}–${unit.raw_page_end})`}
                          />
                        )}
                        <span className="text-[10px] font-mono text-slate-500 shrink-0 px-1.5 py-0.5 rounded bg-white border border-slate-200 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          {String(unit.page_start) === String(unit.page_end)
                            ? `hal. ${unit.page_start}`
                            : `hal. ${unit.page_start}-${unit.page_end}`}
                        </span>
                        {unit.isPartialEnd && (
                          <ArrowRight
                            className="w-3 h-3 text-amber-500 shrink-0"
                            title={`Bersambung ke sesi berikutnya (sampai hal. ${unit.page_end} dari total hal. ${unit.raw_page_start}–${unit.raw_page_end})`}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deep link action button */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500 font-semibold">
              {nClass.occurrence.meetingIndex > 0 ? `Pertemuan #${nClass.occurrence.meetingIndex}` : 'Sesi Dibatalkan'}
            </span>
            {renderPacingBadge(nClass.occurrence.subjectId, nClass.occurrence.classId)}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveAttendanceOcc({
                  occurrence: nClass.occurrence,
                  units: nClass.units
                })
              }
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border shadow-2xs transition-all cursor-pointer ${
                auth.canEditSession(nClass.occurrence.teacherId)
                  ? 'text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
                  : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-300'
              }`}
              title={auth.canEditSession(nClass.occurrence.teacherId) ? 'Catat Presensi Kelas Ini' : 'Lihat Presensi (Hanya Ustadz Pengampu / Admin yang dapat mengedit)'}
            >
              <UserRoundCheck className={`w-3.5 h-3.5 ${auth.canEditSession(nClass.occurrence.teacherId) ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span>{auth.canEditSession(nClass.occurrence.teacherId) ? 'Isi Absen' : 'Lihat Presensi'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Universal Empty Next Card
  const renderEmptyNextCard = (clsEntity?: any, key?: string) => (
    <div
      key={key}
      className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Kelas Berikutnya
          </span>
          {clsEntity && (
            <span
              className="px-2 py-0.5 rounded-md text-[11px] font-bold flex border items-center gap-1.5 text-slate-800 shadow-2xs"
              style={{
                backgroundColor: clsEntity.color || '#E0E7FF',
                borderColor: 'rgba(0, 0, 0, 0.15)'
              }}
            >
              <ClassIcon name={clsEntity.icon || 'GraduationCap'} className="w-3 h-3" />
              <span className="text-sm">{clsEntity.name}</span>
            </span>
          )}
        </div>
        <div className="py-8 text-center text-slate-400 space-y-2">
          <CalendarCheck2 className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-xs font-medium text-slate-500 max-w-xs mx-auto">
            Tidak ada kelas berikutnya yang dijadwalkan dalam periode kalender akademik.
          </p>
        </div>
      </div>
    </div>
  );

  // Guest View: Announcement & Official News (no deep links per user requirement)
  if (auth.role === 'guest') {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Sticky Top Header Bar */}
        <div className="sticky top-14 z-20 backdrop-blur-md bg-white/95 rounded-2xl border border-slate-200/90 shadow-md p-3.5 sm:px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                Selamat Datang di Portal IJMA
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono font-medium text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{clockFormatted} WIB</span>
              <span>·</span>
              <span>{todayFormatted}</span>
            </div>
          </div>
        </div>

        {/* Guest News & Announcements Dashboard */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-amber-600" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Warta &amp; Pengumuman Resmi
              </h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Rilis Terbaru
            </span>
          </div>

          {/* Featured Announcement Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                Pengumuman Resmi
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">{todayFormatted}</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug mb-3">
              Aplikasi resmi IJMA sudah resmi rilis
            </h3>

            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Alhamdulillah bini'matihi tatimmus shaalihaat, aplikasi sistem informasi akademik dan kurikulum terpadu Ma'had IJMA (I'dad Jami'iy Ma'had Asy-Syifa) kini telah resmi dirilis. Pengunjung dapat melihat kalender akademik, jadwal umum, dan direktori referensi kitab ajar melalui menu navigasi di atas.
            </p>

            <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                  <Bell className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 mb-1">
                    Pengajuan Akses Ustadz &amp; Santri
                  </h4>
                  <p className="text-xs text-amber-800/90 leading-relaxed">
                    Bagi Guru/Ustadz pengampu atau Santri Ma'had IJMA, silakan gunakan tombol profil di pojok kanan atas untuk mengajukan verifikasi peranan akun Anda kepada Administrator.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Sticky Viewer Selector & Status Floating Bar */}
      <div className="sticky p-2 top-26 z-20 bg-slate-900/40 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

          {/* Role Switcher: Only for Admin */}
          {effectiveIsAdmin ? (
            <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-200 flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewerRole('student');
                    if (!viewerId && db.classes.length > 0) setViewerId(db.classes[0].id);
                  }}
                  className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    viewerRole === 'student'
                      ? 'bg-white text-amber-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Peserta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewerRole('teacher');
                    if (!viewerId && db.teachers.length > 0) setViewerId(db.teachers[0].id);
                  }}
                  className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    viewerRole === 'teacher'
                      ? 'bg-white text-amber-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ustadz
                </button>
                <button
                  type="button"
                  onClick={() => setViewerRole('admin')}
                  className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    viewerRole === 'admin'
                      ? 'bg-white text-amber-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua
                </button>
              </div>

              {/* Selector dropdown for Class or Teacher */}
              {viewerRole === 'student' && (
                <select
                  value={viewerId || db.classes[0]?.id}
                  onChange={(e) => setViewerId(e.target.value)}
                  className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-800"
                >
                  {db.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas: {c.name}
                    </option>
                  ))}
                </select>
              )}

              {viewerRole === 'teacher' && (
                <select
                  value={viewerId || db.teachers[0]?.id}
                  onChange={(e) => setViewerId(e.target.value)}
                  className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-800"
                >
                  {db.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.panggilan || t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {auth.role === 'teacher' ? (
                <div className="flex justify-between">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Halaman Anda: {viewerLabel}</span>
                  </div>
                  <span className="text-[8px] text-slate-100 font-mono font-medium">
                    <p>{clockFormatted} WIB</p><p>{todayFormatted}</p>
                  </span>
                </div>
              ) : auth.role === 'student' ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>Halaman Anda: {viewerLabel}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Profile Card for Authenticated Teacher or Student before Agenda */}
      {auth.role === 'teacher' && myTeacher && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <TeacherCard
              teacher={myTeacher}
              stats={teacherStats}
              taughtSubjects={taughtSubjects}
              summary={summaryMap[myTeacher.id]}
              canEditDisplayCode={Boolean(
                onEditDisplayCode && (effectiveIsAdmin || (auth.isTeacher && auth.teacherId === myTeacher.id))
              )}
              onEditDisplayCode={(id, next) => onEditDisplayCode?.('teacher', id, next)}
              onOpenHistory={(teacher) => {
                setActiveHistoryModal({
                  personType: 'teacher',
                  personId: teacher.id,
                  personName: teacher.name,
                  personSubtitle: teacher.department || 'Pengajar',
                  summary: summaryMap[teacher.id]
                });
              }}
              onSelectSchedule={(teacherId) => {
                if (onSelectTeacherSchedule) {
                  onSelectTeacherSchedule(teacherId);
                } else {
                  onNavigateToSchedule();
                }
              }}
            />
          </div>
        </div>
      )}

      {auth.role === 'student' && myStudent && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <StudentCard
              student={myStudent}
              enrolledClasses={studentEnrolledClasses}
              summary={summaryMap[myStudent.id]}
              canEditDisplayCode={Boolean(
                onEditDisplayCode && (effectiveIsAdmin || (auth.isStudent && auth.studentId === myStudent.id))
              )}
              onEditDisplayCode={(id, next) => onEditDisplayCode?.('student', id, next)}
              onOpenHistory={(student) => {
                setActiveHistoryModal({
                  personType: 'student',
                  personId: student.id,
                  personName: student.name,
                  personSubtitle: `NISN: ${student.nisn || student.id}`,
                  summary: summaryMap[student.id]
                });
              }}
              onSelectSchedule={(classId, studentId) => {
                if (onSelectStudentSchedule) {
                  onSelectStudentSchedule(classId, studentId);
                } else {
                  onNavigateToSchedule();
                }
              }}
            />
          </div>
        </div>
      )}

      {/* SEMUA VIEW vs SINGLE VIEW */}
      {viewerRole === 'admin' ? (
        <div className="space-y-6">
          {/* 1. ONGOING SESSIONS SECTION */}
          {ongoingClassItems.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                  Berlangsung ({ongoingClassItems.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {ongoingClassItems.map(({ cls, currentClass: cCls }) =>
                  renderCurrentClassCard(cCls, cls, `curr-${cls.id}`)
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-500">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-xs font-medium">
                Tidak ada kelas aktif saat ini di semua rombel.
              </p>
            </div>
          )}

          {/* 2. UPCOMING SESSIONS SECTION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                  Berikutnya ({upcomingClassItems.length})
                </h2>
              </div>
            </div>

            {upcomingClassItems.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-slate-400">
                <CalendarCheck2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">Tidak ada jadwal kelas berikutnya</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {upcomingClassItems.slice(0, cardLimit).map(({ cls, nextClass: nCls }) =>
                  renderNextClassCard(nCls, cls, `next-${cls.id}`)
                )}
              </div>
            )}

            {/* Pagination for upcoming cards */}
            {upcomingClassItems.length > 8 && (
              <div className="flex justify-center pt-2">
                {cardLimit < upcomingClassItems.length ? (
                  <button
                    type="button"
                    onClick={() => setCardLimit((prev) => prev + 8)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 shadow-2xs transition-all cursor-pointer"
                  >
                    <span>Tampilkan Lebih Banyak (+8 Kelas)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono">
                      {Math.min(cardLimit, upcomingClassItems.length)} / {upcomingClassItems.length}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCardLimit(8)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-900 shadow-2xs transition-all cursor-pointer"
                  >
                    <span>Tampilkan Lebih Sedikit</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* CURRENT CLASS: small notif when nothing is active, full card when a class is live */}
          {!currentClass && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-500">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-xs font-medium">
                Tidak ada kelas aktif saat ini untuk {viewerLabel}.
              </p>
            </div>
          )}

          {/* TWO PRIMARY FOCUS CARDS: CURRENT CLASS & NEXT CLASS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {currentClass && renderCurrentClassCard(currentClass, currentClassEntity)}
            {nextClass
              ? renderNextClassCard(nextClass, nextClassEntity)
              : renderEmptyNextCard(currentClassEntity)}
          </div>
        </>
      )}

      {/* QUICK SHORTCUTS TO STUDIO & JOURNAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={onNavigateToSchedule}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                Buka Kalender Jadwal Lengkap
              </h4>
              <p className="text-xs text-slate-500">
                Lihat matriks jadwal mingguan dan rotasi sesi per kelas
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
        </div>

        <div
          onClick={() => {
            onNavigateToJournal('', '', '');
          }}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                Jelajahi Jurnal Pembelajaran
              </h4>
              <p className="text-xs text-slate-500">
                Telusuri target materi kurikulum dan silabus per mata kuliah
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      {/* In-Place Attendance Overlay Modal */}
      {activeAttendanceOcc && (() => {
        const { occurrence, units } = activeAttendanceOcc;
        const meetingId = buildMeetingId(
          occurrence.date,
          occurrence.classId,
          occurrence.sessionId,
          occurrence.id?.startsWith('mtg-') ? occurrence.id : undefined
        );
        const scopedUnits = getScopedUnits(db, occurrence.subjectId, occurrence.classId);
        const titles = units.map((u) => u.title).join(', ');
        const lastUnit = units[units.length - 1] || scopedUnits[0];
        const maxPage = lastUnit?.page_end ?? lastUnit?.page_start;
        const targetPage = typeof maxPage === 'number' ? maxPage : parseInt(String(maxPage), 10) || undefined;
        const sessionObj = db.sessions.find((s) => s.id === occurrence.sessionId);
        const classObj = db.classes.find((c) => c.id === occurrence.classId);

        const parts = occurrence.date.split('-');
        let formattedDate = occurrence.date;
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          formattedDate = `${DAY_LABELS[occurrence.day] || occurrence.day}, ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        }

        const canEditModal = effectiveIsAdmin || auth.canEditSession(occurrence.teacherId);

        return (
          <AttendanceModal
            key={meetingId}
            isAdmin={canEditModal}
            meetingId={meetingId}

            meetingNumber={occurrence.meetingIndex}
            isOpen={true}
            onClose={() => setActiveAttendanceOcc(null)}
            initialDraft={store.getRollCallDraft(meetingId)}
            onSaveDraft={(payload, options) => {
              const isSessionCancelled =
                options?.preserveCancelled ??
                store.getEffectiveStatus(meetingId, occurrence.status) === 'cancelled';
              store.setRollCallDraft(meetingId, payload, { preserveCancelled: isSessionCancelled });
              store.syncMeetingDraftToDb(onUpdateDb, meetingId, payload, {
                meeting_date: occurrence.date,
                meeting_index: occurrence.meetingIndex,
                class_id: occurrence.classId,
                subject_id: occurrence.subjectId,
                teacher_id: occurrence.teacherId,
                room_id: occurrence.roomId,
                session_id: occurrence.sessionId,
                status: isSessionCancelled ? 'cancelled' : (occurrence.status || 'scheduled'),
              });
            }}
            onDiscardDraft={() => {
              store.discardDraft(meetingId);
              store.restoreMeetingDraftInDb(onUpdateDb, meetingId);
            }}
            getEffectiveStatus={store.getEffectiveStatus}
            hasDraft={store.isMeetingDrafted(meetingId)}
            onSetSessionStatus={(id, next) => store.setSessionStatusDraft(id, next)}
            targetMateri={titles || scopedUnits[0]?.title || undefined}
            targetHal={targetPage}
            targetUnitId={units[0]?.id || scopedUnits[0]?.id}
            availableUnits={scopedUnits}
            sessionTitle={sessionObj?.name || occurrence.sessionName}
            classTitle={classObj?.name}
            formattedDate={formattedDate}
          />
        );
      })()}

      {/* Teacher / Student Attendance History Detail Modal */}
      {activeHistoryModal && (
        <AttendanceHistoryModal
          isOpen={true}
          onClose={() => setActiveHistoryModal(null)}
          personType={activeHistoryModal.personType}
          personId={activeHistoryModal.personId}
          personName={activeHistoryModal.personName}
          personSubtitle={activeHistoryModal.personSubtitle}
          initialSummary={activeHistoryModal.summary}
        />
      )}
    </div>
  );
};
