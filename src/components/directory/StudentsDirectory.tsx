import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseState, StudentRecord, AttendanceSummaryItem } from '../../types';
import { Search, GraduationCap, Phone, Hash, Layers, BookOpen } from 'lucide-react';
import { ClassIcon } from '../ClassIcon';
import { AttendanceHistoryModal } from './AttendanceHistoryModal';

export interface StudentCardProps {
  student: StudentRecord;
  enrolledClasses?: any[];
  summary?: AttendanceSummaryItem;
  subjectName?: string;
  onOpenHistory?: (student: StudentRecord) => void;
  onSelectSchedule?: (classId: string, studentId: string) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  enrolledClasses = [],
  summary,
  subjectName,
  onOpenHistory,
  onSelectSchedule
}) => {
  const primaryClass = enrolledClasses[0];
  const hasData = summary && summary.total > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
    <div>
    {/* Header: Name & Gender Badge */}
    <div className="flex items-start justify-between gap-2 mb-2">
    <div className="min-w-0 flex-1">
    <div className="flex items-center gap-1.5 flex-wrap">
    <h3 className="text-sm font-bold text-slate-900 truncate">
    {student.name}
    </h3>
    {student.gender && (
      <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
        student.gender === 'P'
        ? 'bg-pink-50 text-pink-700 border border-pink-200'
        : 'bg-blue-50 text-blue-700 border border-blue-200'
      }`}
      >
      {student.gender === 'P' ? 'Akhwat (P)' : 'Ikhwan (L)'}
      </span>
    )}
    </div>
    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
    <span className="flex items-center gap-1 font-mono">
    <Hash className="w-3 h-3 text-slate-400" />
    NISN: {student.nisn || student.id}
    </span>
    </div>
    </div>
    </div>

    {/* Contact info if any */}
    {student.phone && (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2.5 font-mono">
      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
      <span>{student.phone}</span>
      </div>
    )}

    {/* Enrolled Classes */}
    <div className="space-y-1 mt-2">
    <span className="text-[11px] font-semibold text-slate-500 block">
    Kelas Terdaftar:
    </span>
    <div className="flex flex-wrap gap-1">
    {enrolledClasses.length > 0 ? (
      enrolledClasses.map((cls) => cls && (
        <span
        key={cls.id}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border shadow-2xs"
        style={{
          backgroundColor: cls.color || '#E0E7FF',
          borderColor: 'rgba(0, 0, 0, 0.12)'
        }}
        >
        <ClassIcon name={cls.icon || 'GraduationCap'} className="w-3 h-3 text-slate-700" />
        <span className="text-slate-800">{cls.name}</span>
        </span>
      ))
    ) : (
      <span className="text-[11px] text-slate-400 italic">
      Belum terdaftar di rombel manapun
      </span>
    )}
    </div>
    </div>

    {/* Presence Summary Progress Bar */}
    <div
    onClick={() => onOpenHistory?.(student)}
    className={`mt-3 pt-2.5 border-t border-slate-100 group -mx-1 px-1.5 py-1.5 rounded-xl transition-colors ${onOpenHistory ? 'cursor-pointer hover:bg-slate-50/80' : ''}`}
    title={onOpenHistory ? 'Klik untuk melihat riwayat kehadiran sesi' : undefined}
    >
    <div className="flex items-center justify-between text-xs mb-1">
    <span className={`text-[11px] font-semibold text-slate-600 ${onOpenHistory ? 'group-hover:text-indigo-600' : ''} transition-colors`}>
    {subjectName ? `Kehadiran ${subjectName}:` : 'Kehadiran:'}
    </span>
    {hasData ? (
      <span className="font-bold text-xs flex items-center gap-1">
      <span
      className={
        summary.rate >= 85
        ? 'text-emerald-600'
    : summary.rate >= 70
    ? 'text-amber-600'
    : 'text-rose-600'
      }
      >
      {summary.rate}%
      </span>
      <span className="text-[10px] font-normal text-slate-400">
      ({summary.hadir + summary.terlambat}/{summary.total} sesi)
      </span>
      </span>
    ) : (
      <span className="text-[10px] text-slate-400 italic">Belum ada data</span>
    )}
    </div>
    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
    <div
    className={`h-full rounded-full transition-all duration-300 ${
      !hasData
      ? 'bg-slate-200'
  : summary.rate >= 85
  ? 'bg-emerald-500'
  : summary.rate >= 70
  ? 'bg-amber-500'
  : 'bg-rose-500'
    }`}
    style={{ width: `${hasData ? Math.min(100, summary.rate) : 0}%` }}
    />
    </div>
    </div>
    </div>

    {/* Footer Action */}
    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
    <span className="text-[11px] text-slate-400">
    {enrolledClasses.length} rombel
    </span>
    {onSelectSchedule && primaryClass ? (
      <button
      type="button"
      onClick={() => onSelectSchedule(primaryClass.id, student.id)}
      className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
      >
      Lihat Jadwal Santri →
      </button>
    ) : (
      <span className="text-[11px] text-slate-400 italic">Tanpa jadwal</span>
    )}
    </div>
    </div>
  );
};

interface StudentsDirectoryProps {
  db: DatabaseState;
  onBackToSchedule: () => void;
  onSelectStudentSchedule: (classId: string, studentId?: string) => void;
}

export const StudentsDirectory: React.FC<StudentsDirectoryProps> = ({
  db,
  onSelectStudentSchedule
}) => {
  const [search, setSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'L' | 'P'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [summaryMap, setSummaryMap] = useState<Record<string, AttendanceSummaryItem>>({});
  const [activeStudentForHistory, setActiveStudentForHistory] = useState<StudentRecord | null>(null);

  // Reload the summary whenever the subject filter changes
  useEffect(() => {
    let isMounted = true;
    const url =
    subjectFilter === 'all'
    ? '/api/attendance/summary?type=student'
    : `/api/attendance/summary?type=student&subjectId=${encodeURIComponent(subjectFilter)}`;

    fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (isMounted && data && typeof data === 'object') {
        setSummaryMap(data);
      }
    })
    .catch((err) => console.error('Failed to load student attendance summary:', err));

    return () => {
      isMounted = false;
    };
  }, [subjectFilter]);

  const classMap = useMemo(() => new Map((db.classes || []).map((c) => [c.id, c])), [db.classes]);

  // Map studentId -> array of classIds from db.enrollments and student.enrolledClassIds
  const studentEnrollmentsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    (db.students || []).forEach((s) => {
      if (s.enrolledClassIds && s.enrolledClassIds.length > 0) {
        map.set(s.id, [...s.enrolledClassIds]);
      }
    });

    (db.enrollments || []).forEach((e) => {
      const current = map.get(e.studentId) || [];
      if (!current.includes(e.classId)) {
        current.push(e.classId);
      }
      map.set(e.studentId, current);
    });

    return map;
  }, [db.students, db.enrollments]);

  const studentsList: StudentRecord[] = useMemo(() => {
    return db.students || [];
  }, [db.students]);

  const filteredStudents = useMemo(() => {
    return studentsList.filter((s) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.nisn && s.nisn.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (genderFilter !== 'all' && s.gender !== genderFilter) {
        return false;
      }

      if (selectedClassFilter !== 'all') {
        const enrolled = studentEnrollmentsMap.get(s.id) || [];
        if (!enrolled.includes(selectedClassFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [studentsList, search, genderFilter, selectedClassFilter, studentEnrollmentsMap]);

  // Statistics
  const stats = useMemo(() => {
    const total = studentsList.length;
    const ikhwan = studentsList.filter((s) => s.gender === 'L').length;
    const akhwat = studentsList.filter((s) => s.gender === 'P').length;
    return { total, ikhwan, akhwat };
  }, [studentsList]);

  const selectedSubjectName =
  subjectFilter === 'all'
  ? undefined
  : (db.subjects || []).find((s) => s.id === subjectFilter)?.name;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
    {/* Top Controls Bar */}
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
    <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
    {/* Search */}
    <div className="relative flex-1 min-w-[200px] max-w-sm">
    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
    <input
    type="text"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    placeholder="Cari santri, NISN, atau kontak..."
    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
    />
    </div>

    {/* Filter Kelas */}
    <div className="flex items-center gap-1.5">
    <Layers className="w-3.5 h-3.5 text-slate-400" />
    <select
    value={selectedClassFilter}
    onChange={(e) => setSelectedClassFilter(e.target.value)}
    className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
    >
    <option value="all">Semua Kelas ({db.classes?.length || 0})</option>
    {(db.classes || []).map((c) => (
      <option key={c.id} value={c.id}>
      {c.name}
      </option>
    ))}
    </select>
    </div>

    {/* Filter Mapel (Presensi per mapel) */}
    <div className="flex items-center gap-1.5">
    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
    <select
    value={subjectFilter}
    onChange={(e) => setSubjectFilter(e.target.value)}
    className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[180px]"
    >
    <option value="all">Semua Mapel</option>
    {(db.subjects || []).map((s) => (
      <option key={s.id} value={s.id}>
      {s.name}
      </option>
    ))}
    </select>
    </div>

    {/* Gender Filter Buttons */}
    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
    <button
    type="button"
    onClick={() => setGenderFilter('all')}
    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
      genderFilter === 'all'
      ? 'bg-white text-slate-800 shadow-2xs'
      : 'text-slate-500 hover:text-slate-800'
    }`}
    >
    Semua
    </button>
    <button
    type="button"
    onClick={() => setGenderFilter('L')}
    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
      genderFilter === 'L'
      ? 'bg-blue-600 text-white shadow-2xs'
      : 'text-slate-500 hover:text-blue-700'
    }`}
    >
    Ikhwan
    </button>
    <button
    type="button"
    onClick={() => setGenderFilter('P')}
    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
      genderFilter === 'P'
      ? 'bg-pink-600 text-white shadow-2xs'
      : 'text-slate-500 hover:text-pink-700'
    }`}
    >
    Akhwat
    </button>
    </div>
    </div>

    {/* Stats Summary */}
    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
    <span>
    Total: <strong className="text-slate-800">{filteredStudents.length}</strong> Santri
    </span>
    <span className="text-slate-300">·</span>
    <span className="text-blue-600 font-semibold">{stats.ikhwan} L</span>
    <span className="text-slate-300">·</span>
    <span className="text-pink-600 font-semibold">{stats.akhwat} P</span>
    </div>
    </div>

    {/* Students Grid */}
    {filteredStudents.length === 0 ? (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
      <GraduationCap className="w-10 h-10 mx-auto text-slate-300" />
      <p className="text-sm font-semibold text-slate-600">Tidak ada santri yang sesuai filter</p>
      <p className="text-xs text-slate-400">
      Coba ubah kata kunci pencarian atau ganti filter kelas dan gender.
      </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredStudents.map((student) => {
        const enrolledIds = studentEnrollmentsMap.get(student.id) || [];
        const enrolledClasses = enrolledIds.map((cid) => classMap.get(cid)).filter(Boolean);

        return (
          <StudentCard
          key={student.id}
          student={student}
          enrolledClasses={enrolledClasses}
          summary={summaryMap[student.id]}
          subjectName={selectedSubjectName}
          onOpenHistory={setActiveStudentForHistory}
          onSelectSchedule={(classId, studentId) => onSelectStudentSchedule(classId, studentId)}
          />
        );
      })}
      </div>
    )}

    {/* Attendance History Detail Modal */}
    {activeStudentForHistory && (
      <AttendanceHistoryModal
      isOpen={true}
      onClose={() => setActiveStudentForHistory(null)}
      personType="student"
      personId={activeStudentForHistory.id}
      personName={activeStudentForHistory.name}
      personSubtitle={`NISN: ${activeStudentForHistory.nisn || activeStudentForHistory.id}`}
      initialSummary={summaryMap[activeStudentForHistory.id]}
      />
    )}
    </div>
  );
};
