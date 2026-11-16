import React, { useState, useMemo } from 'react';
import { DatabaseState, StudentRecord, AttendanceSummaryItem, ClassEntity } from '../../types';
import { GraduationCap, Phone, Hash, Layers, Mail } from 'lucide-react';
import { ClassIcon } from '../ClassIcon';
import { AttendanceHistoryModal } from './AttendanceHistoryModal';
import { AttendanceSummaryBar } from './AttendanceSummaryBar';
import { DirectoryShell } from './DirectoryShell';
import { DisplayCodeBadge } from './DisplayCodeBadge';
import { DirectoryPicture } from './DirectoryPicture';
import { PictureUploadModal } from './PictureUploadModal';
import { useAuth } from '../../context/AuthContext';
import { useAttendanceSummary } from '../../hooks/useAttendanceSummary';
import { DirectoryMediaItem } from '../../utils/directoryMedia';
import { buildStudentEnrollmentsMap } from '../../utils/directoryRelations';

export interface StudentCardProps {
  student: StudentRecord;
  enrolledClasses?: ClassEntity[];
  summary?: AttendanceSummaryItem;
  pictureMedia?: DirectoryMediaItem;
  canEditPicture?: boolean;
  onEditPicture?: (student: StudentRecord) => void;
  canEditDisplayCode?: boolean;
  onEditDisplayCode?: (studentId: string, nextDisplayCode: string) => void;
  onOpenHistory?: (student: StudentRecord) => void;
  onSelectSchedule?: (classId: string, studentId: string) => void;
  onSelectClass?: (classId: string) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  enrolledClasses = [],
  summary,
  pictureMedia,
  canEditPicture = false,
  onEditPicture,
  canEditDisplayCode = false,
  onEditDisplayCode,
  onOpenHistory,
  onSelectSchedule,
  onSelectClass
}) => {
  const primaryClass = enrolledClasses[0];
  const initials =
    student.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'S';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
      <div>
        {/* Header: Portrait, Name & Gender Label */}
        <div className="flex items-start gap-3 mb-2.5">
          <DirectoryPicture
            src={pictureMedia?.imageUrl}
            alt={student.name}
            containerClassName="w-12 h-12 rounded-2xl"
            canEdit={canEditPicture}
            onEditClick={onEditPicture ? () => onEditPicture(student) : undefined}
            editLabel={`Ubah foto ${student.name}`}
            fallback={
              <div
                className={`w-full h-full flex items-center justify-center font-bold text-xs text-white select-none ${
                  student.gender === 'P' ? 'bg-pink-600' : 'bg-indigo-600'
                }`}
              >
                {initials}
              </div>
            }
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {student.name}
              </h3>
              {student.gender && (
                <span
                  className={`text-[11px] font-semibold ${
                    student.gender === 'P' ? 'text-pink-700' : 'text-blue-700'
                  }`}
                >
                  · {student.gender === 'P' ? 'Akhwat (P)' : 'Ikhwan (L)'}
                </span>
              )}
              <DisplayCodeBadge
                value={student.displayCode ?? student.display_code ?? ''}
                canEdit={canEditDisplayCode}
                onStageChange={(next) => onEditDisplayCode?.(student.id, next)}
              />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
              <span className="flex items-center gap-1 font-mono tabular-nums">
                <Hash className="w-3 h-3 text-slate-400" />
                NISN: {student.nisn || student.id}
              </span>
            </div>
          </div>
        </div>

        {/* Contact info if any */}
        {student.email && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{student.email}</span>
          </div>
        )}
        {student.phone && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2.5 font-mono tabular-nums">
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{student.phone}</span>
          </div>
        )}

        {/* Enrolled Classes */}
        <div className="space-y-1 mt-2">
          <span className="text-[11px] font-semibold text-slate-500 block">
            Kelas Terdaftar:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {enrolledClasses.length > 0 ? (
              enrolledClasses.map((cls) =>
                cls ? (
                  onSelectClass || onSelectSchedule ? (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() =>
                        onSelectClass
                          ? onSelectClass(cls.id)
                          : onSelectSchedule?.(cls.id, student.id)
                      }
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border shadow-2xs transition-all cursor-pointer hover:brightness-95 hover:ring-1 hover:ring-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      style={{
                        backgroundColor: cls.color || '#E0E7FF',
                        borderColor: 'rgba(0, 0, 0, 0.14)'
                      }}
                      title={
                        onSelectClass
                          ? `Buka rincian kelas ${cls.name}`
                          : `Lihat jadwal kelas ${cls.name}`
                      }
                    >
                      <ClassIcon name={cls.icon || 'GraduationCap'} className="w-3 h-3 text-slate-700" />
                      <span className="text-slate-800">{cls.name}</span>
                    </button>
                  ) : (
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
                  )
                ) : null
              )
            ) : (
              <span className="text-[11px] text-slate-400 italic">
                Belum terdaftar di rombel manapun
              </span>
            )}
          </div>
        </div>

        <AttendanceSummaryBar
          label="Kehadiran:"
          summary={summary}
          onOpenHistory={onOpenHistory ? () => onOpenHistory(student) : undefined}
          title={onOpenHistory ? 'Klik untuk melihat riwayat kehadiran sesi' : undefined}
        />
      </div>

      {/* Footer Action */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 tabular-nums">
          {enrolledClasses.length} rombel
        </span>
        {onSelectSchedule && primaryClass ? (
          <button
            type="button"
            onClick={() => onSelectSchedule(primaryClass.id, student.id)}
            className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
  onSelectClass?: (classId: string) => void;
  onEditStudentDisplayCode?: (studentId: string, nextDisplayCode: string) => void;
  getMedia?: (entityType: 'student', entityId?: string) => DirectoryMediaItem | undefined;
}

export const StudentsDirectory: React.FC<StudentsDirectoryProps> = ({
  db,
  onSelectStudentSchedule,
  onSelectClass,
  onEditStudentDisplayCode,
  getMedia
}) => {
  const auth = useAuth();
  const [search, setSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'L' | 'P'>('all');
  const summaryMap = useAttendanceSummary('student');
  const [activeStudentForHistory, setActiveStudentForHistory] = useState<StudentRecord | null>(null);
  const [pictureTarget, setPictureTarget] = useState<StudentRecord | null>(null);

  const studentEnrollmentsMap = useMemo(() => buildStudentEnrollmentsMap(db), [db]);

  const studentsList: StudentRecord[] = useMemo(() => db.students || [], [db.students]);

  const filteredStudents = useMemo(() => {
    return studentsList.filter((s) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.displayCode && s.displayCode.toLowerCase().includes(q)) ||
        (s.nisn && s.nisn.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (genderFilter !== 'all' && s.gender !== genderFilter) {
        return false;
      }

      if (selectedClassFilter !== 'all') {
        const enrolled = studentEnrollmentsMap.get(s.id) || [];
        if (!enrolled.some((c) => c.id === selectedClassFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [studentsList, search, genderFilter, selectedClassFilter, studentEnrollmentsMap]);

  const stats = useMemo(() => {
    const total = studentsList.length;
    const ikhwan = studentsList.filter((s) => s.gender === 'L').length;
    const akhwat = studentsList.filter((s) => s.gender === 'P').length;
    return { total, ikhwan, akhwat };
  }, [studentsList]);

  return (
    <>
      <DirectoryShell
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari santri, NISN, atau kontak..."
        focusRingClass="focus-visible:ring-indigo-500"
        filterSlot={
          <>
            {/* Filter Kelas */}
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Semua Kelas ({db.classes?.length || 0})</option>
                {(db.classes || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender Filter Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setGenderFilter('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  genderFilter === 'P'
                    ? 'bg-pink-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-pink-700'
                }`}
              >
                Akhwat
              </button>
            </div>
          </>
        }
        summarySlot={
          <div className="flex items-center gap-2">
            <span>
              Total: <strong className="text-slate-800">{filteredStudents.length}</strong> Santri
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-blue-600 font-semibold">{stats.ikhwan} L</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-pink-600 font-semibold">{stats.akhwat} P</span>
          </div>
        }
        isEmpty={filteredStudents.length === 0}
        emptyState={{
          icon: <GraduationCap className="w-10 h-10 mx-auto text-slate-300" />,
          title: 'Tidak ada santri yang sesuai filter',
          description: 'Coba ubah kata kunci pencarian atau ganti filter kelas dan gender.'
        }}
      >
        {filteredStudents.map((student) => {
          const enrolledClasses = studentEnrollmentsMap.get(student.id) || [];

          return (
            <StudentCard
              key={student.id}
              student={student}
              enrolledClasses={enrolledClasses}
              summary={summaryMap[student.id]}
              pictureMedia={getMedia?.('student', student.id)}
              canEditPicture={Boolean(auth.isAdmin || (auth.isStudent && auth.studentId === student.id))}
              onEditPicture={setPictureTarget}
              canEditDisplayCode={Boolean(
                onEditStudentDisplayCode && (auth.isAdmin || (auth.isStudent && auth.studentId === student.id))
              )}
              onEditDisplayCode={onEditStudentDisplayCode}
              onOpenHistory={setActiveStudentForHistory}
              onSelectSchedule={(classId, studentId) => onSelectStudentSchedule(classId, studentId)}
              onSelectClass={onSelectClass}
            />
          );
        })}
      </DirectoryShell>

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

      {pictureTarget && (
        <PictureUploadModal
          isOpen={true}
          onClose={() => setPictureTarget(null)}
          entityType="student"
          entityId={pictureTarget.id}
          entityName={pictureTarget.name}
          currentMedia={getMedia?.('student', pictureTarget.id)}
          aspectHint="square"
        />
      )}
    </>
  );
};
