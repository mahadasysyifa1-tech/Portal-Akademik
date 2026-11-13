import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseState, Subject, Book as BookType } from '../../types';
import {
  Search,
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
  const bookMap = useMemo(() => new Map<string, BookType>((db.books || []).map((b) => [b.id, b])), [db.books]);

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

  // Smooth scroll and highlight selected subject card
  useEffect(() => {
    if (initialSelectedSubjectId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`subject-card-${initialSelectedSubjectId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-4', 'ring-amber-500', 'ring-offset-2');
          setTimeout(() => {
            el.classList.remove('ring-4', 'ring-amber-500', 'ring-offset-2');
          }, 2500);
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [initialSelectedSubjectId]);

  // Comprehensive Multi-Book Gathering for each subject
  const booksBySubjectMap = useMemo(() => {
    const map = new Map<string, BookType[]>();
    const allBooks = db.books || [];
    const allSubjects = db.subjects || [];
    const allUnits = db.syllabusUnits || [];
    const allScopes = db.syllabusScopes || [];

    for (const subject of allSubjects) {
      const linkedBookIds = new Set<string>();

      // 1. Primary default book on subject
      const def = subject.default_book || subject.defaultBookId || subject.primary_book_code;
      if (def) {
        linkedBookIds.add(def);
      }

      // 2. Books pointing to this subject via defaultSubjectId
      for (const b of allBooks) {
        if (b.defaultSubjectId === subject.id || (b.defaultSubjectId && b.defaultSubjectId === subject.code)) {
          linkedBookIds.add(b.id);
        }
      }

      // 3. Syllabus units referencing this subject and a book
      for (const u of allUnits) {
        const subjMatch = u.subject_id === subject.id || u.subject_id === subject.code;
        if (subjMatch && (u.bookId || u.bookCode)) {
          linkedBookIds.add(u.bookId || u.bookCode || '');
        }
      }

      // 4. Syllabus scopes (multi-book distributions)
      for (const scope of allScopes) {
        if (scope.subject_id === subject.id || scope.subject_id === subject.code) {
          scope.items?.forEach((it) => {
            if (it.bookId) linkedBookIds.add(it.bookId);
          });
          scope.book_ids?.forEach((bId) => {
            if (bId) linkedBookIds.add(bId);
          });
          if (scope.book_id) linkedBookIds.add(scope.book_id);
        }
      }

      // Resolve book objects with flexible matching
      const resolvedBooks: BookType[] = [];
      for (const bId of linkedBookIds) {
        if (!bId) continue;
        const b =
          bookMap.get(bId) ||
          allBooks.find((book) => book.id === bId || book.displayCode === bId || book.code === bId);
        if (b && !resolvedBooks.some((existing) => existing.id === b.id)) {
          resolvedBooks.push(b);
        }
      }

      // Sort so primary default book appears first
      resolvedBooks.sort((a, b) => {
        const isADefault = a.id === def;
        const isBDefault = b.id === def;
        if (isADefault && !isBDefault) return -1;
        if (!isADefault && isBDefault) return 1;
        return a.title.localeCompare(b.title);
      });

      map.set(subject.id, resolvedBooks);
    }

    return map;
  }, [db.subjects, db.books, db.syllabusUnits, db.syllabusScopes, bookMap]);

  // Filter subjects by search and department
  const filteredSubjects = useMemo(() => {
    return (db.subjects || []).filter((s) => {
      // 1. Department filter
      if (selectedDept !== 'all' && s.department !== selectedDept) {
        return false;
      }

      // 2. Search query filter
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
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Search & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama mapel, kode, kategori, atau judul kitab..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Department Filter Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 shrink-0">Kategori:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">Semua Kategori</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Counter Summary */}
        <div className="text-xs text-slate-500 font-medium shrink-0">
          Menampilkan <strong className="text-slate-800">{filteredSubjects.length}</strong> dari{' '}
          {db.subjects?.length || 0} mata pelajaran
        </div>
      </div>

      {/* Cards Grid */}
      {filteredSubjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs shadow-2xs">
          Tidak ada mata pelajaran yang cocok dengan filter atau pencarian.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubjects.map((subject) => {
            const defaultTeacher = subject.defaultTeacherId ? teacherMap.get(subject.defaultTeacherId) : null;
            const defaultRoom = subject.defaultRoomId ? roomMap.get(subject.defaultRoomId) : null;
            const linkedBooks = booksBySubjectMap.get(subject.id) || [];
            const primaryBookId = subject.default_book || subject.defaultBookId || subject.primary_book_code;
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
                  <div className="flex items-start justify-between gap-1.5 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-md shrink-0 shadow-2xs border border-black/10"
                        style={{ backgroundColor: subject.color }}
                      />
                      <span className="text-base font-bold text-slate-900 truncate" title={subject.name}>
                        {subject.name}
                      </span>
                    </div>
                    {subject.department && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 shrink-0">
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
                            <span>Kitab Rujukan ({linkedBooks.length}):</span>
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                          {linkedBooks.map((b) => {
                            const isPrimary = b.id === primaryBookId;
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
                                  className="min-w-0 flex items-center gap-1.5 truncate text-left cursor-pointer group flex-1"
                                  title={`Buka rincian kitab ${b.title} di Daftar Buku`}
                                >
                                  <span
                                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 shadow-2xs ${
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

                                {/* Badge: Pokok vs Rujukan */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {isPrimary ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                      Pokok
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
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
                        className="flex justify-between items-center w-full px-3 py-2 rounded-xl bg-amber-50/80 border border-amber-200/90 hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer"
                        title="Buka silabus materi pembelajaran untuk mapel ini"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <BookmarkCheck className="w-3.5 h-3.5 text-amber-700" />
                          <span>Silabus Materi</span>
                        </span>
                        <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full">
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
                  <span className="font-bold text-slate-800">
                    {totalSessions} sesi / pekan
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
