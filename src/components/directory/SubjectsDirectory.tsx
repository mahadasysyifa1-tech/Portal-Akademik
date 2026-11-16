import React, { useState, useMemo } from 'react';
import { DatabaseState, Subject, Book as BookType } from '../../types';
import {
  User,
  DoorOpen,
  Layers,
  Book,
  FileText,
  ShoppingCart,
  ExternalLink,
  SlidersHorizontal,
  BookmarkCheck
} from 'lucide-react';
import { getUnitsForSubject } from '../../utils/pacingEngine';
import {
  bookMatchesRef,
  buildSubjectBookRelations,
  getSubjectPrimaryBookRef
} from '../../utils/directoryRelations';
import { useCardHighlight } from '../../hooks/useCardHighlight';
import { DirectoryShell } from './DirectoryShell';

interface SubjectsDirectoryProps {
  db: DatabaseState;
  initialSelectedSubjectId?: string | null;
  onBackToSchedule: () => void;
  onSelectSubject: (subjectId: string) => void;
  onNavigateToSyllabusScope?: (subjectId?: string, classId?: string) => void;
  onSelectBook?: (bookId: string) => void;
}

export const SubjectsDirectory: React.FC<SubjectsDirectoryProps> = ({
  db,
  initialSelectedSubjectId,
  onSelectSubject,
  onNavigateToSyllabusScope,
  onSelectBook
}) => {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  const teacherMap = useMemo(() => new Map((db.teachers || []).map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map((db.rooms || []).map((r) => [r.id, r])), [db.rooms]);

  // Extract distinct departments for filtering
  const departments = useMemo(() => {
    const set = new Set<string>();
    (db.subjects || []).forEach((s) => {
      if (s.department && s.department.trim()) {
        set.add(s.department.trim());
      }
    });
    return Array.from(set).sort();
  }, [db.subjects]);

  useCardHighlight(
    initialSelectedSubjectId,
    'subject-card-',
    ['ring-4', 'ring-amber-500', 'ring-offset-2']
  );

  // Unified Many-to-Many Subject -> Books mapping
  const { booksBySubjectMap } = useMemo(() => buildSubjectBookRelations(db), [db]);

  // Filter subjects by search and department
  const filteredSubjects = useMemo(() => {
    return (db.subjects || []).filter((s) => {
      if (selectedDept !== 'all' && s.department !== selectedDept) {
        return false;
      }

      const q = search.trim().toLowerCase();
      if (!q) return true;

      const linkedBooks = booksBySubjectMap.get(s.id) || [];
      const matchBook = linkedBooks.some(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.altTitle && b.altTitle.toLowerCase().includes(q)) ||
          (b.displayCode && b.displayCode.toLowerCase().includes(q)) ||
          (b.author && b.author.toLowerCase().includes(q))
      );

      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.displayCode && s.displayCode.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q)) ||
        matchBook
      );
    });
  }, [db.subjects, search, selectedDept, booksBySubjectMap]);

  // Compute how many rules/sessions are scheduled for each subject
  const subjectSessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (db.rules || []).forEach((r) => {
      if (r.active) {
        counts[r.subjectId] = (counts[r.subjectId] || 0) + (r.daysOfWeek?.length || 1);
      }
    });
    return counts;
  }, [db.rules]);

  return (
    <DirectoryShell
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari nama mapel, kode, kategori, atau judul kitab..."
      focusRingClass="focus-visible:ring-amber-500"
      filterSlot={
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 shrink-0">Kategori:</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <option value="all">Semua Kategori</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      }
      summarySlot={
        <>
          Menampilkan <strong className="text-slate-800">{filteredSubjects.length}</strong> dari{' '}
          {db.subjects?.length || 0} mata pelajaran
        </>
      }
      isEmpty={filteredSubjects.length === 0}
      emptyState={{
        icon: <Book className="w-10 h-10 mx-auto text-slate-300" />,
        title: 'Tidak ada mata pelajaran yang cocok',
        description: 'Coba ubah kata kunci pencarian atau pilih kategori lain.'
      }}
    >
      {filteredSubjects.map((subject: Subject) => {
        const defaultTeacher = subject.defaultTeacherId ? teacherMap.get(subject.defaultTeacherId) : null;
        const defaultRoom = subject.defaultRoomId ? roomMap.get(subject.defaultRoomId) : null;
        const linkedBooks: BookType[] = booksBySubjectMap.get(subject.id) || [];
        const primaryBookRef = getSubjectPrimaryBookRef(subject);
        const totalSessions = subjectSessionCounts[subject.id] || 0;
        const syllabusUnits = getUnitsForSubject(db, subject.id);

        return (
          <div
            key={subject.id}
            id={`subject-card-${subject.id}`}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
          >
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-4 h-4 rounded-md shrink-0 shadow-2xs border border-black/10"
                    style={{ backgroundColor: subject.color }}
                  />
                  <span className="text-base font-bold text-slate-900 truncate" title={subject.name}>
                    {subject.name}
                  </span>
                </div>
                {subject.department && (
                  <span className="text-[11px] font-medium text-indigo-700 shrink-0">
                    {subject.department}
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                {/* Teacher */}
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    Pengampu: <strong>{defaultTeacher ? (defaultTeacher.panggilan || defaultTeacher.name) : 'Disesuaikan per jadwal'}</strong>
                  </span>
                </div>

                {/* Multi-Book Linked List */}
                {linkedBooks.length > 0 ? (
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between text-xs text-slate-700 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Book className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="tabular-nums">Kitab Rujukan ({linkedBooks.length}):</span>
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                      {linkedBooks.map((b) => {
                        const isPrimary = bookMatchesRef(b, primaryBookRef);
                        return (
                          <div
                            key={b.id}
                            className={`rounded-xl p-2 border flex items-center justify-between gap-2 text-xs transition-colors ${
                              isPrimary
                                ? 'bg-amber-50/80 border-amber-300/80 hover:bg-amber-100/70'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectBook?.(b.id)}
                              className="min-w-0 flex items-center gap-1.5 truncate text-left cursor-pointer group flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                              title={`Buka rincian kitab ${b.title} di Daftar Buku`}
                            >
                              <span
                                className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 shadow-2xs tabular-nums ${
                                  isPrimary
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-white text-slate-700 border border-slate-200'
                                }`}
                              >
                                {b.displayCode || b.id}
                              </span>

                              <div className="min-w-0 truncate">
                                <div className="font-semibold text-slate-900 group-hover:text-amber-900 group-hover:underline truncate text-xs">
                                  {b.title}
                                </div>
                                {b.altTitle && (
                                  <div className="text-[11px] text-slate-500 font-arabic truncate" dir="auto">
                                    {b.altTitle}
                                  </div>
                                )}
                              </div>
                            </button>

                            {/* Role label: Pokok vs Rujukan */}
                            <div className="flex items-center gap-1 shrink-0">
                              {isPrimary ? (
                                <span className="text-[10px] font-bold text-amber-800">
                                  Pokok
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-500">
                                  Rujukan
                                </span>
                              )}

                              {/* Quick Resource links for this book */}
                              {b.links && b.links.length > 0 && (
                                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                  {b.links.map((link, lIdx) => (
                                    <a
                                      key={link.id || lIdx}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded bg-white text-indigo-700 border border-slate-200 hover:bg-indigo-50 flex items-center shadow-2xs"
                                      title={link.label || 'Tautan Buku'}
                                    >
                                      {link.type === 'pdf' ? (
                                        <FileText className="w-3 h-3 text-rose-600" />
                                      ) : link.type.includes('shop') ? (
                                        <ShoppingCart className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <ExternalLink className="w-3 h-3 text-indigo-600" />
                                      )}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400 italic py-1">
                    <Book className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Belum ada buku rujukan yang ditautkan</span>
                  </div>
                )}

                {/* Room */}
                {defaultRoom && (
                  <div className="flex items-center gap-1.5">
                    <DoorOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Ruang Default: <strong>{defaultRoom.name}</strong></span>
                  </div>
                )}

                {/* Action: Silabus Materi Deeplink & Manage Scope */}
                <div className="pt-2 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectSubject(subject.id)}
                    className="flex justify-between items-center w-full px-3 py-2 rounded-xl bg-amber-50/80 border border-amber-200/90 hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    title="Buka silabus materi pembelajaran untuk mapel ini"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <BookmarkCheck className="w-3.5 h-3.5 text-amber-700" />
                      <span>Silabus Materi</span>
                    </span>
                    <span className="text-[11px] font-semibold text-amber-800 tabular-nums">
                      {syllabusUnits.length} materi
                    </span>
                  </button>

                  {onNavigateToSyllabusScope && (
                    <button
                      type="button"
                      onClick={() => onNavigateToSyllabusScope(subject.id)}
                      className="flex items-center justify-center gap-1.5 w-full py-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer transition-colors"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>Atur Kitab &amp; Distribusi Silabus</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer: Sesi Jadwal */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Jadwal Aktif:</span>
              </span>
              <span className="font-bold text-slate-800 tabular-nums">
                {totalSessions} sesi / pekan
              </span>
            </div>
          </div>
        );
      })}
    </DirectoryShell>
  );
};
