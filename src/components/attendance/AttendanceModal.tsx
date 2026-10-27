import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  AlertCircle,
  Clock,
  Trash,
  Ban,
  ChevronUp,
  ChevronDown,
  Search,
  BookOpen,
  UserCheck,
  Pencil
} from 'lucide-react';
import type {
  AttendanceStatus,
  AttendanceRollCallData,
  AttendanceRollCallStudent,
} from '../../types';
import type { PendingRollCallLog } from '../../utils/useAttendancePendingStore';
import { getCachedRollCall } from '../../utils/rollCallCache';

export interface AttendanceModalProps {
  meetingId: string;
  isOpen: boolean;
  hasDraft: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  onSaved?: () => void;
  targetMateri?: string;
  targetHal?: number | string;
  targetUnitId?: string;
  availableUnits?: Array<{
    id: string;
    title: string;
    pageStart?: number | string;
    pageEnd?: number | string;
    page_start?: number | string;
    page_end?: number | string;
  }>;
  initialDraft?: PendingRollCallLog;
  onSaveDraft?: (draftPayload: any) => void;
  onDiscardDraft?: (meetingId: string) => void;
  getEffectiveStatus?: (meetingId: string, dbStatus: string) => string;
  onSetSessionStatus?: (meetingId: string, status: 'scheduled' | 'cancelled') => void;
  onPrevSession?: () => void;
  onNextSession?: () => void;
  hasPrevSession?: boolean;
  hasNextSession?: boolean;
  sessionTitle?: string;
  classTitle?: string;
  formattedDate?: string;
}

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string; activeClass: string }> = [
  { value: 'Hadir', label: 'Hadir', activeClass: 'bg-emerald-600 text-white font-bold' },
  { value: 'Terlambat', label: 'Terlambat', activeClass: 'bg-teal-600 text-white font-bold' },
  { value: 'Izin', label: 'Izin', activeClass: 'bg-rose-500 text-white font-bold' },
  { value: 'Alpa', label: 'Alpa', activeClass: 'bg-rose-700 text-white font-bold' },
];

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  meetingId,
  isOpen,
  hasDraft,
  isAdmin = true,
  onClose,
  targetMateri = '',
  targetHal,
  availableUnits = [],
  targetUnitId,
  initialDraft,
  onSaveDraft,
  onDiscardDraft,
  getEffectiveStatus,
  onSetSessionStatus,
  onPrevSession,
  onNextSession,
  hasPrevSession = false,
  hasNextSession = false,
  sessionTitle,
  classTitle,
  formattedDate
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AttendanceRollCallData | null>(null);

  // Editable local state
  const [teacherStatus, setTeacherStatus] = useState<AttendanceStatus | null>(null);
  const [teacherTime, setTeacherTime] = useState<string>('');
  const [teacherTimeEnd, setTeacherTimeEnd] = useState<string>('');
  const [teacherNote, setTeacherNote] = useState<string>('');
  const [meetingNotes, setMeetingNotes] = useState<string>('');
  const [students, setStudents] = useState<AttendanceRollCallStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Minimal material progress state (reflects DB by default, blank if no record)
  const [materi, setMateri] = useState<string>('');
  const [hal, setHal] = useState<string | number>('');

  // Micro time popover state
  const [activeTimePopover, setActiveTimePopover] = useState<{
    type: 'teacher' | 'student';
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Visual flash feedback on auto-stamping
  const [flashingRowId, setFlashingRowId] = useState<string | null>(null);
  const flashTimerRef = useRef<any>(null);

  const baselineRef = useRef<string | null>(null);
  const baselineSnapshotRef = useRef<{
    teacherStatus: AttendanceStatus | null;
    teacherTime: string;
    teacherTimeEnd: string;
    teacherNote: string;
    students: AttendanceRollCallStudent[];
    meetingNotes: string;
    materi: string;
    hal: string | number;
  } | null>(null);

  const lastDraftRef = useRef<{ id: string; json: string } | null>(null);
  const draftAppliedFor = useRef<string | null>(null);

  // Dynamic Theme calculations
  const serverStatus = data?.meeting?.status || 'scheduled';
  const effectiveStatus = getEffectiveStatus ? getEffectiveStatus(meetingId, serverStatus) : serverStatus;
  const isCancelled = effectiveStatus === 'cancelled';

  // Fixed field order for baseline serialization
  const serializeState = (s: Record<string, any>) =>
    JSON.stringify([
      s.teacherStatus,
      s.teacherTime,
      s.teacherTimeEnd,
      s.teacherNote,
      s.students,
      s.meetingNotes,
      s.materi,
      s.hal
    ]);

  const triggerFlash = (id: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashingRowId(id);
    flashTimerRef.current = setTimeout(() => {
      setFlashingRowId(null);
    }, 800);
  };

  const buildDraftPayload = () => ({
    teacherLog: {
      id: data?.teacher.id || '',
      status: teacherStatus,
      timestampStart: teacherTime,
      timestampEnd: teacherTimeEnd,
      note: teacherNote,
    },
    studentLogs: students.map((s) => ({
      studentId: s.studentId,
      status: s.status,
      timestampStart: s.timestampStart,
      timestampEnd: s.timestampEnd,
      note: s.note,
    })),
    meetingNotes,
    materialProgress: {
      unitId: materi || undefined,
      materi: materi || undefined,
      hal: hal !== '' && hal !== undefined && !isNaN(Number(hal)) ? Number(hal) : undefined,
    },
  });

  // Live auto-save draft whenever values diverge from baseline (only for admin)
  useEffect(() => {
    if (!isOpen || !meetingId || loading || baselineRef.current === null || !isAdmin) return;
    const current = serializeState({
      teacherStatus,
      teacherTime,
      teacherTimeEnd,
      teacherNote,
      students,
      meetingNotes,
      materi,
      hal
    });

    if (current === baselineRef.current) {
      if (lastDraftRef.current && lastDraftRef.current.id === meetingId) {
        lastDraftRef.current = null;
        onDiscardDraft?.(meetingId);
      }
    } else {
      if (!lastDraftRef.current || lastDraftRef.current.id !== meetingId || lastDraftRef.current.json !== current) {
        lastDraftRef.current = { id: meetingId, json: current };
        onSaveDraft?.(buildDraftPayload());
      }
    }
  }, [
    teacherStatus,
    teacherTime,
    teacherTimeEnd,
    teacherNote,
    students,
    meetingNotes,
    materi,
    hal,
    isOpen,
    meetingId,
    loading,
    isAdmin
  ]);

  // Load meeting data
  useEffect(() => {
    if (!isOpen || !meetingId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    draftAppliedFor.current = null;
    baselineRef.current = null;

    const cached = getCachedRollCall(meetingId);
    if (cached) {
      applyData(cached);
      setLoading(false);
      return;
    }

    fetch(`/api/attendance/meetings/${meetingId}/logs`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((rollCallData: AttendanceRollCallData) => {
        if (!isMounted) return;
        applyData(rollCallData);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setError(err.message || 'Gagal memuat presensi');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [meetingId, isOpen]);

  const applyData = (rollCallData: AttendanceRollCallData) => {
    setData(rollCallData);

    const initTeacherStatus: AttendanceStatus | null = rollCallData.teacher?.status ?? null;
    const initTeacherTime = rollCallData.teacher?.timestampStart || '';
    const initTeacherTimeEnd = rollCallData.teacher?.timestampEnd || '';
    const initTeacherNote = rollCallData.teacher?.note || '';
    // Sanitize notes and extract material/page from old legacy JSON if present
    let initMeetingNotes = rollCallData.meeting.notes || '';
    let legacyMateri = '';
    let legacyHal: string | number = '';

    if (typeof initMeetingNotes === 'string' && initMeetingNotes.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(initMeetingNotes);
        legacyMateri =
          parsed.actual_materi_id ||
          parsed.unitId ||
          parsed.materiId ||
          parsed.materialProgress?.unitId ||
          parsed.materialProgress?.materi ||
          parsed.materi ||
          '';
        const parsedHal =
          parsed.actual_page ??
          parsed.hal ??
          parsed.page ??
          parsed.materialProgress?.hal;
        if (parsedHal !== undefined && parsedHal !== null && parsedHal !== '' && !isNaN(Number(parsedHal))) {
          legacyHal = Number(parsedHal);
        }
        initMeetingNotes =
          typeof parsed.summary === 'string'
            ? parsed.summary
            : typeof parsed.notes === 'string'
            ? parsed.notes
            : typeof parsed.userNote === 'string'
            ? parsed.userNote
            : '';
      } catch {
        // Not JSON, keep as is
      }
    }

    // Database reader: starts with DB values, fall back to legacy JSON or target props
    let initMateri = '';
    let initHal: string | number = '';

    const meetingAny = rollCallData.meeting as any;
    if (meetingAny.actual_materi_id) {
      initMateri = meetingAny.actual_materi_id;
    } else if (legacyMateri) {
      initMateri = legacyMateri;
    }

    if (meetingAny.actual_page !== undefined && meetingAny.actual_page !== null && meetingAny.actual_page !== '') {
      initHal = meetingAny.actual_page;
    } else if (legacyHal !== '') {
      initHal = legacyHal;
    }

    // Normalize: if initMateri was stored as a title or code (legacy), map to unit ID in availableUnits
    if (initMateri && availableUnits.length > 0) {
      const initMateriLower = String(initMateri).trim().toLowerCase();
      const foundUnit = availableUnits.find(
        (u) =>
          u.id.toLowerCase() === initMateriLower ||
          u.title.trim().toLowerCase() === initMateriLower ||
          u.title.trim().toLowerCase().includes(initMateriLower) ||
          initMateriLower.includes(u.title.trim().toLowerCase())
      );
      if (foundUnit) {
        initMateri = foundUnit.id;
      }
    }


    const initStudents: AttendanceRollCallStudent[] = (rollCallData.students || []).map((s) => ({
      ...s,
      status: s.status || null,
      timestampStart: s.timestampStart || '',
      timestampEnd: s.timestampEnd || '',
    }));

    setTeacherStatus(initTeacherStatus);
    setTeacherTime(initTeacherTime);
    setTeacherTimeEnd(initTeacherTimeEnd);
    setTeacherNote(initTeacherNote);
    setMeetingNotes(initMeetingNotes);
    setStudents(initStudents);
    setMateri(initMateri);
    setHal(initHal);

    baselineRef.current = serializeState({
      teacherStatus: initTeacherStatus,
      teacherTime: initTeacherTime,
      teacherTimeEnd: initTeacherTimeEnd,
      teacherNote: initTeacherNote,
      students: initStudents,
      meetingNotes: initMeetingNotes,
      materi: initMateri,
      hal: initHal,
    });

    baselineSnapshotRef.current = {
      teacherStatus: initTeacherStatus,
      teacherTime: initTeacherTime,
      teacherTimeEnd: initTeacherTimeEnd,
      teacherNote: initTeacherNote,
      students: initStudents.map((s) => ({ ...s })),
      meetingNotes: initMeetingNotes,
      materi: initMateri,
      hal: initHal,
    };
  };

  // Re-apply draft overrides when ready
  useEffect(() => {
    if (loading || !initialDraft) return;
    if (draftAppliedFor.current === meetingId) return;
    draftAppliedFor.current = meetingId;

    if (initialDraft.teacherLog) {
      if (initialDraft.teacherLog.status !== undefined) setTeacherStatus(initialDraft.teacherLog.status);
      if (initialDraft.teacherLog.timestampStart !== undefined) setTeacherTime(initialDraft.teacherLog.timestampStart || '');
      if (initialDraft.teacherLog.timestampEnd !== undefined) setTeacherTimeEnd(initialDraft.teacherLog.timestampEnd || '');
      if (initialDraft.teacherLog.note !== undefined) setTeacherNote(initialDraft.teacherLog.note || '');
    }
    if (initialDraft.studentLogs) {
      const byId = new Map(initialDraft.studentLogs.map((l: any) => [l.studentId, l]));
      setStudents((prev) =>
        prev.map((s) => {
          const d: any = byId.get(s.studentId);
          if (!d) return s;
          return {
            ...s,
            status: d.status,
            timestampStart: d.timestampStart ?? s.timestampStart,
            timestampEnd: d.timestampEnd ?? s.timestampEnd,
            note: d.note ?? s.note,
          };
        })
      );
    }
    if (initialDraft.meetingNotes !== undefined) setMeetingNotes(initialDraft.meetingNotes);
    if (initialDraft.materialProgress) {
      const mp = initialDraft.materialProgress;
      const draftMateri = mp.unitId || mp.materi;
      if (draftMateri !== undefined) {
        const found = availableUnits.find((u) => u.title === draftMateri);
        setMateri(found ? found.id : draftMateri);
      }
      if (mp.hal !== undefined) setHal(mp.hal);
    }
  }, [loading, initialDraft, meetingId]);

  if (!isOpen) return null;

  const getNowFormattedTime = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Schedule defaults: the same values the popover's "Default" button uses
  const getDefaultTimes = () => ({
    start: data?.meeting?.startTime || '07:00',
    end: data?.meeting?.endTime || '08:30',
  });

  // Start after or equal to end is rejected, and missing end time automatically falls back to schedule default end.
  // Both values fall back to the schedule defaults whenever invalid.
  const resolveTimes = (start: string, end: string) => {
    const defaults = getDefaultTimes();
    const effectiveStart = start || defaults.start;
    const effectiveEnd = end || defaults.end;
    if (effectiveStart && effectiveEnd && effectiveStart >= effectiveEnd) {
      return defaults;
    }
    return { start: effectiveStart, end: effectiveEnd };
  };

  // Shared toggle helper so individual and batch toggle behave identically
  const toggleStudentAttendance = (
    student: AttendanceRollCallStudent,
    optValue: AttendanceStatus,
    forcedNextStatus?: AttendanceStatus | null
  ): AttendanceRollCallStudent => {
    const nextStatus =
      forcedNextStatus !== undefined
        ? forcedNextStatus
        : student.status === optValue
        ? null
        : optValue;

    if (!nextStatus || nextStatus === 'Izin' || nextStatus === 'Alpa') {
      return { ...student, status: nextStatus, timestampStart: '', timestampEnd: '' };
    }

    if (nextStatus === 'Hadir' || nextStatus === 'Terlambat') {
      const nowTime = getNowFormattedTime();
      const defaults = getDefaultTimes();
      // Ensure end time is ALWAYS recorded and respects invalid time rules
      const r = resolveTimes(student.timestampStart || nowTime, student.timestampEnd || defaults.end);
      if (!student.timestampStart) triggerFlash(student.studentId);
      return { ...student, status: nextStatus, timestampStart: r.start, timestampEnd: r.end };
    }

    return { ...student, status: nextStatus };
  };

  const handleToggleStatus = (target: 'teacher' | string, optValue: AttendanceStatus) => {
    if (!isAdmin) return;
    const nowTime = getNowFormattedTime();
    const defaults = getDefaultTimes();

    if (target === 'teacher') {
      const nextStatus = teacherStatus === optValue ? null : optValue;
      setTeacherStatus(nextStatus);

      if (!nextStatus || nextStatus === 'Izin' || nextStatus === 'Alpa') {
        setTeacherTime('');
        setTeacherTimeEnd('');
      } else if (nextStatus === 'Hadir' || nextStatus === 'Terlambat') {
        const r = resolveTimes(teacherTime || nowTime, teacherTimeEnd || defaults.end);
        setTeacherTime(r.start);
        setTeacherTimeEnd(r.end);
        if (!teacherTime) triggerFlash('teacher');
      }
    } else {
      setStudents((prev) =>
        prev.map((s) => (s.studentId === target ? toggleStudentAttendance(s, optValue) : s))
      );
    }
  };

  const markAllStudents = (status: AttendanceStatus) => {
    if (!isAdmin) return;
    // Batch toggle behaves identically to individual toggle:
    // If all students are already this status, toggle all to null (cancel/reset).
    // Otherwise, mark all students with this status and record valid start and end times.
    const allAlreadyThisStatus = students.length > 0 && students.every((s) => s.status === status);
    const targetStatus = allAlreadyThisStatus ? null : status;

    setStudents((prev) =>
      prev.map((s) => toggleStudentAttendance(s, status, targetStatus))
    );
  };


  const handleDiscardDraft = () => {
    const base = baselineSnapshotRef.current;
    if (base) {
      setTeacherStatus(base.teacherStatus);
      setTeacherTime(base.teacherTime);
      setTeacherTimeEnd(base.teacherTimeEnd);
      setTeacherNote(base.teacherNote);
      setMeetingNotes(base.meetingNotes);
      setStudents(base.students.map((s) => ({ ...s })));
      setMateri(base.materi);
      setHal(base.hal);
    }
    onDiscardDraft?.(meetingId);
  };

  const applyTimeChange = (type: 'teacher' | 'student', id: string, start: string, end: string) => {
    const r = resolveTimes(start, end);
    if (type === 'teacher') {
      setTeacherTime(r.start);
      setTeacherTimeEnd(r.end);
    } else {
      setStudents((prev) =>
      prev.map((s) => (s.studentId === id ? { ...s, timestampStart: r.start, timestampEnd: r.end } : s))
      );
    }
  };

  const matchedUnit = materi
    ? availableUnits.find((u) => u.title === materi || u.id === materi)
    : undefined;

  const [rangeMin, rangeMax] = React.useMemo(() => {
    if (!matchedUnit) return [undefined, undefined];
    const rawStart = matchedUnit.page_start ?? (matchedUnit as any).pageStart;
    const rawEnd = matchedUnit.page_end ?? (matchedUnit as any).pageEnd;
    const pStart = rawStart !== undefined && rawStart !== '' ? parseInt(String(rawStart), 10) : undefined;
    const pEnd = rawEnd !== undefined && rawEnd !== '' ? parseInt(String(rawEnd), 10) : undefined;
    const validStart = pStart !== undefined && !isNaN(pStart) ? pStart : undefined;
    const validEnd = pEnd !== undefined && !isNaN(pEnd) ? pEnd : undefined;

    if (validStart !== undefined && validEnd !== undefined) {
      return [Math.min(validStart, validEnd), Math.max(validStart, validEnd)];
    }
    return [validStart, validEnd];
  }, [matchedUnit]);

  const handlePageChange = (valStr: string) => {
    if (!isAdmin) return;
    if (valStr === '') {
      setHal('');
      return;
    }
    const clean = valStr.replace(/[^0-9]/g, '');
    if (!clean) {
      setHal('');
      return;
    }
    const num = parseInt(clean, 10);
    if (isNaN(num)) return;

    // If material is not yet selected, auto-select unit matching this page
    if (!materi && availableUnits.length > 0) {
      const uMatch = availableUnits.find((u) => {
        const s = Number(u.page_start ?? (u as any).pageStart);
        const e = Number(u.page_end ?? (u as any).pageEnd);
        return !isNaN(s) && !isNaN(e) && num >= Math.min(s, e) && num <= Math.max(s, e);
      });
      if (uMatch) setMateri(uMatch.id);
    }

    // Only allow values within the selected material range
    if (rangeMax !== undefined && num > rangeMax) {
      setHal(rangeMax);
      return;
    }
    setHal(num);
  };

  const handlePageBlur = () => {
    if (hal === '' || hal === undefined || hal === null) return;
    const num = parseInt(String(hal), 10);
    if (isNaN(num)) {
      setHal('');
      return;
    }
    if (rangeMin !== undefined && num < rangeMin) {
      setHal(rangeMin);
    } else if (rangeMax !== undefined && num > rangeMax) {
      setHal(rangeMax);
    }
  };

  const handlePageUp = () => {
    if (!isAdmin) return;
    const currentNum = parseInt(String(hal), 10);
    if (isNaN(currentNum)) {
      const target = rangeMin !== undefined ? rangeMin : 1;
      setHal(target);
      if (!materi && availableUnits.length > 0) {
        const uMatch = availableUnits.find((u) => {
          const s = Number(u.page_start ?? (u as any).pageStart);
          const e = Number(u.page_end ?? (u as any).pageEnd);
          return !isNaN(s) && !isNaN(e) && target >= Math.min(s, e) && target <= Math.max(s, e);
        });
        if (uMatch) setMateri(uMatch.id);
      }
      return;
    }
    if (rangeMax !== undefined && currentNum >= rangeMax) {
      return;
    }
    const nextNum = currentNum + 1;
    setHal(nextNum);
    if (!materi && availableUnits.length > 0) {
      const uMatch = availableUnits.find((u) => {
        const s = Number(u.page_start ?? (u as any).pageStart);
        const e = Number(u.page_end ?? (u as any).pageEnd);
        return !isNaN(s) && !isNaN(e) && nextNum >= Math.min(s, e) && nextNum <= Math.max(s, e);
      });
      if (uMatch) setMateri(uMatch.id);
    }
  };

  const handlePageDown = () => {
    if (!isAdmin) return;
    const currentNum = parseInt(String(hal), 10);
    if (isNaN(currentNum)) {
      const target = rangeMin !== undefined ? rangeMin : 1;
      setHal(target);
      if (!materi && availableUnits.length > 0) {
        const uMatch = availableUnits.find((u) => {
          const s = Number(u.page_start ?? (u as any).pageStart);
          const e = Number(u.page_end ?? (u as any).pageEnd);
          return !isNaN(s) && !isNaN(e) && target >= Math.min(s, e) && target <= Math.max(s, e);
        });
        if (uMatch) setMateri(uMatch.id);
      }
      return;
    }
    if (rangeMin !== undefined && currentNum <= rangeMin) {
      return;
    }
    const nextNum = currentNum - 1;
    setHal(nextNum);
    if (!materi && availableUnits.length > 0) {
      const uMatch = availableUnits.find((u) => {
        const s = Number(u.page_start ?? (u as any).pageStart);
        const e = Number(u.page_end ?? (u as any).pageEnd);
        return !isNaN(s) && !isNaN(e) && nextNum >= Math.min(s, e) && nextNum <= Math.max(s, e);
      });
      if (uMatch) setMateri(uMatch.id);
    }
  };

  const currentHalNum = parseInt(String(hal), 10);
  const isUpDisabled = !isAdmin || (rangeMax !== undefined && !isNaN(currentHalNum) && currentHalNum >= rangeMax);
  const isDownDisabled = !isAdmin || (rangeMin !== undefined && !isNaN(currentHalNum) && currentHalNum <= rangeMin);

  const isMateriDraft = materi !== (baselineSnapshotRef.current?.materi || '');
  const isHalDraft = String(hal) !== String(baselineSnapshotRef.current?.hal || '');

  const filteredStudents = students.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.nisn && s.nisn.toLowerCase().includes(q));
  });

  const displaySession = sessionTitle || data?.meeting?.sessionName || 'Sesi';
  const displayClass = classTitle || data?.meeting?.className || 'Kelas';

  // Helper to render H-T-I-A buttons with amber dot on draft toggle & dimmed grey on DB value
  const renderStatusToggles = (
    currentStatus: AttendanceStatus | null,
    dbStatus: AttendanceStatus | null,
    targetId: 'teacher' | string
  ) => {
    return (
      <div className="flex items-center gap-1 shrink-0">
        {STATUS_OPTIONS.map((opt) => {
          const isSelected = currentStatus === opt.value;
          const isDb = dbStatus === opt.value;
          const isDraftSelected = isSelected && currentStatus !== dbStatus;
          const isDbUnselected = !isSelected && isDb;

          let btnClass = 'relative px-2 py-1 rounded-lg text-[10px] font-bold transition-all';
          if (!isAdmin) {
            btnClass += ' opacity-80 cursor-default';
          } else {
            btnClass += ' cursor-pointer';
          }

          if (isSelected) {
            btnClass += ` ${opt.activeClass} shadow-2xs`;
          } else if (isDbUnselected) {
            // Recorded database status shown as dimmed/grey with dashed border
            btnClass += ' bg-slate-100 border border-dashed border-slate-400 text-slate-500 hover:bg-slate-200';
          } else {
            btnClass += ' bg-white border border-slate-200 text-slate-500 hover:bg-slate-100';
          }

          return (
            <button
              key={opt.value}
              type="button"
              disabled={!isAdmin}
              onClick={() => handleToggleStatus(targetId, opt.value)}
              title={
                isDb
                  ? `Database: ${opt.value}${isSelected ? ' (Tersimpan)' : ' (Diverifikasi)'}`
                  : opt.label
              }
              className={btnClass}
            >
              {opt.value[0]}
              {/* Amber dot: on active draft toggle, or on DB button if currently deselected to null */}
              {(isDraftSelected || (isDbUnselected && currentStatus === null)) && (
                <span
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                  title="Perubahan draft belum tersimpan di DB"
                />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      {/* Slide-Over Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex items-end sm:items-start pl-0 sm:pl-10 pointer-events-none">
        <div
          className={`pointer-events-auto w-screen max-w-md sm:max-w-xl h-[60dvh] border border-white sm:h-full mt-auto sm:mt-0 rounded-t-2xl sm:rounded-none shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right ${
            isCancelled
              ? 'bg-slate-400 text-slate-600'
              : 'bg-white'
          } ${hasDraft ? 'ring-4 ring-amber-400' : ''}`}
        >
          {/* ------------------------------------------------------------- */}
          {/* Header with Dynamic Theme & Minimal Icon Navigation           */}
          {/* ------------------------------------------------------------- */}
          <div
            className={`px-4 py-3 pr-5 flex items-center justify-between rounded-t-2xl sm:rounded-none transition-colors shrink-0 ${
              isCancelled
                ? 'bg-slate-700 text-white'
                : 'bg-[#024884] text-white shadow-sm'
            }`}
          >
            {/* Left: Icon Steppers (Up/Down) & Session Title */}
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={onPrevSession}
                disabled={!hasPrevSession}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Sesi Sebelumnya"
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onNextSession}
                disabled={!hasNextSession}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Sesi Berikutnya"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              <div className="ml-1 truncate">
                <span className={`text-xs font-bold leading-tight truncate block ${isCancelled ? 'text-slate-300' : 'text-white'}`}>
                  {displaySession} • {displayClass}
                </span>
                <span className={`text-[10px] truncate block ${isCancelled ? 'text-slate-300' : 'text-white/75'}`}>
                  {data?.meeting?.subjectName || 'Pelajaran'}{formattedDate ? ` • ${formattedDate}` : ''}
                </span>
              </div>

              {/* Cancel / Complete Session Button (Admin only) */}
              {isAdmin && onSetSessionStatus && (
                <button
                  type="button"
                  onClick={() => onSetSessionStatus(meetingId, isCancelled ? 'scheduled' : 'cancelled')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ml-1 ${
                    isCancelled
                      ? 'hidden bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'hover:bg-white/15 text-white/80 hover:text-white'
                  }`}
                  title={isCancelled ? 'Pulihkan sesi ini' : 'Batalkan sesi ini'}
                >
                  <Ban className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Right: Discard Draft & Close X */}
            <div className="flex items-center gap-1 shrink-0">
              {isAdmin && hasDraft && onDiscardDraft && (
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="p-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white transition-colors cursor-pointer"
                  title="Batalkan perubahan draft"
                >
                  <Trash className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer ml-1"
                title="Tutup Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cancelled Banner */}
          {isCancelled && (
            <div className="bg-slate-200/90 text-slate-700 px-4 py-2 text-xs font-semibold flex items-center justify-between border-b border-slate-300">
              <span className="flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5 text-rose-700" />
                <span className="text-rose-700">Sesi dibatalkan </span>
                <span className="text-2xs">(kehadiran tetap dicatat)</span>
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onSetSessionStatus?.(meetingId, 'scheduled')}
                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Pulihkan Sesi
                </button>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* Scrollable Body with Stable Scrollbar Gutter                   */}
          {/* ------------------------------------------------------------- */}
          <div
            className={`flex-1 overflow-y-auto p-4 pr-5 sm:pr-6 space-y-3 [scrollbar-gutter:stable] ${
              isCancelled ? 'opacity-50' : ''
            }`}
          >
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Clock className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs font-medium">Memuat data presensi...</span>
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : (
              <>
                {/* 1. Material & Page Range Strip (Ultra-minimal with Default & Clear buttons) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center gap-2 text-xs">
                  <div className="relative flex items-center shrink-0">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    {isMateriDraft && (
                      <span
                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                        title="Materi berubah dari database"
                      />
                    )}
                  </div>

                  <select
                    value={matchedUnit ? matchedUnit.id : ''}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      const unit = availableUnits.find((u) => u.id === e.target.value);
                      if (unit) {
                        setMateri(unit.id);
                        const startP = unit.page_start ?? (unit as any).pageStart;
                        if (startP !== undefined && startP !== null && startP !== '') {
                          setHal(startP);
                        }
                      } else {
                        setMateri('');
                      }
                    }}
                    className="flex-1 min-w-0 bg-transparent font-medium text-slate-800 focus:outline-none text-xs cursor-pointer truncate"
                  >
                    <option value="">{!matchedUnit && materi ? materi : 'Pilih materi...'}</option>
                    {availableUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.title}
                      </option>
                    ))}
                  </select>

                  <div
                    className="relative flex items-center gap-0.5 shrink-0 bg-white border border-slate-200 rounded-lg pl-1.5 pr-0.5 py-0.5"
                    title={
                      rangeMin !== undefined && rangeMax !== undefined
                        ? `Rentang halaman materi: ${rangeMin} - ${rangeMax}`
                        : 'Nomor halaman'
                    }
                  >
                    <span className="text-[10px] text-slate-400 font-bold select-none">Hal.</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={hal}
                      disabled={!isAdmin}
                      onChange={(e) => handlePageChange(e.target.value)}
                      onBlur={handlePageBlur}
                      placeholder={rangeMin !== undefined ? String(rangeMin) : '—'}
                      className="w-8 bg-transparent text-center font-bold text-slate-800 focus:outline-none text-xs"
                    />
                    {/* Up / Down steppers */}
                    <div className="flex flex-col -my-0.5 border-l border-slate-200 pl-0.5">
                      <button
                        type="button"
                        disabled={isUpDisabled}
                        onClick={handlePageUp}
                        className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-20 disabled:pointer-events-none cursor-pointer leading-none"
                        title={rangeMax !== undefined ? `Tambah halaman (Maks: ${rangeMax})` : 'Tambah halaman'}
                      >
                        <ChevronUp className="w-2.5 h-2.5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        disabled={isDownDisabled}
                        onClick={handlePageDown}
                        className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-20 disabled:pointer-events-none cursor-pointer leading-none"
                        title={rangeMin !== undefined ? `Kurang halaman (Min: ${rangeMin})` : 'Kurang halaman'}
                      >
                        <ChevronDown className="w-2.5 h-2.5 stroke-[2.5]" />
                      </button>
                    </div>
                    {isHalDraft && (
                      <span
                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                        title="Halaman berubah dari database"
                      />
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0 border-l border-slate-200 pl-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const targetUnit =
                            (targetUnitId && availableUnits.find((u) => u.id === targetUnitId)) ||
                            (targetMateri && availableUnits.find((u) => u.title === targetMateri || u.id === targetMateri)) ||
                            availableUnits[0];
                          const defMateri = targetUnit ? targetUnit.id : (targetUnitId || targetMateri || '');
                          const fallbackPage = targetUnit
                            ? (targetUnit.page_start ?? (targetUnit as any).pageStart ?? targetUnit.page_end ?? (targetUnit as any).pageEnd ?? '')
                            : '';
                          const defHal =
                            targetHal !== undefined && targetHal !== null && targetHal !== ''
                              ? targetHal
                              : fallbackPage;
                          setMateri(defMateri);
                          setHal(defHal);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold hover:bg-emerald-50 text-emerald-600 transition-colors cursor-pointer"
                        title="Isi materi & halaman sesuai kurikulum standar"
                      >
                        <Pencil className="w-4 h-4"/>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMateri('');
                          setHal('');
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-colors cursor-pointer"
                        title="Kosongkan materi dan halaman"
                      >
                        <X className="w-4 h-4"/>
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Teacher Attendance (Identical layout to students: Name, Time Chip, H-T-I-A) */}
                {(() => {
                  const dbTeacherStatus = baselineSnapshotRef.current?.teacherStatus ?? null;
                  const dbTeacherTime = baselineSnapshotRef.current?.teacherTime ?? '';
                  const dbTeacherTimeEnd = baselineSnapshotRef.current?.teacherTimeEnd ?? '';
                  const isTeacherTimeDraft = teacherTime !== dbTeacherTime || teacherTimeEnd !== dbTeacherTimeEnd;
                  const teacherTimeDisplay = teacherTime
                    ? teacherTimeEnd
                      ? `${teacherTime}-${teacherTimeEnd}`
                      : teacherTime
                    : '--:--';
                  const isTeacherFlashing = flashingRowId === 'teacher';

                  return (
                    <div
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                        teacherStatus === 'Hadir'
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : teacherStatus === 'Terlambat'
                          ? 'bg-teal-50/40 border-teal-200'
                          : teacherStatus
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-white border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Ustadz / Pengajar
                          </div>
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {data?.teacher.name || 'Pengampu'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Minimal Time Chip */}
                        {isAdmin && (teacherTime || teacherTimeEnd) && (
                          <button
                            type="button"
                            onClick={() => applyTimeChange('teacher', 'teacher', '', '')}
                            title="Hapus jam"
                            className="px-1 py-1 hover:bg-rose-100 text-rose-700 font-semibold rounded-full transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAdmin) return;
                            setActiveTimePopover({
                              type: 'teacher',
                              id: 'teacher',
                              name: data?.teacher.name || 'Ustadz',
                              startTime: teacherTime,
                              endTime: teacherTimeEnd,
                            });
                          }}
                          className={`relative px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer shrink-0 ${
                            isTeacherFlashing
                              ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400 font-bold animate-pulse'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                          title="Klik untuk melihat atau mengatur jam kehadiran"
                        >
                          {teacherTimeDisplay}
                          {isTeacherTimeDraft && (
                            <span
                              className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                              title="Jam presensi berubah dari DB"
                            />
                          )}
                        </button>

                        {/* H-T-I-A Toggles */}
                        {renderStatusToggles(teacherStatus, dbTeacherStatus, 'teacher')}
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Student Roster Search & Quick All-Hadir */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Cari dari ${students.length} santri...`}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 text-slate-800"
                    />
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => markAllStudents('Hadir')}
                      className={`flex items-center gap-1 px-3 py-1.5 border rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                        students.length > 0 && students.every((s) => s.status === 'Hadir')
                          ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                      }`}
                      title={
                        students.length > 0 && students.every((s) => s.status === 'Hadir')
                          ? 'Batalkan status hadir untuk semua santri'
                          : 'Tandai semua santri hadir'
                      }
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>
                        {students.length > 0 && students.every((s) => s.status === 'Hadir')
                          ? 'Reset Hadir'
                          : 'Semua Hadir'}
                      </span>
                    </button>
                  )}
                </div>

                {/* 4. Student Roster List */}
                <div className="space-y-1.5">
                  {filteredStudents.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Tidak ada santri yang cocok dengan pencarian
                    </div>
                  ) : (
                    filteredStudents.map((student, idx) => {
                      const baseStudent = baselineSnapshotRef.current?.students.find(
                        (bs) => bs.studentId === student.studentId
                      );
                      const dbStudentStatus = baseStudent?.status ?? null;
                      const dbStudentTime = baseStudent?.timestampStart ?? '';
                      const dbStudentTimeEnd = baseStudent?.timestampEnd ?? '';
                      const isStudentTimeDraft =
                        (student.timestampStart || '') !== dbStudentTime ||
                        (student.timestampEnd || '') !== dbStudentTimeEnd;
                      const studentTimeDisplay = student.timestampStart
                        ? student.timestampEnd
                          ? `${student.timestampStart}-${student.timestampEnd}`
                          : student.timestampStart
                        : '--:--';
                      const isStudentFlashing = flashingRowId === student.studentId;

                      return (
                        <div
                          key={student.studentId}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                            student.status === 'Hadir'
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : student.status === 'Terlambat'
                              ? 'bg-teal-50/40 border-teal-200'
                              : student.status
                              ? 'bg-slate-50 border-slate-200'
                              : 'bg-white border-slate-200/80 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-mono font-bold text-slate-400 w-4 text-right shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 truncate">
                                {student.name}
                              </div>
                              {student.nisn && (
                                <div className="text-[10px] font-mono text-slate-400 truncate">
                                  {student.nisn}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Minimal Time Chip */}
                            {isAdmin && (student.timestampStart || student.timestampEnd)  && (
                              <button
                              type="button"
                              onClick={() => applyTimeChange('student', student.studentId, '', '')}
                              title="Hapus jam"
                              className="px-1 py-1 hover:bg-rose-100 text-rose-700 font-semibold rounded-full transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAdmin) return;
                                setActiveTimePopover({
                                  type: 'student',
                                  id: student.studentId,
                                  name: student.name,
                                  startTime: student.timestampStart || '',
                                  endTime: student.timestampEnd || '',
                                });
                              }}
                              className={`relative px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer shrink-0 ${
                                isStudentFlashing
                                  ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400 font-bold animate-pulse'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                              title="Klik untuk melihat atau mengatur jam kehadiran"
                            >
                              {studentTimeDisplay}
                              {isStudentTimeDraft && (
                                <span
                                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                                  title="Jam presensi berubah dari DB"
                                />
                              )}
                            </button>

                            {/* H-T-I-A Toggles */}
                            {renderStatusToggles(student.status, dbStudentStatus, student.studentId)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Live draft indicator at bottom */}
                <div className="text-[10px] text-slate-400 text-center py-2">
                  {hasDraft ? (
                    <span className="text-amber-600 font-semibold">
                      Ada perubahan draft. Menunggu tombol Simpan..
                    </span>
                  ) : (
                    <span>Data sesuai dengan server</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Micro time popover: name, start, end, default. Backdrop click closes. */}
      {activeTimePopover && (
        <div
        className="fixed inset-0 z-60 bg-black/25 flex items-center justify-center p-4 pointer-events-auto animate-in fade-in"
        onClick={() => setActiveTimePopover(null)}
        >
        <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 p-3 w-60 space-y-2"
        onClick={(e) => e.stopPropagation()}
        >
        <div className="text-xs font-bold text-slate-800 truncate">{activeTimePopover.name}</div>

        <div className="flex items-center gap-2">
        <input
        type="time"
        value={activeTimePopover.startTime}
        disabled={!isAdmin}
        onChange={(e) => {
          const r = resolveTimes(e.target.value, activeTimePopover.endTime);
          setActiveTimePopover((p) => (p ? { ...p, startTime: r.start, endTime: r.end } : null));
          applyTimeChange(activeTimePopover.type, activeTimePopover.id, r.start, r.end);
        }}
        className="flex-1 min-w-0 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-400"
        />
        <span className="text-slate-400 text-xs">–</span>
        <input
        type="time"
        value={activeTimePopover.endTime}
        disabled={!isAdmin}
        onChange={(e) => {
          const r = resolveTimes(activeTimePopover.startTime, e.target.value);
          setActiveTimePopover((p) => (p ? { ...p, startTime: r.start, endTime: r.end } : null));
          applyTimeChange(activeTimePopover.type, activeTimePopover.id, r.start, r.end);
        }}
        className="flex-1 min-w-0 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-400"
        />
        {isAdmin && (
          <button
          type="button"
          title="Jam jadwal"
          onClick={() => {
            const { start, end } = getDefaultTimes();
            setActiveTimePopover((p) => (p ? { ...p, startTime: start, endTime: end } : null));
            applyTimeChange(activeTimePopover.type, activeTimePopover.id, start, end);
          }}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
          >
          <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        </div>
        </div>
        </div>
      )}
    </div>
  );
};
