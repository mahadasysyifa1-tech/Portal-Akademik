import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseState, Subject, Book as BookType } from '../../types';
import {
  BookOpen,
  Search,
  User,
  DoorOpen,
  Layers,
  ArrowLeft,
  Book,
  FileText,
  ShoppingCart,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { getUnitsForSubject } from '../../utils/pacingEngine';

interface SubjectsDirectoryProps {
  db: DatabaseState;
  initialSelectedSubjectId?: string | null;
  onBackToSchedule: () => void;
  onSelectSubject: (subjectId: string) => void;
  onSelectBook?: (bookId: string) => void;
}

export const SubjectsDirectory: React.FC<SubjectsDirectoryProps> = ({
  db,
  initialSelectedSubjectId,
  onBackToSchedule,
  onSelectSubject,
  onSelectBook
}) => {
  const [search, setSearch] = useState('');
  const teacherMap = useMemo(() => new Map((db.teachers || []).map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map((db.rooms || []).map((r) => [r.id, r])), [db.rooms]);
  const bookMap = useMemo(() => new Map<string, BookType>((db.books || []).map((b) => [b.id, b])), [db.books]);

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

  // Gather all books referenced by each subject (Many-to-Many)
  const booksBySubjectMap = useMemo(() => {
    const map = new Map<string, BookType[]>();
    const allBooks = db.books || [];
    const allSubjects = db.subjects || [];
    const allUnits = db.syllabusUnits || [];
    const allScopes = db.syllabusScopes || [];

    for (const subject of allSubjects) {
      const linkedBookIds = new Set<string>();

      // a) Default book
      const def = subject.default_book || subject.defaultBookId || subject.primary_book_code;
      if (def) {
        linkedBookIds.add(def);
      }

      // b) Books pointing to this subject
      for (const b of allBooks) {
        if (b.defaultSubjectId === subject.id) {
          linkedBookIds.add(b.id);
        }
      }

      // c) Syllabus units
      for (const u of allUnits) {
        if (u.subject_id === subject.id && u.bookId) {
          linkedBookIds.add(u.bookId);
        }
      }

      // d) Syllabus scopes
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

      const resolvedBooks: BookType[] = [];
      for (const bId of linkedBookIds) {
        const b = bookMap.get(bId) || allBooks.find((book) => book.displayCode === bId || book.code === bId);
        if (b && !resolvedBooks.some((existing) => existing.id === b.id)) {
          resolvedBooks.push(b);
        }
      }
      map.set(subject.id, resolvedBooks);
    }

    return map;
  }, [db.subjects, db.books, db.syllabusUnits, db.syllabusScopes, bookMap]);

  const filteredSubjects = useMemo(() => {
    return db.subjects.filter((s) => {
      const q = search.toLowerCase();
      const linkedBooks = booksBySubjectMap.get(s.id) || [];
      const matchBook = linkedBooks.some(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.displayCode && b.displayCode.toLowerCase().includes(q))
      );
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q)) ||
        matchBook
      );
    });
  }, [db.subjects, search, booksBySubjectMap]);

  // Compute how many rules/sessions are scheduled for each subject
  const subjectSessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    db.rules.forEach((r) => {
      if (r.active) {
        counts[r.subjectId] = (counts[r.subjectId] || 0) + (r.daysOfWeek?.length || 1);
      }
    });
    return counts;
  }, [db.rules]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubjects.map((subject) => {
          const defaultTeacher = subject.defaultTeacherId ? teacherMap.get(subject.defaultTeacherId) : null;
          const defaultRoom = subject.defaultRoomId ? roomMap.get(subject.defaultRoomId) : null;
          const linkedBooks = booksBySubjectMap.get(subject.id) || [];
          const totalSessions = subjectSessionCounts[subject.id] || 0;
          const syllabusUnits = getUnitsForSubject(db, subject.id);

          return (
            <div
              key={subject.id}
              id={`subject-card-${subject.id}`}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-1.5 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-md shrink-0 shadow-2xs"
                      style={{ backgroundColor: subject.color }}
                    />
                    <span className="text-base font-bold text-slate-900">
                      {subject.name}
                    </span>
                  </div>
                  {subject.department && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                      {subject.department}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Pengampu: {defaultTeacher ? defaultTeacher.name : 'Disesuaikan per jadwal'}</span>
                  </div>

                  {/* Linked Books List */}
                  {linkedBooks.length > 0 ? (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                        <Book className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Kitab / Buku Acuan ({linkedBooks.length}):</span>
                      </div>
                      <div className="space-y-1">
                        {linkedBooks.map((b) => (
                          <div
                            key={b.id}
                            className="bg-amber-50/70 border border-amber-200/80 hover:border-amber-300 hover:bg-amber-100/60 rounded-lg p-1.5 px-2 flex items-center justify-between gap-1.5 text-xs transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectBook?.(b.id)}
                              className="min-w-0 flex items-center gap-1.5 truncate text-left cursor-pointer group flex-1"
                              title={`Buka rincian kitab ${b.title} di Daftar Buku`}
                            >
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-amber-800 border border-amber-200 shrink-0 group-hover:bg-amber-600 group-hover:text-white group-hover:border-amber-600 transition-colors shadow-2xs">
                                {b.displayCode || b.id}
                              </span>
                              <span className="font-semibold text-amber-950 group-hover:text-amber-900 group-hover:underline truncate" title={b.title}>
                                {b.altTitle}
                              </span>
                            </button>

                            {/* Resource links for this specific book */}
                            {b.links && b.links.length > 0 && (
                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {b.links.map((link, lIdx) => (
                                  <a
                                    key={link.id || lIdx}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded bg-white text-indigo-700 border border-amber-200 hover:bg-indigo-50 flex items-center"
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
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                      <Book className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Belum ada buku rujukan</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectSubject(subject.id)}
                    className="flex justify-between items-center w-full p-1.5 rounded-xl bg-amber-50/60 border border-amber-200/70 hover:bg-amber-100/70 hover:border-amber-300 transition-colors cursor-pointer mt-1"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Silabus Materi
                    </span>
                    <span className="text-[10px] font-semibold text-amber-700">
                      {syllabusUnits.length} materi
                    </span>
                  </button>

                  {defaultRoom && (
                    <div className="flex items-center gap-1.5">
                      <DoorOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Ruang: {defaultRoom.name}</span>
                    </div>
                  )}
                </div>
              </div>

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
    </div>
  );
};
