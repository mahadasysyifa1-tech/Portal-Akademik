import React, { useState, useMemo } from 'react';
import { DatabaseState, Teacher, AttendanceSummaryItem, Subject } from '../../types';
import { Users, Mail } from 'lucide-react';
import { AttendanceHistoryModal } from './AttendanceHistoryModal';
import { AttendanceSummaryBar } from './AttendanceSummaryBar';
import { DirectoryShell } from './DirectoryShell';
import { DisplayCodeBadge } from './DisplayCodeBadge';
import { DirectoryPicture } from './DirectoryPicture';
import { PictureUploadModal } from './PictureUploadModal';
import { useAuth } from '../../context/AuthContext';
import { useAttendanceSummary } from '../../hooks/useAttendanceSummary';
import { DirectoryMediaItem } from '../../utils/directoryMedia';
import {
  buildTeacherStatsMap,
  getTeacherTaughtSubjects
} from '../../utils/directoryRelations';

export interface TeacherCardProps {
  teacher: Teacher;
  stats?: { sessions: number; subjects: Set<string> };
  taughtSubjects?: Array<Subject | undefined>;
  summary?: AttendanceSummaryItem;
  pictureMedia?: DirectoryMediaItem;
  canEditPicture?: boolean;
  onEditPicture?: (teacher: Teacher) => void;
  canEditDisplayCode?: boolean;
  onEditDisplayCode?: (teacherId: string, nextDisplayCode: string) => void;
  onOpenHistory?: (teacher: Teacher) => void;
  onSelectSchedule?: (teacherId: string) => void;
  onSelectSubject?: (subjectId: string) => void;
}

export const TeacherCard: React.FC<TeacherCardProps> = ({
  teacher,
  stats = { sessions: 0, subjects: new Set() },
  taughtSubjects = [],
  summary,
  pictureMedia,
  canEditPicture = false,
  onEditPicture,
  canEditDisplayCode = false,
  onEditDisplayCode,
  onOpenHistory,
  onSelectSchedule,
  onSelectSubject
}) => {
  const initials =
    teacher.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'U';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-start gap-3 min-w-0">
            <DirectoryPicture
              src={pictureMedia?.imageUrl}
              alt={teacher.name}
              containerClassName="w-12 h-12 rounded-2xl"
              canEdit={canEditPicture}
              onEditClick={onEditPicture ? () => onEditPicture(teacher) : undefined}
              editLabel={`Ubah foto ${teacher.name}`}
              fallback={
                <div
                  className="w-full h-full flex items-center justify-center font-bold text-xs text-white select-none"
                  style={{ backgroundColor: teacher.color || '#4F46E5' }}
                >
                  {initials}
                </div>
              }
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">
                  {teacher.name}
                </h3>
                {teacher.panggilan && (
                  <span className="text-[11px] font-semibold text-amber-700">
                    · {teacher.panggilan}
                  </span>
                )}
                <DisplayCodeBadge
                  value={teacher.displayCode ?? teacher.display_code ?? ''}
                  canEdit={canEditDisplayCode}
                  onStageChange={(next) => onEditDisplayCode?.(teacher.id, next)}
                />
              </div>
              <span className="text-[11px] text-slate-500">
                {teacher.department || 'Pengajar'}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-bold text-indigo-700 shrink-0 tabular-nums">
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
          <div className="flex flex-wrap gap-1.5">
            {taughtSubjects.length > 0 ? (
              taughtSubjects.map((s) =>
                s ? (
                  onSelectSubject ? (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectSubject(s.id)}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 border border-slate-200/80 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      title={`Lihat rincian mapel ${s.name}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span>{s.name}</span>
                    </button>
                  ) : (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span>{s.name}</span>
                    </span>
                  )
                ) : null
              )
            ) : (
              <span className="text-[11px] text-slate-400 italic">
                Belum ada jadwal aktif
              </span>
            )}
          </div>
        </div>

        <AttendanceSummaryBar
          label="Kehadiran Mengajar:"
          summary={summary}
          onOpenHistory={onOpenHistory ? () => onOpenHistory(teacher) : undefined}
          title={onOpenHistory ? 'Klik untuk melihat riwayat kehadiran mengajar' : undefined}
        />
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 tabular-nums">
          Beban maks: {teacher.maxPeriodsPerWeek} sesi
        </span>
        {onSelectSchedule && (
          <button
            type="button"
            onClick={() => onSelectSchedule(teacher.id)}
            className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
  onSelectSubject?: (subjectId: string) => void;
  onEditTeacherDisplayCode?: (teacherId: string, nextDisplayCode: string) => void;
  getMedia?: (entityType: 'teacher', entityId?: string) => DirectoryMediaItem | undefined;
}

export const TeachersDirectory: React.FC<TeachersDirectoryProps> = ({
  db,
  onSelectTeacherSchedule,
  onSelectSubject,
  onEditTeacherDisplayCode,
  getMedia
}) => {
  const auth = useAuth();
  const [search, setSearch] = useState('');
  const summaryMap = useAttendanceSummary('teacher');
  const [activeTeacherForHistory, setActiveTeacherForHistory] = useState<Teacher | null>(null);
  const [pictureTarget, setPictureTarget] = useState<Teacher | null>(null);

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return db.teachers;
    return db.teachers.filter((t) => {
      return (
        t.name.toLowerCase().includes(q) ||
        (t.panggilan && t.panggilan.toLowerCase().includes(q)) ||
        (t.displayCode && t.displayCode.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        (t.department && t.department.toLowerCase().includes(q))
      );
    });
  }, [db.teachers, search]);

  const teacherStats = useMemo(() => buildTeacherStatsMap(db), [db]);

  return (
    <>
      <DirectoryShell
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari asatidz / pengampu..."
        focusRingClass="focus-visible:ring-indigo-500"
        summarySlot={
          <>
            Menampilkan <strong className="text-slate-800">{filteredTeachers.length}</strong> dari{' '}
            {db.teachers?.length || 0} pengajar
          </>
        }
        isEmpty={filteredTeachers.length === 0}
        emptyState={{
          icon: <Users className="w-10 h-10 mx-auto text-slate-300" />,
          title: 'Tidak ada pengajar yang cocok',
          description: 'Coba ubah kata kunci pencarian Anda.'
        }}
      >
        {filteredTeachers.map((teacher) => {
          const stats = teacherStats[teacher.id] || { sessions: 0, subjects: new Set<string>() };
          const taughtSubjects = getTeacherTaughtSubjects(db, teacher.id, teacherStats);

          return (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              stats={stats}
              taughtSubjects={taughtSubjects}
              summary={summaryMap[teacher.id]}
              pictureMedia={getMedia?.('teacher', teacher.id)}
              canEditPicture={Boolean(auth.isAdmin || (auth.isTeacher && auth.teacherId === teacher.id))}
              onEditPicture={setPictureTarget}
              canEditDisplayCode={Boolean(
                onEditTeacherDisplayCode && (auth.isAdmin || (auth.isTeacher && auth.teacherId === teacher.id))
              )}
              onEditDisplayCode={onEditTeacherDisplayCode}
              onOpenHistory={setActiveTeacherForHistory}
              onSelectSchedule={onSelectTeacherSchedule}
              onSelectSubject={onSelectSubject}
            />
          );
        })}
      </DirectoryShell>

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

      {pictureTarget && (
        <PictureUploadModal
          isOpen={true}
          onClose={() => setPictureTarget(null)}
          entityType="teacher"
          entityId={pictureTarget.id}
          entityName={pictureTarget.name}
          currentMedia={getMedia?.('teacher', pictureTarget.id)}
          aspectHint="square"
        />
      )}
    </>
  );
};
