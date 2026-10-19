import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Ban,
  ChevronUp,
  ChevronDown,
  Search,
  BookOpen,
  UserCheck
} from 'lucide-react';
import type {
  AttendanceStatus,
  AttendanceRollCallData,
  AttendanceRollCallStudent,
  AttendanceRollCallTeacher
} from '../../types';
import type { PendingRollCallLog } from '../../utils/useAttendancePendingStore';
import { getCachedRollCall } from '../../utils/rollCallCache';

export interface AttendanceModalProps {
  meetingId: string;
  isOpen: boolean;
  hasDraft: boolean;
  onClose: () => void;
  onSaved?: () => void;
  targetMateri?: string;
  targetHal?: number;
  targetUnitId?: string;
  availableUnits?: Array<{ id: string; title: string; pageStart?: number | string; pageEnd?: number | string }>;
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
}

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string; activeClass: string }> = [
  { value: 'Hadir', label: 'Hadir', activeClass: 'bg-emerald-600 text-white font-bold' },
  { value: 'Izin', label: 'Izin', activeClass: 'bg-sky-600 text-white font-bold' },
  { value: 'Sakit', label: 'Sakit', activeClass: 'bg-amber-500 text-white font-bold' },
  { value: 'Terlambat', label: 'Terlambat', activeClass: 'bg-orange-500 text-white font-bold' },
  { value: 'Alpa', label: 'Alpa', activeClass: 'bg-rose-600 text-white font-bold' },
];

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  meetingId,
  isOpen,
  onClose,
  targetMateri = '',
  targetHal,
  targetUnitId,
  availableUnits = [],
  initialDraft,
  onSaveDraft,
  onDiscardDraft,
  getEffectiveStatus,
  onSetSessionStatus,
  hasDraft,
  onPrevSession,
  onNextSession,
  hasPrevSession = false,
  hasNextSession = false,
  sessionTitle,
  classTitle
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AttendanceRollCallData | null>(null);

  // Editable local state
  const [teacherStatus, setTeacherStatus] = useState<AttendanceStatus | null>(null);
  const [teacherTime, setTeacherTime] = useState<string>('');
  const [teacherNote, setTeacherNote] = useState<string>('');
  const [meetingNotes, setMeetingNotes] = useState<string>('');
  const [students, setStudents] = useState<AttendanceRollCallStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Minimal material progress state (just two fields: materi & hal)
  const [materi, setMateri] = useState<string>(targetMateri || '');
  const [hal, setHal] = useState<string | number>(targetHal !== undefined ? targetHal : '');

  const baselineRef = useRef<string | null>(null);
  const lastDraftRef = useRef<{ id: string; json: string } | null>(null);
  const draftAppliedFor = useRef<string | null>(null);

  // Dynamic Theme calculations
  const serverStatus = data?.meeting?.status || 'scheduled';
  const effectiveStatus = getEffectiveStatus ? getEffectiveStatus(meetingId, serverStatus) : serverStatus;
  const isCancelled = effectiveStatus === 'cancelled';

  // Fixed field order for baseline serialization
  const serializeState = (s: Record<string, any>) =>
    JSON.stringify([s.teacherStatus, s.teacherTime, s.teacherNote, s.students, s.meetingNotes, s.materi, s.hal]);

  const buildDraftPayload = () => ({
    teacherLog: {
      id: data?.teacher.id || '',
      status: teacherStatus,
      timestampStart: teacherTime,
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
    materialProgress: { materi, hal },
  });

  // Live auto-save draft whenever values diverge from baseline
  useEffect(() => {
    if (!isOpen || !meetingId || loading || baselineRef.current === null) return;
    const current = serializeState({ teacherStatus, teacherTime, teacherNote, students, meetingNotes, materi, hal });

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
  }, [teacherStatus, teacherTime, teacherNote, students, meetingNotes, materi, hal, isOpen, meetingId, loading]);

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

    const initTeacherStatus = rollCallData.teacher?.status || 'Hadir';
    const initTeacherTime = rollCallData.teacher?.timestampStart || rollCallData.meeting.startTime || '';
    const initTeacherNote = rollCallData.teacher?.note || '';
    const initMeetingNotes = rollCallData.meeting.notes || '';

    let initMateri = targetMateri || '';
    let initHal: string | number = targetHal !== undefined ? targetHal : '';

    if (rollCallData.meeting.notes && rollCallData.meeting.notes.startsWith('{')) {
      try {
        const parsed = JSON.parse(rollCallData.meeting.notes);
        if (parsed.materialProgress) {
          if (parsed.materialProgress.materi !== undefined) initMateri = parsed.materialProgress.materi;
          if (parsed.materialProgress.hal !== undefined) initHal = parsed.materialProgress.hal;
        }
      } catch {}
    }

    const initStudents: AttendanceRollCallStudent[] = (rollCallData.students || []).map((s) => ({
      ...s,
      status: s.status || null,
      timestampStart: s.timestampStart || rollCallData.meeting.startTime || '',
    }));

    setTeacherStatus(initTeacherStatus);
    setTeacherTime(initTeacherTime);
    setTeacherNote(initTeacherNote);
    setMeetingNotes(initMeetingNotes);
    setStudents(initStudents);
    setMateri(initMateri);
    setHal(initHal);

    baselineRef.current = serializeState({
      teacherStatus: initTeacherStatus,
      teacherTime: initTeacherTime,
      teacherNote: initTeacherNote,
      students: initStudents,
      meetingNotes: initMeetingNotes,
      materi: initMateri,
      hal: initHal,
    });
  };

  // Re-apply draft overrides when ready
  useEffect(() => {
    if (loading || !initialDraft) return;
    if (draftAppliedFor.current === meetingId) return;
    draftAppliedFor.current = meetingId;

    if (initialDraft.teacherLog) {
      if (initialDraft.teacherLog.status !== undefined) setTeacherStatus(initialDraft.teacherLog.status);
      if (initialDraft.teacherLog.timestampStart !== undefined) setTeacherTime(initialDraft.teacherLog.timestampStart || '');
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
      if (mp.materi !== undefined) setMateri(mp.materi);
      if (mp.hal !== undefined) setHal(mp.hal);
    }
  }, [loading, initialDraft, meetingId]);

  if (!isOpen) return null;

  const markAllStudents = (status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        status,
        timestampStart: s.timestampStart || data?.meeting.startTime || '',
      }))
    );
  };

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? {
              ...s,
              status: s.status === status ? null : status,
              timestampStart: s.timestampStart || data?.meeting.startTime || '',
            }
          : s
      )
    );
  };

  const filteredStudents = students.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.nisn && s.nisn.toLowerCase().includes(q));
  });

  const displaySession = sessionTitle || data?.meeting?.sessionName || 'Sesi';
  const displayClass = classTitle || data?.meeting?.className || 'Kelas';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      />

      {/* Slide-Over Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div
          className={`w-screen max-w-md sm:max-w-xl h-full shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right ${
            isCancelled
              ? 'bg-slate-100 text-slate-600'
              : hasDraft
              ? 'bg-white ring-2 ring-amber-400'
              : 'bg-white'
          }`}
        >
          {/* ------------------------------------------------------------- */}
          {/* Header with Dynamic Theme & Minimal Icon Navigation           */}
          {/* ------------------------------------------------------------- */}
          <div
            className={`px-4 py-3 flex items-center justify-between transition-colors shrink-0 ${
              isCancelled
                ? 'bg-slate-700 text-white'
                : hasDraft
                ? 'bg-amber-600 text-white shadow-sm'
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
                title="Sesi Sebelumnya (▲)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onNextSession}
                disabled={!hasNextSession}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Sesi Berikutnya (▼)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              <div className="ml-1 truncate">
                <span className="text-xs font-bold leading-tight truncate block">
                  {displaySession} • {displayClass}
                </span>
                <span className="text-[10px] text-white/75 truncate block">
                  {data?.meeting?.subjectName || 'Pelajaran'}
                </span>
              </div>
            </div>

            {/* Right: Discard Draft, Cancel/Restore, Close X */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Discard Draft Button */}
              {hasDraft && onDiscardDraft && (
                <button
                  type="button"
                  onClick={() => onDiscardDraft(meetingId)}
                  className="p-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white transition-colors cursor-pointer"
                  title="Batalkan perubahan draft"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              {/* Cancel / Restore Session Button */}
              {onSetSessionStatus && (
                <button
                  type="button"
                  onClick={() => onSetSessionStatus(meetingId, isCancelled ? 'scheduled' : 'cancelled')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isCancelled
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'hover:bg-white/15 text-white/80 hover:text-white'
                  }`}
                  title={isCancelled ? 'Pulihkan sesi ini' : 'Batalkan sesi ini'}
                >
                  {isCancelled ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                </button>
              )}

              {/* Close Drawer Button */}
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
                <Ban className="w-3.5 h-3.5 text-slate-500" />
                <span>Sesi ini berstatus Dibatalkan (kehadiran tetap dapat dicatat)</span>
              </span>
              <button
                type="button"
                onClick={() => onSetSessionStatus?.(meetingId, 'scheduled')}
                className="text-emerald-700 font-bold hover:underline cursor-pointer"
              >
                Pulihkan Sesi
              </button>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* Compact Scrollable Body (Zero clutter, no bottom bar)         */}
          {/* ------------------------------------------------------------- */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
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
                {/* 1. Material & Page Range (Compact inline strip) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center gap-2 text-xs">
                  <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={materi}
                    onChange={(e) => setMateri(e.target.value)}
                    placeholder="Judul materi / bab yang diajarkan..."
                    className="flex-1 bg-transparent font-medium text-slate-800 placeholder-slate-400 focus:outline-none text-xs"
                  />
                  <div className="flex items-center gap-1 shrink-0 bg-white border border-slate-200 rounded-lg px-2 py-0.5">
                    <span className="text-[10px] text-slate-400 font-bold">Hal.</span>
                    <input
                      type="text"
                      value={hal}
                      onChange={(e) => setHal(e.target.value)}
                      placeholder="—"
                      className="w-12 bg-transparent text-right font-bold text-slate-800 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                {/* 2. Teacher Attendance (Compact single row) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Ustadz / Pengajar
                    </div>
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {data?.teacher.name || 'Pengampu'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((status) => {
                      const isActive = teacherStatus === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setTeacherStatus(status)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? status === 'Hadir'
                                ? 'bg-emerald-600 text-white'
                                : status === 'Izin'
                                ? 'bg-sky-600 text-white'
                                : status === 'Sakit'
                                ? 'bg-amber-500 text-white'
                                : 'bg-rose-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>

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

                  <button
                    type="button"
                    onClick={() => markAllStudents('Hadir')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                    title="Tandai semua santri hadir"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Semua Hadir</span>
                  </button>
                </div>

                {/* 4. Student Roster List */}
                <div className="space-y-1.5">
                  {filteredStudents.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Tidak ada santri yang cocok dengan pencarian
                    </div>
                  ) : (
                    filteredStudents.map((student, idx) => (
                      <div
                        key={student.studentId}
                        className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                          student.status === 'Hadir'
                            ? 'bg-emerald-50/40 border-emerald-200'
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

                        {/* Status buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {STATUS_OPTIONS.map((opt) => {
                            const isSelected = student.status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setStudentStatus(student.studentId, opt.value)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? opt.activeClass
                                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                {opt.value[0]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Live draft indicator at bottom */}
                <div className="text-[10px] text-slate-400 text-center py-2">
                  {hasDraft ? (
                    <span className="text-amber-600 font-semibold">
                      Perubahan tersimpan otomatis di draft lokal
                    </span>
                  ) : (
                    <span>Tersinkronisasi dengan server</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
