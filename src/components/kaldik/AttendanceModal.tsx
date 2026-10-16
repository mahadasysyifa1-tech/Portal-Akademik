import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Users,
  Building,
  BookOpen,
  Calendar,
  Save,
  Check,
  Search,
  Sparkles
} from 'lucide-react';
import type {
  AttendanceStatus,
  AttendanceRollCallData,
  AttendanceRollCallStudent,
} from '../../types';
import type { PendingRollCallLog } from '../../utils/useAttendancePendingStore';

interface AttendanceModalProps {
  meetingId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  targetMateri?: string;
  targetHal?: number;
  targetUnitId?: string;
  availableUnits?: Array<{ id: string; title: string; pageStart?: number | string; pageEnd?: number | string }>;
  initialDraft?: Omit<PendingRollCallLog, 'meetingId'>;
  onSaveDraft?: (draftPayload: Omit<PendingRollCallLog, 'meetingId'>) => void;
}

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string; activeClass: string; inactiveClass: string }> = [
  { value: 'Hadir', label: 'Hadir', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-2xs', inactiveClass: 'text-slate-600 hover:bg-slate-100 border-slate-200' },
  { value: 'Izin', label: 'Izin', activeClass: 'bg-sky-600 text-white border-sky-600 shadow-2xs', inactiveClass: 'text-slate-600 hover:bg-slate-100 border-slate-200' },
  { value: 'Sakit', label: 'Sakit', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-2xs', inactiveClass: 'text-slate-600 hover:bg-slate-100 border-slate-200' },
  { value: 'Terlambat', label: 'Terlambat', activeClass: 'bg-orange-500 text-white border-orange-500 shadow-2xs', inactiveClass: 'text-slate-600 hover:bg-slate-100 border-slate-200' },
  { value: 'Alpa', label: 'Alpa', activeClass: 'bg-rose-600 text-white border-rose-600 shadow-2xs', inactiveClass: 'text-slate-600 hover:bg-slate-100 border-slate-200' },
];

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  meetingId,
  isOpen,
  onClose,
  onSaved,
  targetMateri = '',
  targetHal,
  targetUnitId,
  availableUnits = [],
  initialDraft,
  onSaveDraft
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AttendanceRollCallData | null>(null);

  // Editable local state
  const [teacherStatus, setTeacherStatus] = useState<AttendanceStatus>('Hadir');
  const [teacherTime, setTeacherTime] = useState<string>('08:00');
  const [teacherNote, setTeacherNote] = useState<string>('');
  const [meetingNotes, setMeetingNotes] = useState<string>('');
  const [students, setStudents] = useState<AttendanceRollCallStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Minimal material progress state (just two fields: materi & hal)
  const [materi, setMateri] = useState<string>(targetMateri || '');
  const [hal, setHal] = useState<string | number>(targetHal !== undefined ? targetHal : '');

  // Fetch server roll call, then overlay any unsaved local draft on top of it
  useEffect(() => {
    if (!isOpen || !meetingId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    fetch(`/api/attendance/meetings/${meetingId}/logs`)
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat data presensi');
        return res.json();
      })
      .then((resData: AttendanceRollCallData) => {
        if (!isMounted) return;
        const draft = initialDraft;

        setData(resData);
        setTeacherStatus(draft?.teacherLog?.status || resData.teacher.status || 'Hadir');
        setTeacherTime(
          draft?.teacherLog?.timestampStart ||
            resData.teacher.timestampStart ||
            resData.meeting.startTime ||
            '08:00'
        );
        setTeacherNote(draft?.teacherLog?.note ?? resData.teacher.note ?? '');

        // Saved notes / material progress first, then the draft overrides them
        let parsedSummary = resData.meeting.notes || '';
        let foundMateri = targetMateri || '';
        let foundHal: string | number = targetHal !== undefined ? targetHal : '';

        if (resData.meeting.notes && resData.meeting.notes.startsWith('{')) {
          try {
            const obj = JSON.parse(resData.meeting.notes);
            if (obj.summary) parsedSummary = obj.summary;
            if (obj.materialProgress) {
              if (obj.materialProgress.materi) foundMateri = obj.materialProgress.materi;
              if (obj.materialProgress.hal !== undefined) foundHal = obj.materialProgress.hal;
            }
          } catch {}
        }

        setMeetingNotes(draft?.meetingNotes ?? parsedSummary);
        setMateri(draft?.materialProgress?.materi ?? foundMateri);
        setHal(draft?.materialProgress?.hal ?? foundHal);

        // Draft student rows replace the server row with the same studentId
        const draftById = new Map<
          string,
          { status: AttendanceStatus; timestampStart?: string; timestampEnd?: string; note?: string }
        >();
        (draft?.studentLogs || []).forEach((l) => draftById.set(l.studentId, l));

        setStudents(
          (resData.students || []).map((s) => {
            const d = draftById.get(s.studentId);
            return d
              ? { ...s, status: d.status, timestampStart: d.timestampStart, timestampEnd: d.timestampEnd, note: d.note }
              : s;
          })
        );
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Terjadi kesalahan sistem');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, meetingId, initialDraft]);

  if (!isOpen) return null;

  // Mark all students present
  const handleMarkAllPresent = () => {
    const nowTime = new Date().toTimeString().slice(0, 5);
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        status: 'Hadir',
        timestampStart: s.timestampStart || nowTime,
      }))
    );
  };

  // Change individual student status
  const handleStudentStatusChange = (studentId: string, status: AttendanceStatus) => {
    const nowTime = new Date().toTimeString().slice(0, 5);
    setStudents((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;
        return {
          ...s,
          status,
          timestampStart: s.timestampStart || (status === 'Hadir' || status === 'Terlambat' ? nowTime : undefined),
        };
      })
    );
  };

  // Update student note
  const handleStudentNoteChange = (studentId: string, note: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, note } : s))
    );
  };

  // Save changes to server
  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        teacherLog: {
          id: data.meeting.teacherId,
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
        materialProgress: {
          materi: materi.trim() || undefined,
          hal: hal !== '' && !isNaN(Number(hal)) ? Number(hal) : undefined,
          unitId: targetUnitId,
        },
      };

      if (onSaveDraft) {
        onSaveDraft(payload);
        setSaveSuccess(true);
        if (onSaved) onSaved();
        setTimeout(() => {
          onClose();
        }, 120);
        return;
      }

      const res = await fetch(`/api/attendance/meetings/${meetingId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Gagal menyimpan presensi ke database');
      }

      setSaveSuccess(true);
      if (onSaved) onSaved();

      // Responsive close without artificial waiting delay
      setTimeout(() => {
        onClose();
      }, 120);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan presensi');
    } finally {
      setSaving(false);
    }
  };

  // Filter students by name or NISN
  const filteredStudents = students.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.nisn && s.nisn.includes(q));
  });

  // Summary counts
  const countHadir = students.filter((s) => s.status === 'Hadir').length;
  const countIzin = students.filter((s) => s.status === 'Izin').length;
  const countSakit = students.filter((s) => s.status === 'Sakit').length;
  const countTerlambat = students.filter((s) => s.status === 'Terlambat').length;
  const countAlpa = students.filter((s) => s.status === 'Alpa').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                {data?.meeting.sessionName || 'Sesi Pembelajaran'}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200">
                Kelas: {data?.meeting.className || '-'}
              </span>
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {data?.meeting.startTime} - {data?.meeting.endTime}
              </span>
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {data?.meeting.meetingDate}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600 shrink-0" />
              <span>{data?.meeting.subjectName || 'Presensi Sesi'}</span>
              {data?.meeting.roomName && (
                <span className="text-xs font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md">
                  {data.meeting.roomName}
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Clock className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm font-medium">Memuat daftar presensi...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <>
              {/* Section 1: Teacher Presence */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/50 to-orange-50/40 border border-amber-200/80">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Pengajar / Ustadz
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {data?.teacher.name || 'Ustadz Pengampu'}
                      </div>
                    </div>
                  </div>

                  {/* Teacher status segmented buttons */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTeacherStatus(opt.value)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          teacherStatus === opt.value ? opt.activeClass : opt.inactiveClass
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Waktu Masuk:</span>
                    <input
                      type="time"
                      value={teacherTime}
                      onChange={(e) => setTeacherTime(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-mono font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium shrink-0">Catatan Guru:</span>
                    <input
                      type="text"
                      placeholder="e.g. Guru pengganti / izin dinas"
                      value={teacherNote}
                      onChange={(e) => setTeacherNote(e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Minimal Material Progress Section (Hanya 2 Field: Materi & Hal) */}
              <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Capaian Materi Hari Ini
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Default otomatis terisi target pembelajaran sesi ini
                      </p>
                    </div>
                  </div>

                  {targetMateri && (
                    <div className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-lg">
                      Target: {targetMateri} {targetHal ? `(Hal. ${targetHal})` : ''}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* Field 1: Materi */}
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                      Materi / Bab:
                    </label>
                    {availableUnits && availableUnits.length > 0 ? (
                      <select
                        value={materi}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMateri(val);
                          const found = availableUnits.find((u) => u.title === val || u.id === val);
                          if (found && found.pageEnd) {
                            setHal(Number(found.pageEnd));
                          }
                        }}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      >
                        {availableUnits.map((u) => (
                          <option key={u.id} value={u.title}>
                            {u.title} {u.pageStart ? `(Hal. ${u.pageStart} - ${u.pageEnd || '...'})` : ''}
                          </option>
                        ))}
                        {!availableUnits.some((u) => u.title === materi) && materi && (
                          <option value={materi}>{materi}</option>
                        )}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Nama Bab / Pembahasan..."
                        value={materi}
                        onChange={(e) => setMateri(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Field 2: Halaman (Hal) */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                      Halaman Selesai (Hal):
                    </label>
                    <input
                      type="number"
                      min={1}
                      placeholder="Contoh: 15"
                      value={hal}
                      onChange={(e) => setHal(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Student Roll Call Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-600" />
                    <span>Daftar Santri / Siswa</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {students.length} Orang
                    </span>
                  </h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Quick Mark All Present button */}
                  <button
                    type="button"
                    onClick={handleMarkAllPresent}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-300 shadow-2xs transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tandai Semua Hadir</span>
                  </button>

                  {/* Search box */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari nama / NISN..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1 rounded-xl border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none w-36 sm:w-48"
                    />
                  </div>
                </div>
              </div>

              {/* Summary Stats Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">
                  <span className="text-base font-extrabold">{countHadir}</span> Hadir
                </div>
                <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 font-bold text-sky-800">
                  <span className="text-base font-extrabold">{countIzin}</span> Izin
                </div>
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 font-bold text-amber-800">
                  <span className="text-base font-extrabold">{countSakit}</span> Sakit
                </div>
                <div className="p-2 rounded-xl bg-orange-50 border border-orange-200 font-bold text-orange-800">
                  <span className="text-base font-extrabold">{countTerlambat}</span> Terlambat
                </div>
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 font-bold text-rose-800 col-span-2 sm:col-span-1">
                  <span className="text-base font-extrabold">{countAlpa}</span> Alpa
                </div>
              </div>

              {/* High-density Student Roster Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Nama Santri</th>
                        <th className="py-2.5 px-3 w-28">NISN / Gender</th>
                        <th className="py-2.5 px-3 w-64 text-center">Status Kehadiran</th>
                        <th className="py-2.5 px-3 w-44">Keterangan / Alasan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            Tidak ada siswa yang ditemukan.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((std, idx) => (
                          <tr
                            key={std.studentId}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              std.status !== 'Hadir' ? 'bg-amber-50/20' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-900">{std.name}</div>
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                              <span className="mr-1.5">{std.nisn || '-'}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 font-sans font-bold">
                                {std.gender === 'L' ? 'Ikhwan' : 'Akhwat'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              {/* 5-status segmented toggle */}
                              <div className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                {STATUS_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleStudentStatusChange(std.studentId, opt.value)}
                                    className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all cursor-pointer ${
                                      std.status === opt.value
                                        ? opt.activeClass
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                placeholder={std.status !== 'Hadir' ? 'Tuliskan alasan...' : 'Catatan opsional'}
                                value={std.note || ''}
                                onChange={(e) => handleStudentNoteChange(std.studentId, e.target.value)}
                                className={`w-full px-2 py-1 rounded-lg border text-xs placeholder:text-slate-400 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors ${
                                  std.status !== 'Hadir' && !std.note
                                    ? 'border-amber-300 bg-amber-50/40'
                                    : 'border-slate-200 bg-white'
                                }`}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 3: Meeting General Note */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Catatan Sesi / Rangkuman Pembelajaran (Opsional):
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Pembahasan bab 3 selesai, materi lanjutan diadakan pekan depan..."
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {saveSuccess ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600" />
                Presensi berhasil disimpan ke database!
              </span>
            ) : (
              <span>Perubahan akan disimpan permanen ke server Turso</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !data}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersimpan!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Presensi</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
