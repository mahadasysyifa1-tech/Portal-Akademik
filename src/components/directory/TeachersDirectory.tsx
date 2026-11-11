import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseState, Teacher, AttendanceSummaryItem } from '../../types';
import { Users, Search, Mail, BookOpen, Clock, ArrowLeft } from 'lucide-react';
import { AttendanceHistoryModal } from './AttendanceHistoryModal';

export interface TeacherCardProps {
  teacher: Teacher;
  stats?: { sessions: number; subjects: Set<string> };
  taughtSubjects?: Array<any>;
  summary?: AttendanceSummaryItem;
  onOpenHistory?: (teacher: Teacher) => void;
  onSelectSchedule?: (teacherId: string) => void;
}

export const TeacherCard: React.FC<TeacherCardProps> = ({
  teacher,
  stats = { sessions: 0, subjects: new Set() },
  taughtSubjects = [],
  summary,
  onOpenHistory,
  onSelectSchedule
}) => {
  const hasData = summary && summary.total > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">
                {teacher.name}
              </h3>
              {teacher.panggilan && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  {teacher.panggilan}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500">
              {teacher.department || 'Pengajar'}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
            {stats.sessions} sesi / pekan
          </span>
        </div>

        {teacher.email && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{teacher.email}</span>
          </div>
        )}

        {/* Subjects Taught */}
        <div className="space-y-1 mt-2">
          <span className="text-[11px] font-semibold text-slate-500 block">
            Mata Pelajaran yang Diampu:
          </span>
          <div className="flex flex-wrap gap-1">
            {taughtSubjects.length > 0 ? (
              taughtSubjects.map((s) => s && (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.name}</span>
                </span>
              ))
            ) : (
              <span className="text-[11px] text-slate-400 italic">
                Belum ada jadwal aktif
              </span>
            )}
          </div>
        </div>

        {/* Presence Summary Progress Bar */}
        <div
          onClick={() => onOpenHistory?.(teacher)}
          className={`mt-3 pt-2.5 border-t border-slate-100 group -mx-1 px-1.5 py-1.5 rounded-xl transition-colors ${onOpenHistory ? 'cursor-pointer hover:bg-slate-50/80' : ''}`}
          title={onOpenHistory ? 'Klik untuk melihat riwayat kehadiran mengajar' : undefined}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`text-[11px] font-semibold text-slate-600 ${onOpenHistory ? 'group-hover:text-indigo-600' : ''} transition-colors`}>
              Kehadiran Mengajar:
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

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          Beban maks: {teacher.maxPeriodsPerWeek} sesi
        </span>
        {onSelectSchedule && (
          <button
            type="button"
            onClick={() => onSelectSchedule(teacher.id)}
            className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
          >
            Lihat Jadwal Guru →
          </button>
        )}
      </div>
    </div>
  );
};

interface TeachersDirectoryProps {
  db: DatabaseState;
  onBackToSchedule: () => void;
  onSelectTeacherSchedule: (teacherId: string) => void;
}

export const TeachersDirectory: React.FC<TeachersDirectoryProps> = ({
  db,
  onBackToSchedule,
  onSelectTeacherSchedule
}) => {
  const [search, setSearch] = useState('');
  const [summaryMap, setSummaryMap] = useState<Record<string, AttendanceSummaryItem>>({});
  const [activeTeacherForHistory, setActiveTeacherForHistory] = useState<Teacher | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/attendance/summary?type=teacher')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data && typeof data === 'object') {
          setSummaryMap(data);
        }
      })
      .catch((err) => console.error('Failed to load teacher attendance summary:', err));
    return () => {
      isMounted = false;
    };
  }, []);
  const subjectMap = useMemo(() => new Map(db.subjects.map((s) => [s.id, s])), [db.subjects]);

  const filteredTeachers = useMemo(() => {
    return db.teachers.filter((t) => {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.panggilan && t.panggilan.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        (t.department && t.department.toLowerCase().includes(q))
      );
    });
  }, [db.teachers, search]);

  // Compute teaching load per teacher
  const teacherStats = useMemo(() => {
    const stats: Record<string, { sessions: number; subjects: Set<string> }> = {};
    db.teachers.forEach((t) => {
      stats[t.id] = { sessions: 0, subjects: new Set() };
    });

    db.rules.forEach((r) => {
      if (r.active && stats[r.teacherId]) {
        const daysCount = r.daysOfWeek?.length || 1;
        stats[r.teacherId].sessions += daysCount;
        stats[r.teacherId].subjects.add(r.subjectId);
      }
    });

    return stats;
  }, [db.teachers, db.rules]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari asatidz / pengampu..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
          />
        </div>
      </div>

      {/* Teachers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeachers.map((teacher) => {
          const stats = teacherStats[teacher.id] || { sessions: 0, subjects: new Set() };
          const taughtSubjects = Array.from(stats.subjects).map((sid) => subjectMap.get(sid)).filter(Boolean);

          return (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              stats={stats}
              taughtSubjects={taughtSubjects}
              summary={summaryMap[teacher.id]}
              onOpenHistory={setActiveTeacherForHistory}
              onSelectSchedule={onSelectTeacherSchedule}
            />
          );
        })}
      </div>

      {/* Teacher Attendance History Modal */}
      {activeTeacherForHistory && (
        <AttendanceHistoryModal
          isOpen={true}
          onClose={() => setActiveTeacherForHistory(null)}
          personType="teacher"
          personId={activeTeacherForHistory.id}
          personName={activeTeacherForHistory.name}
          personSubtitle={activeTeacherForHistory.department || 'Pengajar'}
          initialSummary={summaryMap[activeTeacherForHistory.id]}
        />
      )}
    </div>
  );
};
