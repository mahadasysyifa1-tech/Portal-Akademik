import React, { useMemo, useState } from 'react';
import {
  Book as BookType,
  ClassEntity,
  DatabaseState,
  Room,
  StudentRecord,
  Subject,
  Teacher
} from '../../types';
import {
  Book,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  ExternalLink,
  GraduationCap,
  Layers,
  School,
  Users
} from 'lucide-react';
import { ClassIcon } from '../ClassIcon';
import { DirectoryShell } from './DirectoryShell';
import { DirectoryPicture } from './DirectoryPicture';
import { PictureUploadModal } from './PictureUploadModal';
import { useCardHighlight } from '../../hooks/useCardHighlight';
import { useAuth } from '../../context/AuthContext';
import { DirectoryMediaItem } from '../../utils/directoryMedia';
import { buildClassRelationsMap } from '../../utils/directoryRelations';

export interface ClassCardProps {
  cls: ClassEntity;
  defaultRoom?: Room;
  subjects: Subject[];
  books: BookType[];
  weeklySessions: number;
  teachers: Teacher[];
  students: StudentRecord[];
  isGuest: boolean;
  isStudentsExpanded: boolean;
  onToggleStudentsExpanded: () => void;
  pictureMedia?: DirectoryMediaItem;
  canEditPicture?: boolean;
  onEditPicture?: (cls: ClassEntity) => void;
  onSelectSubject?: (subjectId: string) => void;
  onSelectBook?: (bookId: string) => void;
  onSelectTeacherSchedule?: (teacherId: string) => void;
  onSelectClassSchedule?: (classId: string, studentId?: string) => void;
}

export const ClassCard: React.FC<ClassCardProps> = ({
  cls,
  defaultRoom,
  subjects,
  books,
  weeklySessions,
  teachers,
  students,
  isGuest,
  isStudentsExpanded,
  onToggleStudentsExpanded,
  pictureMedia,
  canEditPicture = false,
  onEditPicture,
  onSelectSubject,
  onSelectBook,
  onSelectTeacherSchedule,
  onSelectClassSchedule
}) => {
  const displayCode = cls.displayCode ?? cls.display_code;
  const onlineLink = cls.onlineClassLink ?? cls.online_class_link;

  return (
    <div
      id={`class-card-${cls.id}`}
      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
    >
      <div className="space-y-3">
        {/* Card Header: Class Picture/Icon, Name, Code & Grade/Section */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <DirectoryPicture
              src={pictureMedia?.imageUrl}
              alt={cls.name}
              containerClassName="w-11 h-11 rounded-xl"
              canEdit={canEditPicture}
              onEditClick={onEditPicture ? () => onEditPicture(cls) : undefined}
              editLabel={`Ubah gambar kelas ${cls.name}`}
              fallback={
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: cls.color || '#E0E7FF' }}
                >
                  <ClassIcon name={cls.icon || 'GraduationCap'} className="w-4 h-4 text-slate-800" />
                </div>
              }
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 truncate" title={cls.name}>
                  {cls.name}
                </h3>
                {displayCode && (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 tabular-nums">
                    {displayCode}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 tabular-nums flex-wrap">
                <span>Tingkat {cls.grade}</span>
                {cls.section && (
                  <>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span>Seksi {cls.section}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {onlineLink && (
            <a
              href={onlineLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors shrink-0"
              title="Buka tautan kelas online"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Online</span>
            </a>
          )}
        </div>

        {/* Default Room */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <DoorOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {defaultRoom ? (
            <span className="truncate">
              Ruang Default: <strong className="text-slate-800">{defaultRoom.name}</strong>
              {defaultRoom.building && (
                <span className="text-slate-400"> · {defaultRoom.building}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 italic">Ruang default belum diatur</span>
          )}
        </div>

        {/* Subjects Taught */}
        <div className="space-y-1">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">
            <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Mata Pelajaran ({subjects.length}):</span>
          </span>
          {subjects.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {subjects.map((sub) =>
                onSelectSubject ? (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => onSelectSubject(sub.id)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-50 border border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    title={`Buka rincian mapel ${sub.name}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: sub.color || '#F59E0B' }}
                    />
                    <span className="truncate max-w-[130px]">{sub.name}</span>
                  </button>
                ) : (
                  <span
                    key={sub.id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-50 border border-slate-200 text-slate-700"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: sub.color || '#F59E0B' }}
                    />
                    <span className="truncate max-w-[130px]">{sub.name}</span>
                  </span>
                )
              )}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic block">
              Belum ada mata pelajaran terjadwal
            </span>
          )}
        </div>

        {/* Books Used */}
        <div className="space-y-1">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">
            <Book className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Kitab Acuan ({books.length}):</span>
          </span>
          {books.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {books.map((bk) =>
                onSelectBook ? (
                  <button
                    key={bk.id}
                    type="button"
                    onClick={() => onSelectBook(bk.id)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-indigo-50/70 border border-indigo-200/80 text-indigo-800 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    title={`Buka rincian kitab ${bk.title}`}
                  >
                    {(bk.displayCode || bk.id) && (
                      <span className="font-mono text-[9px] font-bold text-indigo-600 tabular-nums">
                        {bk.displayCode || bk.id}
                      </span>
                    )}
                    <span className="truncate max-w-[140px]">{bk.title}</span>
                  </button>
                ) : (
                  <span
                    key={bk.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-50 border border-slate-200 text-slate-700"
                  >
                    <span className="truncate max-w-[140px]">{bk.title}</span>
                  </span>
                )
              )}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic block">
              Belum ada kitab tertaut
            </span>
          )}
        </div>

        {/* Enlisted Teachers (Visible to all roles including guest) */}
        <div className="space-y-1 pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">
            <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Pengajar ({teachers.length}):</span>
          </span>
          {teachers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {teachers.map((tch) =>
                onSelectTeacherSchedule ? (
                  <button
                    key={tch.id}
                    type="button"
                    onClick={() => onSelectTeacherSchedule(tch.id)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    title={`Lihat jadwal mengajar ${tch.name}`}
                  >
                    <span>{tch.panggilan || tch.name}</span>
                  </button>
                ) : (
                  <span
                    key={tch.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700"
                  >
                    {tch.panggilan || tch.name}
                  </span>
                )
              )}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic block">
              Belum ada pengajar ditugaskan
            </span>
          )}
        </div>

        {/* Enlisted Students List Div (Strictly hidden for guests) */}
        {!isGuest && (
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onToggleStudentsExpanded}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors py-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
              aria-expanded={isStudentsExpanded}
            >
              <span className="flex items-center gap-1.5 text-[11px] tabular-nums">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Santri Terdaftar ({students.length})</span>
              </span>
              {students.length > 0 &&
                (isStudentsExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ))}
            </button>

            {isStudentsExpanded && (
              <div className="mt-1.5 space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200/80 max-h-44 overflow-y-auto animate-in fade-in duration-150">
                {students.length > 0 ? (
                  students.map((std) => (
                    <button
                      key={std.id}
                      type="button"
                      onClick={() => onSelectClassSchedule?.(cls.id, std.id)}
                      className="w-full text-left px-2 py-1 rounded-lg bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors flex items-center justify-between gap-2 text-[11px] cursor-pointer"
                      title={`Lihat jadwal kelas ${cls.name} untuk ${std.name}`}
                    >
                      <span className="font-semibold text-slate-800 truncate">{std.name}</span>
                      {(std.displayCode || std.nisn) && (
                        <span className="font-mono text-[10px] text-slate-400 shrink-0 tabular-nums">
                          {std.displayCode || std.nisn}
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-[11px] text-slate-400 italic py-1 text-center">
                    Belum ada santri terdaftar
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: Weekly Session Total & Schedule Deep-Link */}
      <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-medium tabular-nums">
          <strong className="text-slate-800">{weeklySessions}</strong> sesi / pekan
        </span>
        {onSelectClassSchedule && (
          <button
            type="button"
            onClick={() => onSelectClassSchedule(cls.id)}
            className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Lihat Jadwal Kelas →
          </button>
        )}
      </div>
    </div>
  );
};

interface ClassesDirectoryProps {
  db: DatabaseState;
  initialSelectedClassId?: string | null;
  onBackToSchedule: () => void;
  onSelectSubject?: (subjectId: string) => void;
  onSelectBook?: (bookId: string) => void;
  onSelectTeacherSchedule?: (teacherId: string) => void;
  onSelectClassSchedule?: (classId: string, studentId?: string) => void;
  getMedia?: (entityType: 'class', entityId?: string) => DirectoryMediaItem | undefined;
}

export const ClassesDirectory: React.FC<ClassesDirectoryProps> = ({
  db,
  initialSelectedClassId,
  onSelectSubject,
  onSelectBook,
  onSelectTeacherSchedule,
  onSelectClassSchedule,
  getMedia
}) => {
  const auth = useAuth();
  const isGuest = !auth.isAuthenticated || auth.role === 'guest';

  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [expandedClassIds, setExpandedClassIds] = useState<Set<string>>(() => new Set());
  const [pictureTarget, setPictureTarget] = useState<ClassEntity | null>(null);

  useCardHighlight(
    initialSelectedClassId,
    'class-card-',
    ['ring-4', 'ring-indigo-500', 'ring-offset-2']
  );

  const classRelationsMap = useMemo(() => buildClassRelationsMap(db), [db]);

  const grades = useMemo(() => {
    const set = new Set<number>();
    (db.classes || []).forEach((c) => {
      if (typeof c.grade === 'number' && !Number.isNaN(c.grade)) {
        set.add(c.grade);
      }
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [db.classes]);

  const sortedClasses = useMemo(() => {
    return [...(db.classes || [])].sort(
      (a, b) => a.grade - b.grade || a.section.localeCompare(b.section, 'id') || a.name.localeCompare(b.name, 'id')
    );
  }, [db.classes]);

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedClasses.filter((cls) => {
      if (gradeFilter !== 'all' && String(cls.grade) !== gradeFilter) {
        return false;
      }
      if (!q) return true;

      const rel = classRelationsMap.get(cls.id);
      const matchName = cls.name.toLowerCase().includes(q);
      const matchCode = (cls.displayCode || cls.display_code || cls.id).toLowerCase().includes(q);
      const matchSection = (cls.section || '').toLowerCase().includes(q);
      const matchRoom = (rel?.defaultRoom?.name || '').toLowerCase().includes(q);
      const matchSubject = rel?.subjects.some((s) => s.name.toLowerCase().includes(q)) ?? false;
      const matchBook = rel?.books.some((b) => b.title.toLowerCase().includes(q)) ?? false;
      const matchTeacher =
        rel?.teachers.some(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            (t.panggilan && t.panggilan.toLowerCase().includes(q))
        ) ?? false;

      return (
        matchName ||
        matchCode ||
        matchSection ||
        matchRoom ||
        matchSubject ||
        matchBook ||
        matchTeacher
      );
    });
  }, [sortedClasses, gradeFilter, search, classRelationsMap]);

  const toggleStudentsExpanded = (classId: string) => {
    setExpandedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  return (
    <>
      <DirectoryShell
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari nama kelas, kode, ruang, mapel, kitab, atau pengajar..."
      focusRingClass="focus-visible:ring-indigo-500"
      filterSlot={
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 shrink-0">Tingkat:</span>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
          >
            <option value="all">Semua Tingkat ({db.classes?.length || 0})</option>
            {grades.map((g) => (
              <option key={g} value={String(g)}>
                Tingkat {g}
              </option>
            ))}
          </select>
        </div>
      }
      summarySlot={
        <>
          Menampilkan <strong className="text-slate-800">{filteredClasses.length}</strong> dari{' '}
          {db.classes?.length || 0} kelas
        </>
      }
      isEmpty={filteredClasses.length === 0}
      emptyState={{
        icon: <School className="w-10 h-10 mx-auto text-slate-300" />,
        title: 'Tidak ada kelas yang cocok',
        description: 'Coba ubah kata kunci pencarian atau filter tingkat kelas.'
      }}
    >
      {filteredClasses.map((cls) => {
        const rel = classRelationsMap.get(cls.id) || {
          subjects: [],
          books: [],
          weeklySessions: 0,
          teachers: [],
          students: []
        };

        return (
          <ClassCard
            key={cls.id}
            cls={cls}
            defaultRoom={rel.defaultRoom}
            subjects={rel.subjects}
            books={rel.books}
            weeklySessions={rel.weeklySessions}
            teachers={rel.teachers}
            students={rel.students}
            isGuest={isGuest}
            isStudentsExpanded={expandedClassIds.has(cls.id)}
            onToggleStudentsExpanded={() => toggleStudentsExpanded(cls.id)}
            pictureMedia={getMedia?.('class', cls.id)}
            canEditPicture={auth.isAdmin}
            onEditPicture={setPictureTarget}
            onSelectSubject={isGuest ? undefined : onSelectSubject}
            onSelectBook={onSelectBook}
            onSelectTeacherSchedule={onSelectTeacherSchedule}
            onSelectClassSchedule={onSelectClassSchedule}
          />
        );
      })}
    </DirectoryShell>

      {pictureTarget && (
        <PictureUploadModal
          isOpen={true}
          onClose={() => setPictureTarget(null)}
          entityType="class"
          entityId={pictureTarget.id}
          entityName={pictureTarget.name}
          currentMedia={getMedia?.('class', pictureTarget.id)}
          aspectHint="square"
        />
      )}
    </>
  );
};
