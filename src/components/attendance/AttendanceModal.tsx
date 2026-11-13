import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  AlertCircle,
  Clock,
  Trash,
  ListChecks,
  Ban,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Search,
  BookOpen,
  LogIn,
  LogOut,
  Pencil,
  StickyNote,
  CalendarClock,
  CheckCircle2
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
  meetingNumber?: number;
  isOpen: boolean;
  hasDraft: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  targetMateri?: string;
  targetHal?: number | string;
  targetUnitId?: string;
  availableUnits?: Array<{
    id: string;
    title: string;
    part?: number | string;
    volumeNumber?: number;
    pageStart?: number | string;
    pageEnd?: number | string;
    page_start?: number | string;
    page_end?: number | string;
  }>;
  initialDraft?: PendingRollCallLog;
  onSaveDraft?: (draftPayload: any, options?: { preserveCancelled?: boolean }) => void;
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
  formattedDate,
  meetingNumber
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
  const [startMateri, setStartMateri] = useState<string>('');
  const [startHal, setStartHal] = useState<string | number>('');
  const [materi, setMateri] = useState<string>('');
  const [hal, setHal] = useState<string | number>('');

  // Micro time popover state
  const [activeTimePopover, setActiveTimePopover] = useState<{
    type: 'teacher' | 'student' | 'session_default';
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const noteInputRef = useRef<HTMLInputElement | null>(null);

  // Time-capture mode ('nowTime' = live current clock, 'default' = session default start time)
  const [timeStampMode, setTimeStampMode] = useState<'nowTime' | 'default'>('nowTime');
  const [liveNowTime, setLiveNowTime] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  });

  // Temporary session default times for bulk/individual defaulting in this session
  const [sessionDefaultTimes, setSessionDefaultTimes] = useState<{ start: string; end: string } | null>(null);

  // Visual flash feedback on auto-stamping (supports multiple rows simultaneously)
  const [flashingRowIds, setFlashingRowIds] = useState<Set<string>>(() => new Set());
  const flashTimerRef = useRef<any>(null);

  // Visual flash feedback when material changes via page stepper
  const [flashingMaterial, setFlashingMaterial] = useState<'start' | 'end' | null>(null);
  const materialFlashTimerRef = useRef<any>(null);

  const triggerMaterialFlash = (type: 'start' | 'end') => {
    if (materialFlashTimerRef.current) clearTimeout(materialFlashTimerRef.current);
    setFlashingMaterial(type);
    materialFlashTimerRef.current = setTimeout(() => {
      setFlashingMaterial(null);
    }, 800);
  };

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
    startMateri: string;
    startHal: string | number;
  } | null>(null);

  const lastDraftRef = useRef<{ id: string; json: string } | null>(null);
  const draftAppliedFor = useRef<string | null>(null);

  // Dynamic Theme calculations
  const serverStatus = data?.meeting?.status || 'scheduled';
  const effectiveStatus = getEffectiveStatus ? getEffectiveStatus(meetingId, serverStatus) : serverStatus;
  const isCancelled = effectiveStatus === 'cancelled';

  // Fixed field order for baseline serialization with robust scalar normalization
  const serializeState = (s: Record<string, any>) =>
    JSON.stringify([
      s.teacherStatus || null,
      s.teacherTime || '',
      s.teacherTimeEnd || '',
      s.teacherNote || '',
      (s.students || []).map((st: any) => [
        st.studentId,
        st.status || null,
        st.timestampStart || '',
        st.timestampEnd || '',
        st.note || '',
      ]),
      s.meetingNotes || '',
      s.materi || '',
      s.hal !== '' && s.hal !== undefined && !isNaN(Number(s.hal)) ? Number(s.hal) : '',
      s.startMateri || '',
      s.startHal !== '' && s.startHal !== undefined && !isNaN(Number(s.startHal)) ? Number(s.startHal) : '',
    ]);

  const triggerFlash = (ids: string | string[]) => {
    const list = Array.isArray(ids) ? ids : [ids];
    if (list.length === 0) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashingRowIds(new Set(list));
    flashTimerRef.current = setTimeout(() => {
      setFlashingRowIds(new Set());
    }, 800);
  };

  const resolveUnitByIdOrTitle = (val?: string | null) => {
    if (!val || availableUnits.length === 0) return undefined;
    const trimmed = String(val).trim();
    if (!trimmed) return undefined;
    const lower = trimmed.toLowerCase();
    return (
      availableUnits.find((u) => u.id === trimmed) ||
      availableUnits.find((u) => u.id.toLowerCase() === lower) ||
      availableUnits.find((u) => u.title.trim().toLowerCase() === lower)
    );
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
      startUnitId: startMateri || undefined,
      startMateri: startMateri || undefined,
      startHal: startHal !== '' && startHal !== undefined && !isNaN(Number(startHal)) ? Number(startHal) : undefined,
    },
  });

  const latestSerializedRef = useRef<string>('');
  latestSerializedRef.current = serializeState({
    teacherStatus,
    teacherTime,
    teacherTimeEnd,
    teacherNote,
    students,
    meetingNotes,
    materi,
    hal,
    startMateri,
    startHal,
  });

  // Live auto-save draft whenever values diverge from baseline (only for admin)
  useEffect(() => {
    if (!isOpen || !meetingId || loading || baselineRef.current === null || !isAdmin) return;
    const current = latestSerializedRef.current;

    if (current === baselineRef.current) {
      if (lastDraftRef.current && lastDraftRef.current.id === meetingId) {
        lastDraftRef.current = null;
        onDiscardDraft?.(meetingId);
      }
    } else {
      if (!lastDraftRef.current || lastDraftRef.current.id !== meetingId || lastDraftRef.current.json !== current) {
        lastDraftRef.current = { id: meetingId, json: current };
        onSaveDraft?.(buildDraftPayload(), { preserveCancelled: isCancelled });
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
    startMateri,
    startHal,
    isOpen,
    meetingId,
    loading,
    isAdmin,
    isCancelled
  ]);

  // Load meeting data
  useEffect(() => {
    if (!isOpen || !meetingId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    draftAppliedFor.current = null;
    baselineRef.current = null;
    setSessionDefaultTimes(null);
    setTimeStampMode('nowTime');
    setActiveTimePopover(null);

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

  // Live ticking clock when modal is open in 'nowTime' mode
  useEffect(() => {
    if (!isOpen || timeStampMode !== 'nowTime') return;
    const syncClock = () => {
      const d = new Date();
      setLiveNowTime(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
      );
    };
    syncClock();
    const timer = setInterval(syncClock, 1000);
    return () => clearInterval(timer);
  }, [isOpen, timeStampMode]);

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
    let legacyStartMateri = '';
    let legacyStartHal: string | number = '';

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

        legacyStartMateri =
          parsed.actual_start_materi_id ||
          parsed.startUnitId ||
          parsed.startMateri ||
          parsed.materialProgress?.startUnitId ||
          parsed.materialProgress?.startMateri ||
          '';
        const parsedStartHal =
          parsed.actual_start_page ??
          parsed.startHal ??
          parsed.startPage ??
          parsed.materialProgress?.startHal;
        if (parsedStartHal !== undefined && parsedStartHal !== null && parsedStartHal !== '' && !isNaN(Number(parsedStartHal))) {
          legacyStartHal = Number(parsedStartHal);
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
    let initStartMateri = '';
    let initStartHal: string | number = '';

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

    if (meetingAny.actual_start_materi_id) {
      initStartMateri = meetingAny.actual_start_materi_id;
    } else if (legacyStartMateri) {
      initStartMateri = legacyStartMateri;
    }

    if (meetingAny.actual_start_page !== undefined && meetingAny.actual_start_page !== null && meetingAny.actual_start_page !== '') {
      initStartHal = meetingAny.actual_start_page;
    } else if (legacyStartHal !== '') {
      initStartHal = legacyStartHal;
    }

    // Normalize legacy title values strictly to unit ID (no loose substring collisions)
    const normalizedEndUnit = resolveUnitByIdOrTitle(initMateri);
    if (normalizedEndUnit) {
      initMateri = normalizedEndUnit.id;
    }

    const normalizedStartUnit = resolveUnitByIdOrTitle(initStartMateri);
    if (normalizedStartUnit) {
      initStartMateri = normalizedStartUnit.id;
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
    setStartMateri(initStartMateri);
    setStartHal(initStartHal);
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
      startMateri: initStartMateri,
      startHal: initStartHal,
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
      startMateri: initStartMateri,
      startHal: initStartHal,
    };

    lastDraftRef.current = null;
  };

  // Re-apply draft overrides when ready (and prevent duplicate onSaveDraft round-trip on mount)
  useEffect(() => {
    if (loading || !initialDraft) return;
    if (draftAppliedFor.current === meetingId) return;
    draftAppliedFor.current = meetingId;

    const base = baselineSnapshotRef.current;

    let nextTeacherStatus = base?.teacherStatus ?? null;
    let nextTeacherTime = base?.teacherTime ?? '';
    let nextTeacherTimeEnd = base?.teacherTimeEnd ?? '';
    let nextTeacherNote = base?.teacherNote ?? '';

    if (initialDraft.teacherLog) {
      if (initialDraft.teacherLog.status !== undefined) {
        nextTeacherStatus = initialDraft.teacherLog.status;
        setTeacherStatus(nextTeacherStatus);
      }
      if (initialDraft.teacherLog.timestampStart !== undefined) {
        nextTeacherTime = initialDraft.teacherLog.timestampStart || '';
        setTeacherTime(nextTeacherTime);
      }
      if (initialDraft.teacherLog.timestampEnd !== undefined) {
        nextTeacherTimeEnd = initialDraft.teacherLog.timestampEnd || '';
        setTeacherTimeEnd(nextTeacherTimeEnd);
      }
      if (initialDraft.teacherLog.note !== undefined) {
        nextTeacherNote = initialDraft.teacherLog.note || '';
        setTeacherNote(nextTeacherNote);
      }
    }

    let nextStudents = base?.students ? base.students.map((s) => ({ ...s })) : students;
    if (initialDraft.studentLogs) {
      const byId = new Map(initialDraft.studentLogs.map((l: any) => [l.studentId, l]));
      nextStudents = nextStudents.map((s) => {
        const d: any = byId.get(s.studentId);
        if (!d) return s;
        return {
          ...s,
          status: d.status,
          timestampStart: d.timestampStart ?? s.timestampStart,
          timestampEnd: d.timestampEnd ?? s.timestampEnd,
          note: d.note ?? s.note,
        };
      });
      setStudents(nextStudents);
    }

    let nextMeetingNotes = base?.meetingNotes ?? '';
    if (initialDraft.meetingNotes !== undefined) {
      nextMeetingNotes = initialDraft.meetingNotes;
      setMeetingNotes(nextMeetingNotes);
    }

    let nextMateri = base?.materi ?? '';
    let nextHal: string | number = base?.hal ?? '';
    let nextStartMateri = base?.startMateri ?? '';
    let nextStartHal: string | number = base?.startHal ?? '';

    if (initialDraft.materialProgress) {
      const mp = initialDraft.materialProgress;
      const draftMateri = mp.unitId || mp.materi || '';
      const foundEnd = draftMateri ? resolveUnitByIdOrTitle(draftMateri) : undefined;
      nextMateri = foundEnd ? foundEnd.id : draftMateri;
      nextHal = mp.hal !== undefined && mp.hal !== null ? mp.hal : '';

      const draftStartMateri = mp.startUnitId || mp.startMateri || '';
      const foundStart = draftStartMateri ? resolveUnitByIdOrTitle(draftStartMateri) : undefined;
      nextStartMateri = foundStart ? foundStart.id : draftStartMateri;
      nextStartHal = mp.startHal !== undefined && mp.startHal !== null ? mp.startHal : '';

      setMateri(nextMateri);
      setHal(nextHal);
      setStartMateri(nextStartMateri);
      setStartHal(nextStartHal);
    }

    lastDraftRef.current = {
      id: meetingId,
      json: serializeState({
        teacherStatus: nextTeacherStatus,
        teacherTime: nextTeacherTime,
        teacherTimeEnd: nextTeacherTimeEnd,
        teacherNote: nextTeacherNote,
        students: nextStudents,
        meetingNotes: nextMeetingNotes,
        materi: nextMateri,
        hal: nextHal,
        startMateri: nextStartMateri,
        startHal: nextStartHal,
      }),
    };
  }, [loading, initialDraft, meetingId, availableUnits]);

  // Refresh the modal upon global save (hasDraft transitions true -> false)
  const prevDraftRef = useRef({ id: meetingId, has: hasDraft });
  useEffect(() => {
    const prev = prevDraftRef.current;
    prevDraftRef.current = { id: meetingId, has: hasDraft };
    if (prev.id !== meetingId || !prev.has || hasDraft) return; // only true -> false, same meeting
    if (!isOpen || loading || baselineRef.current === null) return;

    if (latestSerializedRef.current === baselineRef.current) return; // our own discard or revert, nothing to do

    fetch(`/api/attendance/meetings/${meetingId}/logs`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((fresh: AttendanceRollCallData) => {
        applyData(fresh);
        setSessionDefaultTimes(null);
      })
      .catch(() => {});
  }, [hasDraft, meetingId, isOpen, loading]);

  if (!isOpen) return null;

  const getNowFormattedTime = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Schedule defaults or temporary customized session defaults
  const getDefaultTimes = () => ({
    start: sessionDefaultTimes?.start || data?.meeting?.startTime || '07:00',
    end: sessionDefaultTimes?.end || data?.meeting?.endTime || '08:30',
  });

  const getActiveCheckInTime = () =>
    timeStampMode === 'nowTime' ? getNowFormattedTime() : getDefaultTimes().start;

  // Shared toggle helper: records startTime only (no endTime until End Session) and preserves existing startTime
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
      const nextStart = student.timestampStart || getActiveCheckInTime();
      return { ...student, status: nextStatus, timestampStart: nextStart };
    }

    return { ...student, status: nextStatus };
  };

  const handleToggleStatus = (target: 'teacher' | string, optValue: AttendanceStatus) => {
    if (!isAdmin) return;

    if (target === 'teacher') {
      const nextStatus = teacherStatus === optValue ? null : optValue;
      setTeacherStatus(nextStatus);

      if (!nextStatus || nextStatus === 'Izin' || nextStatus === 'Alpa') {
        setTeacherTime('');
        setTeacherTimeEnd('');
      } else if (nextStatus === 'Hadir' || nextStatus === 'Terlambat') {
        if (!teacherTime) {
          setTeacherTime(getActiveCheckInTime());
          triggerFlash('teacher');
        }
      }
    } else {
      const currentStudent = students.find((s) => s.studentId === target);
      const nextStatus = currentStudent?.status === optValue ? null : optValue;
      const shouldFlash =
        Boolean(currentStudent) &&
        !currentStudent?.timestampStart &&
        (nextStatus === 'Hadir' || nextStatus === 'Terlambat');

      setStudents((prev) =>
        prev.map((s) => (s.studentId === target ? toggleStudentAttendance(s, optValue) : s))
      );
      if (shouldFlash) triggerFlash(target);
    }
  };

  const markAllStudents = (status: AttendanceStatus) => {
    if (!isAdmin) return;
    const checkInTime = getActiveCheckInTime();
    const allAlreadyMarkedAndTimed =
      students.length > 0 &&
      students.every((s) => s.status === status && Boolean(s.timestampStart));

    // Only toggle off if every student already has this status AND a recorded startTime.
    // Otherwise fill status & blank startTimes only, leaving existing startTime/endTime intact.
    const targetStatus = allAlreadyMarkedAndTimed ? null : status;
    const idsToFlash =
      targetStatus === null
        ? []
        : students.filter((s) => !s.timestampStart).map((s) => s.studentId);

    setStudents((prev) =>
      prev.map((s) => {
        if (targetStatus === null) {
          return { ...s, status: null, timestampStart: '', timestampEnd: '' };
        }
        return {
          ...s,
          status: targetStatus,
          timestampStart: s.timestampStart || checkInTime,
        };
      })
    );

    if (idsToFlash.length > 0) {
      triggerFlash(idsToFlash);
    }
  };

  const handleEndSession = () => {
    if (!isAdmin) return;
    const nowTime = getNowFormattedTime();
    const flashedIds: string[] = [];

    if (teacherTime) {
      setTeacherTimeEnd(nowTime);
      flashedIds.push('teacher');
    }

    students.forEach((s) => {
      if (s.timestampStart) {
        flashedIds.push(s.studentId);
      }
    });

    setStudents((prev) =>
      prev.map((s) => (s.timestampStart ? { ...s, timestampEnd: nowTime } : s))
    );

    if (flashedIds.length > 0) {
      triggerFlash(flashedIds);
    }

    if (!meetingNotes.trim()) {
      setTimeout(() => noteInputRef.current?.focus(), 50);
    }
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
      setStartMateri(base.startMateri);
      setStartHal(base.startHal);
      setMateri(base.materi);
      setHal(base.hal);
    }
    setSessionDefaultTimes(null);
    setTimeStampMode('nowTime');
    lastDraftRef.current = null;
    onDiscardDraft?.(meetingId);
  };

  const applyTimeChange = (type: 'teacher' | 'student', id: string, start: string, end: string) => {
    if (type === 'teacher') {
      setTeacherTime(start);
      setTeacherTimeEnd(end);
    } else {
      setStudents((prev) =>
        prev.map((s) => (s.studentId === id ? { ...s, timestampStart: start, timestampEnd: end } : s))
      );
    }
  };

  const handlePopoverTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    if (!activeTimePopover) return;
    let startTime = field === 'startTime' ? value : activeTimePopover.startTime;
    let endTime = field === 'endTime' ? value : activeTimePopover.endTime;

    // Last edited field wins: if the range is now invalid, clear the other one
    if (startTime && endTime && startTime >= endTime) {
      if (field === 'startTime') endTime = '';
      else startTime = '';
    }

    setActiveTimePopover({ ...activeTimePopover, startTime, endTime });

    const { type, id } = activeTimePopover;
    if (type === 'teacher') {
      setTeacherTime(startTime);
      setTeacherTimeEnd(endTime);
    } else if (type === 'student') {
      setStudents((prev) =>
        prev.map((s) =>
          s.studentId === id ? { ...s, timestampStart: startTime, timestampEnd: endTime } : s
        )
      );
    } else if (startTime && endTime) {
      // session default only commits complete pairs; a blank would silently fall back to the schedule
      setSessionDefaultTimes({ start: startTime, end: endTime });
    }
  };

  // --- MULTI-PART SAFE PAGE & MATERIAL HELPERS ---
  const findUnitForPageWithPartPriority = (
    pageNum: number,
    preferredPart?: number | string
  ) => {
    if (preferredPart !== undefined && preferredPart !== null && preferredPart !== '') {
      const partMatch = availableUnits.find((u) => {
        const uPart = (u as any).part ?? (u as any).volumeNumber;
        if (String(uPart) !== String(preferredPart)) return false;
        const s = Number(u.page_start ?? (u as any).pageStart);
        const e = Number(u.page_end ?? (u as any).pageEnd);
        return !isNaN(s) && !isNaN(e) && pageNum >= Math.min(s, e) && pageNum <= Math.max(s, e);
      });
      if (partMatch) return partMatch;
    }
    return availableUnits.find((u) => {
      const s = Number(u.page_start ?? (u as any).pageStart);
      const e = Number(u.page_end ?? (u as any).pageEnd);
      return !isNaN(s) && !isNaN(e) && pageNum >= Math.min(s, e) && pageNum <= Math.max(s, e);
    });
  };

  const formatUnitOptionLabel = (u: any) => {
    const pStart = u.page_start ?? u.pageStart;
    const pEnd = u.page_end ?? u.pageEnd;
    const part = u.part ?? u.volumeNumber;
    const rangeStr = pStart !== undefined && pEnd !== undefined ? `${pStart}-${pEnd}` : (pStart || pEnd || '');
    const prefix = part ? `(${part}:${rangeStr}) ` : rangeStr ? `(${rangeStr}) ` : '';
    return `${prefix}${u.title}`;
  };

  const getUnitRange = (unit: any): [number | undefined, number | undefined] => {
    if (!unit) return [undefined, undefined];
    const rawStart = unit.page_start ?? unit.pageStart;
    const rawEnd = unit.page_end ?? unit.pageEnd;
    const pStart = rawStart !== undefined && rawStart !== '' ? parseInt(String(rawStart), 10) : undefined;
    const pEnd = rawEnd !== undefined && rawEnd !== '' ? parseInt(String(rawEnd), 10) : undefined;
    const validStart = pStart !== undefined && !isNaN(pStart) ? pStart : undefined;
    const validEnd = pEnd !== undefined && !isNaN(pEnd) ? pEnd : undefined;
    if (validStart !== undefined && validEnd !== undefined) {
      return [Math.min(validStart, validEnd), Math.max(validStart, validEnd)];
    }
    return [validStart, validEnd];
  };

  // Enforce Start <= End across material + page; last edited side wins & updates the opposing side to a valid value
  const reconcileMaterialOrder = (
    editedSide: 'start' | 'end',
    nextStartMat: string,
    nextStartPage: string | number,
    nextEndMat: string,
    nextEndPage: string | number
  ) => {
    const startU = resolveUnitByIdOrTitle(nextStartMat);
    const endU = resolveUnitByIdOrTitle(nextEndMat);
    const startIdx = startU ? availableUnits.findIndex((u) => u.id === startU.id) : -1;
    const endIdx = endU ? availableUnits.findIndex((u) => u.id === endU.id) : -1;

    const sNum = nextStartPage !== '' && nextStartPage !== undefined ? parseInt(String(nextStartPage), 10) : NaN;
    const eNum = nextEndPage !== '' && nextEndPage !== undefined ? parseInt(String(nextEndPage), 10) : NaN;
    const hasSNum = !isNaN(sNum);
    const hasENum = !isNaN(eNum);

    let isInvalid = false;
    if (startIdx !== -1 && endIdx !== -1) {
      if (startIdx > endIdx) {
        isInvalid = true;
      } else if (startIdx === endIdx && hasSNum && hasENum && sNum > eNum) {
        isInvalid = true;
      }
    } else if (hasSNum && hasENum && sNum > eNum) {
      isInvalid = true;
    }

    if (isInvalid) {
      if (editedSide === 'start') {
        nextEndMat = nextStartMat;
        if (hasSNum) {
          nextEndPage = sNum;
        } else if (startU) {
          const [uMin] = getUnitRange(startU);
          nextEndPage = uMin ?? '';
        }
        triggerMaterialFlash('end');
      } else {
        nextStartMat = nextEndMat;
        if (hasENum) {
          nextStartPage = eNum;
        } else if (endU) {
          const [uMin] = getUnitRange(endU);
          nextStartPage = uMin ?? '';
        }
        triggerMaterialFlash('start');
      }
    }

    setStartMateri(nextStartMat);
    setStartHal(nextStartPage);
    setMateri(nextEndMat);
    setHal(nextEndPage);
  };

  // --- START MATERIAL & PAGE HELPERS ---
  const matchedStartUnit = resolveUnitByIdOrTitle(startMateri);

  const [startRangeMin, startRangeMax] = React.useMemo(
    () => getUnitRange(matchedStartUnit),
    [matchedStartUnit]
  );

  const startUnitIndex = matchedStartUnit ? availableUnits.findIndex((u) => u.id === matchedStartUnit.id) : -1;
  const canStepToNextStartUnit = startUnitIndex !== -1 && startUnitIndex < availableUnits.length - 1;
  const canStepToPrevStartUnit = startUnitIndex > 0;

  const currentStartHalNum = parseInt(String(startHal), 10);
  const isAtStartRangeMax = startRangeMax !== undefined && !isNaN(currentStartHalNum) && currentStartHalNum >= startRangeMax;
  const isAtStartRangeMin = startRangeMin !== undefined && !isNaN(currentStartHalNum) && currentStartHalNum <= startRangeMin;

  const isStartUpDisabled = !isAdmin || (isAtStartRangeMax && !canStepToNextStartUnit);
  const isStartDownDisabled = !isAdmin || (isAtStartRangeMin && !canStepToPrevStartUnit);

  const isStartUpCrossingBoundary = isAtStartRangeMax && canStepToNextStartUnit;
  const isStartDownCrossingBoundary = isAtStartRangeMin && canStepToPrevStartUnit;

  const handleStartPageChange = (valStr: string) => {
    if (!isAdmin) return;
    if (valStr === '') {
      setStartHal('');
      return;
    }
    const clean = valStr.replace(/[^0-9]/g, '');
    if (!clean) {
      setStartHal('');
      return;
    }
    const num = parseInt(clean, 10);
    if (isNaN(num)) return;

    const currentPart = matchedStartUnit?.part ?? (matchedStartUnit as any)?.volumeNumber;
    if (!startMateri && availableUnits.length > 0) {
      const uMatch = findUnitForPageWithPartPriority(num, currentPart);
      if (uMatch) setStartMateri(uMatch.id);
    } else if (matchedStartUnit && (startRangeMin === undefined || num < startRangeMin || (startRangeMax !== undefined && num > startRangeMax))) {
      // If typed page is out of current unit's range, check if another unit in current part contains this page
      const altMatch = findUnitForPageWithPartPriority(num, currentPart);
      if (altMatch && altMatch.id !== matchedStartUnit.id) {
        setStartMateri(altMatch.id);
        triggerMaterialFlash('start');
      }
    }

    setStartHal(num);
  };

  const handleStartPageBlur = () => {
    if (startHal === '' || startHal === undefined || startHal === null) return;
    const num = parseInt(String(startHal), 10);
    if (isNaN(num)) {
      setStartHal('');
      return;
    }
    let clamped = num;
    if (startRangeMin !== undefined && num < startRangeMin) {
      clamped = startRangeMin;
    } else if (startRangeMax !== undefined && num > startRangeMax) {
      clamped = startRangeMax;
    }
    reconcileMaterialOrder('start', startMateri, clamped, materi, hal);
  };

  const handleStartPageUp = () => {
    if (!isAdmin) return;
    const currentNum = parseInt(String(startHal), 10);
    if (isNaN(currentNum)) {
      const target = startRangeMin !== undefined ? startRangeMin : 1;
      let nextMat = startMateri;
      if (!nextMat && availableUnits.length > 0) {
        const uMatch = findUnitForPageWithPartPriority(target);
        if (uMatch) nextMat = uMatch.id;
      }
      reconcileMaterialOrder('start', nextMat, target, materi, hal);
      return;
    }
    if (isAtStartRangeMax) {
      if (canStepToNextStartUnit) {
        const nextUnit = availableUnits[startUnitIndex + 1];
        const nextStart = nextUnit.page_start ?? (nextUnit as any).pageStart;
        const nextPage = nextStart !== undefined ? Number(nextStart) : 1;
        triggerMaterialFlash('start');
        reconcileMaterialOrder('start', nextUnit.id, nextPage, materi, hal);
      }
      return;
    }
    const nextNum = currentNum + 1;
    let nextMat = startMateri;
    if (!nextMat && availableUnits.length > 0) {
      const uMatch = findUnitForPageWithPartPriority(nextNum);
      if (uMatch) nextMat = uMatch.id;
    }
    reconcileMaterialOrder('start', nextMat, nextNum, materi, hal);
  };

  const handleStartPageDown = () => {
    if (!isAdmin) return;
    const currentNum = parseInt(String(startHal), 10);
    if (isNaN(currentNum)) {
      const target = startRangeMin !== undefined ? startRangeMin : 1;
      let nextMat = startMateri;
      if (!nextMat && availableUnits.length > 0) {
        const uMatch = findUnitForPageWithPartPriority(target);
        if (uMatch) nextMat = uMatch.id;
      }
      reconcileMaterialOrder('start', nextMat, target, materi, hal);
      return;
    }
    if (isAtStartRangeMin) {
      if (canStepToPrevStartUnit) {
        const prevUnit = availableUnits[startUnitIndex - 1];
        const prevEnd = prevUnit.page_end ?? (prevUnit as any).pageEnd ?? prevUnit.page_start ?? (prevUnit as any).pageStart;
        const prevPage = prevEnd !== undefined ? Number(prevEnd) : 1;
        triggerMaterialFlash('start');
        reconcileMaterialOrder('start', prevUnit.id, prevPage, materi, hal);
      }
      return;
    }
    const nextNum = currentNum - 1;
    let nextMat = startMateri;
    if (!nextMat && availableUnits.length > 0) {
      const uMatch = findUnitForPageWithPartPriority(nextNum);
      if (uMatch) nextMat = uMatch.id;
    }
    reconcileMaterialOrder('start', nextMat, nextNum, materi, hal);
  };

  const isStartMateriDraft = (startMateri ?? '') !== (baselineSnapshotRef.current?.startMateri ?? '');
  const isStartHalDraft = String(startHal ?? '') !== String(baselineSnapshotRef.current?.startHal ?? '');

  // --- END MATERIAL & PAGE HELPERS ---
  const matchedUnit = resolveUnitByIdOrTitle(materi);

  const [rangeMin, rangeMax] = React.useMemo(
    () => getUnitRange(matchedUnit),
    [matchedUnit]
  );

  const endUnitIndex = matchedUnit ? availableUnits.findIndex((u) => u.id === matchedUnit.id) : -1;
  const canStepToNextUnit = endUnitIndex !== -1 && endUnitIndex < availableUnits.length - 1;
  const canStepToPrevUnit = endUnitIndex > 0;

  const currentHalNum = parseInt(String(hal), 10);
  const isAtEndRangeMax = rangeMax !== undefined && !isNaN(currentHalNum) && currentHalNum >= rangeMax;
  const isAtEndRangeMin = rangeMin !== undefined && !isNaN(currentHalNum) && currentHalNum <= rangeMin;

  const isUpDisabled = !isAdmin || (isAtEndRangeMax && !canStepToNextUnit);
  const isDownDisabled = !isAdmin || (isAtEndRangeMin && !canStepToPrevUnit);

  const isUpCrossingBoundary = isAtEndRangeMax && canStepToNextUnit;
  const isDownCrossingBoundary = isAtEndRangeMin && canStepToPrevUnit;

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

    const currentPart = matchedUnit?.part ?? (matchedUnit as any)?.volumeNumber;
    if (!materi && availableUnits.length > 0) {
      const uMatch = findUnitForPageWithPartPriority(num, currentPart);
      if (uMatch) setMateri(uMatch.id);
    } else if (matchedUnit && (rangeMin === undefined || num < rangeMin || (rangeMax !== undefined && num > rangeMax))) {
      // If typed page is out of current unit's range, check if another unit in current part contains this page
      const altMatch = findUnitForPageWithPartPriority(num, currentPart);
      if (altMatch && altMatch.id !== matchedUnit.id) {
        setMateri(altMatch.id);
        triggerMaterialFlash('end');
      }
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
    let clamped = num;
    if (rangeMin !== undefined && num < rangeMin) {
      clamped = rangeMin;
    } else if (rangeMax !== undefined && num > rangeMax) {
      clamped = rangeMax;
    }
    reconcileMaterialOrder('end', startMateri, startHal, materi, clamped);
  };

  const handlePageUp = () => {
    if (!isAdmin) return;
    const currentNum = parseInt(String(hal), 10);
    if (isNaN(currentNum)) {
      const target = rangeMin !== undefined ? rangeMin : 1;
      let nextMat = materi;
      if (!nextMat && availableUnits.length > 0) {
        const uMatch = findUnitForPageWithPartPriority(target);
        if (uMatch) nextMat = uMatch.id;
      }
      reconcileMaterialOrder('end', startMateri, startHal, nextMat, target);
      return;
    }
    if (isAtEndRangeMax) {
      if (canStepToNextUnit) {
        const nextUnit = availableUnits[endUnitIndex + 1];
        const nextStart = nextUnit.page_start ?? (nextUnit as any).pageStart;
        const nextPage = nextStart !== undefined ? Number(nextStart) : 1;
        triggerMaterialFlash('end');
        reconcileMaterialOrder('end', startMateri, startHal, nextUnit.id, nextPage);
      }
      return;
    }
    const nextNum = currentNum + 1;
    let nextMat = materi;
    if (!nextMat && availableUnits.length > 0) {
      const uMatch = findUnitForPageWithPartPriority(nextNum);
      if (uMatch) nextMat = uMatch.id;
    }
    reconcileMaterialOrder('end', startMateri, startHal, nextMat, nextNum);
  };

  const handlePageDown = () => {
    if (!isAdmin) return;
    const currentNum = parseInt(String(hal), 10);
    if (isNaN(currentNum)) {
      const target = rangeMin !== undefined ? rangeMin : 1;
      let nextMat = materi;
      if (!nextMat && availableUnits.length > 0) {
        const uMatch = findUnitForPageWithPartPriority(target);
        if (uMatch) nextMat = uMatch.id;
      }
      reconcileMaterialOrder('end', startMateri, startHal, nextMat, target);
      return;
    }
    if (isAtEndRangeMin) {
      if (canStepToPrevUnit) {
        const prevUnit = availableUnits[endUnitIndex - 1];
        const prevEnd = prevUnit.page_end ?? (prevUnit as any).pageEnd ?? prevUnit.page_start ?? (prevUnit as any).pageStart;
        const prevPage = prevEnd !== undefined ? Number(prevEnd) : 1;
        triggerMaterialFlash('end');
        reconcileMaterialOrder('end', startMateri, startHal, prevUnit.id, prevPage);
      }
      return;
    }
    const nextNum = currentNum - 1;
    let nextMat = materi;
    if (!nextMat && availableUnits.length > 0) {
      const uMatch = findUnitForPageWithPartPriority(nextNum);
      if (uMatch) nextMat = uMatch.id;
    }
    reconcileMaterialOrder('end', startMateri, startHal, nextMat, nextNum);
  };

  const isMateriDraft = (materi ?? '') !== (baselineSnapshotRef.current?.materi ?? '');
  const isHalDraft = String(hal ?? '') !== String(baselineSnapshotRef.current?.hal ?? '');
  const isNotesDraft = (meetingNotes ?? '') !== (baselineSnapshotRef.current?.meetingNotes ?? '');

  const filteredStudents = students.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.nisn && s.nisn.toLowerCase().includes(q));
  });

  const displaySession = sessionTitle || data?.meeting?.sessionName || 'Sesi';
  const displayClass = classTitle || data?.meeting?.className || 'Kelas';
  const displayMeetingNumber = meetingNumber ?? (!loading ? data?.meeting?.meetingIndex : undefined);

  // Compute live local draft status based on divergence from server baseline
  const isLocalDraft = Boolean(
    !loading &&
    baselineRef.current !== null &&
    serializeState({
      teacherStatus,
      teacherTime,
      teacherTimeEnd,
      teacherNote,
      students,
      meetingNotes,
      materi,
      hal,
      startMateri,
      startHal,
    }) !== baselineRef.current
  );

  const effectiveHasDraft = Boolean(hasDraft || isLocalDraft);

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
          className={`pointer-events-auto w-screen max-w-md sm:max-w-xl h-[60dvh] border border-white mt-auto rounded-t-2xl sm:rounded-none shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right ${
            isCancelled
              ? 'bg-slate-400 text-slate-600'
              : 'bg-white'
          } ${effectiveHasDraft ? 'ring-4 ring-amber-400' : ''}`}
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
                  {displaySession} • {data?.meeting?.subjectName || 'Pelajaran'} • {displayClass}
                </span>
                <span className={`text-[10px] truncate block ${isCancelled ? 'text-slate-300' : 'text-white/75'}`}>
                  {[
                    !isCancelled && displayMeetingNumber && displayMeetingNumber > 0 ? `Pertemuan #${displayMeetingNumber}` : '',
                    formattedDate || '',
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </span>
              </div>
            </div>

            {/* Right: Discard Draft & Close X */}
            <div className="flex items-center gap-1 shrink-0">
              {isAdmin && effectiveHasDraft && (
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
          {/* Scrollable Body with Sticky Bottom Session Manager Dock       */}
          {/* ------------------------------------------------------------- */}
          <div className="flex-1 overflow-y-auto flex flex-col [scrollbar-gutter:stable]">
            <div className={`flex-1 p-4 pr-5 sm:pr-6 space-y-3 ${isCancelled ? 'opacity-50' : ''}`}>
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
                {/* 1. Material & Page Range Strip (Dual: Start & End of Materials with Unified Default & Clear) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center gap-2 text-xs">
                  <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    {/* Start Material Row */}
                    <div className={`flex items-center gap-2 min-w-0 rounded-lg p-0.5 transition-all duration-300 ${flashingMaterial === 'start' ? 'ring-2 ring-amber-400 bg-amber-100/70 animate-pulse' : ''}`}>
                      <div className="relative flex items-center shrink-0" title="Materi Awal">
                        <LogOut className="w-4 h-4 text-slate-600" /><BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        {isStartMateriDraft && (
                          <span
                            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                            title="Materi awal berubah dari database"
                          />
                        )}
                      </div>

                      <select
                        value={matchedStartUnit ? matchedStartUnit.id : ''}
                        disabled={!isAdmin}
                        onChange={(e) => {
                          const unit = availableUnits.find((u) => u.id === e.target.value);
                          if (unit) {
                            const startP = unit.page_start ?? (unit as any).pageStart;
                            const nextStartHal =
                              startP !== undefined && startP !== null && startP !== '' ? startP : '';
                            reconcileMaterialOrder('start', unit.id, nextStartHal, materi, hal);
                          } else {
                            setStartMateri('');
                            setStartHal('');
                          }
                        }}
                        className="flex-1 min-w-0 bg-transparent font-medium text-slate-800 focus:outline-none text-xs cursor-pointer truncate"
                      >
                        <option value="" className="text-slate-400">{!matchedStartUnit && startMateri ? startMateri : 'Materi awal...'}</option>
                        {availableUnits.map((u) => (
                          <option key={u.id} value={u.id}>
                            {formatUnitOptionLabel(u)}
                          </option>
                        ))}
                      </select>

                      <div
                        className="relative flex items-center gap-0.5 shrink-0 bg-white border border-slate-200 rounded-lg px-0.5 py-0.5"
                        title={
                          startRangeMin !== undefined && startRangeMax !== undefined
                            ? `Rentang halaman materi awal: ${startRangeMin} - ${startRangeMax}`
                            : 'Halaman mulai'
                        }
                      >
                        <button
                          type="button"
                          disabled={isStartDownDisabled}
                          onClick={handleStartPageDown}
                          className={`p-0.5 rounded disabled:opacity-20 disabled:pointer-events-none cursor-pointer leading-none transition-colors ${
                            isStartDownCrossingBoundary
                              ? 'text-amber-600 bg-amber-50 ring-1 ring-amber-300 hover:bg-amber-100'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                          title={isStartDownCrossingBoundary ? 'Kembali ke materi sebelumnya' : startRangeMin !== undefined ? `Kurang halaman (Min: ${startRangeMin})` : 'Kurang halaman'}
                        >
                          {isStartDownCrossingBoundary ? (
                            <SkipBack className="w-3 h-3 stroke-[2.5]" />
                          ) : (
                            <ChevronLeft className="w-3 h-3 stroke-[2.5]" />
                          )}
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={startHal}
                          disabled={!isAdmin}
                          onChange={(e) => handleStartPageChange(e.target.value)}
                          onBlur={handleStartPageBlur}
                          placeholder={startRangeMin !== undefined ? String(startRangeMin) : '—'}
                          className="w-8 bg-transparent text-center font-mono font-bold text-slate-800 focus:outline-none text-xs"
                        />
                        <button
                          type="button"
                          disabled={isStartUpDisabled}
                          onClick={handleStartPageUp}
                          className={`p-0.5 rounded disabled:opacity-20 disabled:pointer-events-none cursor-pointer leading-none transition-colors ${
                            isStartUpCrossingBoundary
                              ? 'text-amber-600 bg-amber-50 ring-1 ring-amber-300 hover:bg-amber-100'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                          title={isStartUpCrossingBoundary ? 'Lanjut ke materi berikutnya' : startRangeMax !== undefined ? `Tambah halaman (Maks: ${startRangeMax})` : 'Tambah halaman'}
                        >
                          {isStartUpCrossingBoundary ? (
                            <SkipForward className="w-3 h-3 stroke-[2.5]" />
                          ) : (
                            <ChevronRight className="w-3 h-3 stroke-[2.5]" />
                          )}
                        </button>
                        {isStartHalDraft && (
                          <span
                            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                            title="Halaman awal berubah dari database"
                          />
                        )}
                      </div>
                    </div>

                    {/* End Material Row */}
                    <div className={`flex items-center gap-2 min-w-0 pt-1.5 border-t border-slate-200/60 rounded-lg p-0.5 transition-all duration-300 ${flashingMaterial === 'end' ? 'ring-2 ring-amber-400 bg-amber-100/70 animate-pulse' : ''}`}>
                      <div className="relative flex items-center shrink-0" title="Materi Akhir">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        {isMateriDraft && (
                          <span
                            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                            title="Materi akhir berubah dari database"
                          />
                        )}
                        <LogIn className="w-4 h-4 text-slate-600" />
                      </div>

                      <select
                        value={matchedUnit ? matchedUnit.id : ''}
                        disabled={!isAdmin}
                        onChange={(e) => {
                          const unit = availableUnits.find((u) => u.id === e.target.value);
                          if (unit) {
                            const endP = unit.page_end ?? (unit as any).pageEnd ?? unit.page_start ?? (unit as any).pageStart;
                            const nextEndHal =
                              endP !== undefined && endP !== null && endP !== '' ? endP : '';
                            reconcileMaterialOrder('end', startMateri, startHal, unit.id, nextEndHal);
                          } else {
                            setMateri('');
                            setHal('');
                          }
                        }}
                        className="flex-1 min-w-0 bg-transparent font-medium text-slate-800 focus:outline-none text-xs cursor-pointer truncate"
                      >
                        <option value="" className="text-slate-400">{!matchedUnit && materi ? materi : 'Materi akhir...'}</option>
                        {availableUnits.map((u) => (
                          <option key={u.id} value={u.id}>
                            {formatUnitOptionLabel(u)}
                          </option>
                        ))}
                      </select>

                      <div
                        className="relative flex items-center gap-0.5 shrink-0 bg-white border border-slate-200 rounded-lg px-0.5 py-0.5"
                        title={
                          rangeMin !== undefined && rangeMax !== undefined
                            ? `Rentang halaman materi akhir: ${rangeMin} - ${rangeMax}`
                            : 'Halaman selesai'
                        }
                      >
                        <button
                          type="button"
                          disabled={isDownDisabled}
                          onClick={handlePageDown}
                          className={`p-0.5 rounded disabled:opacity-20 disabled:pointer-events-none cursor-pointer leading-none transition-colors ${
                            isDownCrossingBoundary
                              ? 'text-amber-600 bg-amber-50 ring-1 ring-amber-300 hover:bg-amber-100'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                          title={isDownCrossingBoundary ? 'Kembali ke materi sebelumnya' : rangeMin !== undefined ? `Kurang halaman (Min: ${rangeMin})` : 'Kurang halaman'}
                        >
                          {isDownCrossingBoundary ? (
                            <SkipBack className="w-3 h-3 stroke-[2.5]" />
                          ) : (
                            <ChevronLeft className="w-3 h-3 stroke-[2.5]" />
                          )}
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={hal}
                          disabled={!isAdmin}
                          onChange={(e) => handlePageChange(e.target.value)}
                          onBlur={handlePageBlur}
                          placeholder={rangeMax !== undefined ? String(rangeMax) : '—'}
                          className="w-8 bg-transparent text-center font-mono font-bold text-slate-800 focus:outline-none text-xs"
                        />
                        <button
                          type="button"
                          disabled={isUpDisabled}
                          onClick={handlePageUp}
                          className={`p-0.5 rounded disabled:opacity-20 disabled:pointer-events-none cursor-pointer leading-none transition-colors ${
                            isUpCrossingBoundary
                              ? 'text-amber-600 bg-amber-50 ring-1 ring-amber-300 hover:bg-amber-100'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                          title={isUpCrossingBoundary ? 'Lanjut ke materi berikutnya' : rangeMax !== undefined ? `Tambah halaman (Maks: ${rangeMax})` : 'Tambah halaman'}
                        >
                          {isUpCrossingBoundary ? (
                            <SkipForward className="w-3 h-3 stroke-[2.5]" />
                          ) : (
                            <ChevronRight className="w-3 h-3 stroke-[2.5]" />
                          )}
                        </button>
                        {isHalDraft && (
                          <span
                            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                            title="Halaman akhir berubah dari database"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unified Actions: Default (Pencil) & Clear (X) affecting both divs simultaneously */}
                  {isAdmin && (
                    <div className="flex flex-col items-center justify-center gap-1.5 shrink-0 border-l border-slate-200 pl-2 self-stretch">
                      <button
                        type="button"
                        onClick={() => {
                          const targetUnit =
                            (targetUnitId && resolveUnitByIdOrTitle(targetUnitId)) ||
                            (targetMateri && resolveUnitByIdOrTitle(targetMateri)) ||
                            availableUnits[0];
                          const defMateri = targetUnit ? targetUnit.id : (targetUnitId || targetMateri || '');

                          // Parse target_page_range if present (e.g. "1-5" or "10-20")
                          let defStartHal: string | number = '';
                          let defEndHal: string | number = '';
                          const targetRangeStr = data?.meeting?.target_page_range || '';
                          if (targetRangeStr.includes('-')) {
                            const [pS, pE] = targetRangeStr.split('-').map((s: string) => s.trim());
                            if (pS && !isNaN(Number(pS))) defStartHal = Number(pS);
                            if (pE && !isNaN(Number(pE))) defEndHal = Number(pE);
                          }

                          if (defStartHal === '' && targetUnit) {
                            const rawStart = targetUnit.page_start ?? (targetUnit as any).pageStart;
                            if (rawStart !== undefined && rawStart !== null && rawStart !== '') {
                              defStartHal = rawStart;
                            }
                          }

                          if (defEndHal === '') {
                            if (targetHal !== undefined && targetHal !== null && targetHal !== '') {
                              defEndHal = targetHal;
                            } else if (targetUnit) {
                              const rawEnd = targetUnit.page_end ?? (targetUnit as any).pageEnd ?? targetUnit.page_start ?? (targetUnit as any).pageStart;
                              if (rawEnd !== undefined && rawEnd !== null && rawEnd !== '') {
                                defEndHal = rawEnd;
                              }
                            }
                          }

                          reconcileMaterialOrder('start', defMateri, defStartHal, defMateri, defEndHal);
                        }}
                        className="p-1 rounded text-[10px] font-semibold hover:bg-emerald-50 text-emerald-600 transition-colors cursor-pointer"
                        title="Isi materi awal & akhir sesuai standar kurikulum"
                      >
                        <Pencil className="w-4 h-4"/>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStartMateri('');
                          setStartHal('');
                          setMateri('');
                          setHal('');
                        }}
                        className="p-1 rounded text-[10px] font-semibold hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-colors cursor-pointer"
                        title="Kosongkan materi awal & akhir serta halamannya"
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
                    ? teacherTimeEnd ? `${teacherTime}-${teacherTimeEnd}` : teacherTime
                    : teacherTimeEnd ? `--:--–${teacherTimeEnd}` : '--:--';
                  const isTeacherFlashing = flashingRowIds.has('teacher');

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
                            Pengajar:
                          </div>
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {data?.teacher.name || 'Pengampu'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Minimal Time Chip */}
                        <div className="flex items-center relative rounded text-[10px] font-mono border border-slate-200 bg-white overflow-visible transition-all shrink-0">
                          {isAdmin && (teacherTime || teacherTimeEnd) && (
                            <button
                              type="button"
                              onClick={() => applyTimeChange('teacher', 'teacher', '', '')}
                              title="Hapus jam"
                              className="px-0.5 py-0.5 hover:bg-rose-100 text-rose-700 border-r border-slate-200 font-semibold transition-colors cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!isAdmin}
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
                            className={`relative px-1.5 py-0.5 transition-all shrink-0 ${
                              isAdmin ? 'cursor-pointer' : 'cursor-default'
                            } ${
                              isTeacherFlashing
                                ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400 font-bold animate-pulse'
                                : 'text-slate-600 hover:bg-slate-100 disabled:hover:bg-transparent'
                            }`}
                            title={isAdmin ? 'Klik untuk melihat atau mengatur jam kehadiran' : 'Jam kehadiran pengajar'}
                          >
                            {teacherTimeDisplay}
                          </button>
                          {isTeacherTimeDraft && (
                            <span
                              className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                              title="Jam presensi berubah dari DB"
                            />
                          )}
                        </div>

                        {/* H-T-I-A Toggles */}
                        {renderStatusToggles(teacherStatus, dbTeacherStatus, 'teacher')}
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Student Roster Search & 3-Element Time/Batch/Mode Control */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Cari dari ${students.length} santri...`}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 text-slate-800"
                    />
                  </div>

                  {isAdmin && (() => {
                    const currentDefaults = getDefaultTimes();
                    const scheduleStart = data?.meeting?.startTime || '07:00';
                    const scheduleEnd = data?.meeting?.endTime || '08:30';
                    const isDefaultTimeCustom =
                      !!sessionDefaultTimes &&
                      (sessionDefaultTimes.start !== scheduleStart || sessionDefaultTimes.end !== scheduleEnd);
                    const defaultDisplay =
                      currentDefaults.start && currentDefaults.end
                        ? `${currentDefaults.start}-${currentDefaults.end}`
                        : currentDefaults.start || currentDefaults.end || '--:--';

                    const allHadirAndTimed =
                      students.length > 0 &&
                      students.every((s) => s.status === 'Hadir' && Boolean(s.timestampStart));

                    return (
                      <div className="flex rounded-xl border border-slate-200 bg-white items-center gap-1 shrink-0 p-0.5">
                        {/* 1. Time Display Chip (Live ticking clock in nowTime mode, session start-end in default mode) */}
                        <div
                          className={`flex items-center relative rounded-lg text-[10px] font-mono tabular-nums border transition-all shrink-0 ${
                            timeStampMode === 'nowTime'
                              ? 'border-teal-200 bg-teal-50/70 text-teal-800 font-semibold'
                              : isDefaultTimeCustom
                              ? 'border-amber-400 bg-amber-50/80 text-amber-700 font-bold'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {timeStampMode === 'default' && isDefaultTimeCustom && (
                            <button
                              type="button"
                              onClick={() => setSessionDefaultTimes(null)}
                              title="Reset ke jam jadwal"
                              className="px-0.5 py-0.5 hover:bg-rose-100 text-rose-700 border-r border-amber-200 font-semibold transition-colors cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTimePopover({
                                type: 'session_default',
                                id: 'session_default',
                                name: 'Jam Default Sesi',
                                startTime: currentDefaults.start,
                                endTime: currentDefaults.end,
                              });
                            }}
                            className={`px-1.5 py-0.5 cursor-pointer shrink-0 transition-colors whitespace-nowrap ${
                              timeStampMode === 'nowTime'
                                ? 'text-teal-800'
                                : isDefaultTimeCustom
                                ? 'text-amber-700 font-bold'
                                : 'text-slate-700 hover:text-slate-900'
                            }`}
                            title={
                              timeStampMode === 'nowTime'
                                ? 'Jam real-time (klik untuk mengatur jam default sesi)'
                                : 'Jam default sesi (klik untuk mengubah jam default)'
                            }
                          >
                            {timeStampMode === 'nowTime' ? liveNowTime : defaultDisplay}
                          </button>
                        </div>

                        {/* 2. Batch Toggle Button (Icon only) */}
                        <button
                          type="button"
                          onClick={() => markAllStudents('Hadir')}
                          className={`flex items-center justify-center p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                            allHadirAndTimed
                              ? 'bg-slate-500 hover:bg-slate-600 text-white'
                              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          }`}
                          title={
                            allHadirAndTimed
                              ? 'Batalkan status hadir untuk semua santri'
                              : timeStampMode === 'nowTime'
                              ? 'Tandai semua santri hadir (jam sekarang)'
                              : 'Tandai semua santri hadir (jam default sesi)'
                          }
                        >
                          <ListChecks className="w-3.5 h-3.5" />
                        </button>

                        {/* 3. Mode Toggle Button (Icon only: nowTime vs default) */}
                        <button
                          type="button"
                          onClick={() =>
                            setTimeStampMode((prev) => (prev === 'nowTime' ? 'default' : 'nowTime'))
                          }
                          className={`flex items-center justify-center p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                            timeStampMode === 'nowTime'
                              ? 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
                              : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                          }`}
                          title={
                            timeStampMode === 'nowTime'
                              ? 'Mode Waktu: Live (Real-time) — klik untuk beralih ke Jam Default Sesi'
                              : 'Mode Waktu: Jam Default Sesi — klik untuk beralih ke Live (Real-time)'
                          }
                        >
                          {timeStampMode === 'nowTime' ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : (
                            <CalendarClock className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })()}
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
                        ? student.timestampEnd ? `${student.timestampStart}-${student.timestampEnd}` : student.timestampStart
                        : student.timestampEnd ? `--:--–${student.timestampEnd}` : '--:--';
                      const isStudentFlashing = flashingRowIds.has(student.studentId);

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
                            <div className="flex items-center relative rounded text-[10px] font-mono border border-slate-200 bg-white overflow-visible transition-all shrink-0">
                              {isAdmin && (student.timestampStart || student.timestampEnd) && (
                                <button
                                  type="button"
                                  onClick={() => applyTimeChange('student', student.studentId, '', '')}
                                  title="Hapus jam"
                                  className="px-0.5 py-0.5 hover:bg-rose-100 text-rose-700 border-r border-slate-200 font-semibold transition-colors cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={!isAdmin}
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
                                className={`relative px-1.5 py-0.5 transition-all shrink-0 ${
                                  isAdmin ? 'cursor-pointer' : 'cursor-default'
                                } ${
                                  isStudentFlashing
                                    ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400 font-bold animate-pulse'
                                    : 'text-slate-600 hover:bg-slate-100 disabled:hover:bg-transparent'
                                }`}
                                title={isAdmin ? 'Klik untuk melihat atau mengatur jam kehadiran' : 'Jam kehadiran santri'}
                              >
                                {studentTimeDisplay}
                              </button>
                              {isStudentTimeDraft && (
                                <span
                                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                                  title="Jam presensi berubah dari DB"
                                />
                              )}
                            </div>

                            {/* H-T-I-A Toggles */}
                            {renderStatusToggles(student.status, dbStudentStatus, student.studentId)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Live draft indicator at bottom */}
                <div className="text-[10px] text-slate-400 text-center py-1">
                  {effectiveHasDraft ? (
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

            {/* 5. Sticky Bottom Session Manager Dock (session.note | session.cancel | session.complete) */}
            {!loading && !error && (isAdmin || meetingNotes.trim() !== '') && (
              <div
                className={`sticky bottom-0 z-10 border-t px-4 py-2.5 flex items-center gap-2 backdrop-blur-xs transition-colors shrink-0 ${
                  isCancelled
                    ? 'bg-slate-200/95 border-slate-300'
                    : 'bg-white/95 border-slate-200'
                }`}
              >
                {/* session.note: compact inline text field */}
                <div className="relative flex-1 min-w-0 flex items-center">
                  <StickyNote className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none shrink-0" />
                  <input
                    ref={noteInputRef}
                    type="text"
                    value={meetingNotes}
                    readOnly={!isAdmin}
                    onChange={(e) => isAdmin && setMeetingNotes(e.target.value)}
                    placeholder={isAdmin ? 'Catatan sesi...' : 'Tidak ada catatan'}
                    className={`w-full pl-8 pr-7 py-1.5 rounded-xl border text-xs text-slate-800 focus:outline-none transition-colors ${
                      isAdmin
                        ? 'bg-slate-50 border-slate-200 focus:border-amber-400 focus:bg-white'
                        : 'bg-slate-100 border-slate-200 text-slate-600 cursor-default'
                    }`}
                  />
                  {isAdmin && meetingNotes && (
                    <button
                      type="button"
                      onClick={() => setMeetingNotes('')}
                      title="Hapus catatan"
                      className="absolute right-2 p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {isNotesDraft && (
                    <span
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
                      title="Catatan berubah dari database"
                    />
                  )}
                </div>

                {/* session.cancel: Cancel / Restore Session button */}
                {isAdmin && onSetSessionStatus && (
                  <button
                    type="button"
                    onClick={() => onSetSessionStatus(meetingId, isCancelled ? 'scheduled' : 'cancelled')}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                      isCancelled
                        ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white'
                        : 'bg-white hover:bg-rose-50 border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-700'
                    }`}
                    title={isCancelled ? 'Pulihkan sesi ini' : 'Batalkan sesi ini'}
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                )}

                {/* session.complete: End Session button (stamps nowTime as endTime for all attendees with startTime) */}
                {isAdmin && (() => {
                  const hasAnyStartTime = Boolean(teacherTime) || students.some((s) => Boolean(s.timestampStart));
                  return (
                    <button
                      type="button"
                      disabled={!hasAnyStartTime}
                      onClick={handleEndSession}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#024884] hover:bg-[#01396a] disabled:opacity-40 disabled:pointer-events-none text-white shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      title={
                        hasAnyStartTime
                          ? 'Akhiri sesi & catat jam selesai (sekarang) untuk semua yang memiliki jam masuk'
                          : 'Tandai minimal satu kehadiran sebelum mengakhiri sesi'
                      }
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Akhiri</span>
                    </button>
                  );
                })()}
              </div>
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
                onChange={(e) => handlePopoverTimeChange('startTime', e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-400"
              />
              <span className="text-slate-400 text-xs">–</span>
              <input
                type="time"
                value={activeTimePopover.endTime}
                disabled={!isAdmin}
                onChange={(e) => handlePopoverTimeChange('endTime', e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-400"
              />
              {isAdmin && (
                <button
                  type="button"
                  title={activeTimePopover.type === 'session_default' ? 'Reset ke jam jadwal' : 'Terapkan jam default sesi'}
                  onClick={() => {
                    if (activeTimePopover.type === 'session_default') {
                      const base = {
                        start: data?.meeting?.startTime || '07:00',
                        end: data?.meeting?.endTime || '08:30',
                      };
                      setActiveTimePopover((p) => (p ? { ...p, startTime: base.start, endTime: base.end } : null));
                      setSessionDefaultTimes(null);
                    } else {
                      const { start, end } = getDefaultTimes();
                      setActiveTimePopover((p) => (p ? { ...p, startTime: start, endTime: end } : null));
                      applyTimeChange(activeTimePopover.type, activeTimePopover.id, start, end);
                    }
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
