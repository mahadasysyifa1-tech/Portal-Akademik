import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseState, Book as BookType, Subject, ClassEntity } from '../../types';
import {
  BookOpen,
  Search,
  User,
  Building,
  Layers,
  FileText,
  ShoppingCart,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookmarkCheck,
  BookMarked,
  Users,
  GraduationCap
} from 'lucide-react';

interface BooksDirectoryProps {
  db: DatabaseState;
  initialSelectedBookId?: string | null;
  onBackToSchedule: () => void;
  onSelectSubject?: (subjectId: string) => void;
  onNavigateToJournal?: (subjectId?: string, classId?: string, date?: string) => void;
}

export const BooksDirectory: React.FC<BooksDirectoryProps> = ({
  db,
  initialSelectedBookId,
  onSelectSubject,
  onNavigateToJournal
}) => {
  const [search, setSearch] = useState('');
  const [expandedBookIds, setExpandedBookIds] = useState<Set<string>>(() => {
    return initialSelectedBookId ? new Set([initialSelectedBookId]) : new Set();
  });

  // Smooth scroll and highlight selected book card
  useEffect(() => {
    if (initialSelectedBookId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`book-card-${initialSelectedBookId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-4', 'ring-indigo-500', 'ring-offset-2');
          setTimeout(() => {
            el.classList.remove('ring-4', 'ring-indigo-500', 'ring-offset-2');
          }, 2500);
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [initialSelectedBookId]);

  const subjectMap = useMemo(() => new Map<string, Subject>((db.subjects || []).map((s) => [s.id, s])), [db.subjects]);
  const teacherMap = useMemo(() => new Map((db.teachers || []).map((t) => [t.id, t])), [db.teachers]);
  const classMap = useMemo(() => new Map<string, ClassEntity>((db.classes || []).map((c) => [c.id, c])), [db.classes]);

  // Count how many syllabus units use each book
  const syllabusUnitsByBook = useMemo(() => {
    const map = new Map<string, number>();
    (db.syllabusUnits || []).forEach((u) => {
      const bId = u.bookId || u.bookCode;
      if (bId) {
        map.set(bId, (map.get(bId) || 0) + 1);
      }
    });
    return map;
  }, [db.syllabusUnits]);

  // Gather all subjects linked to each book (Many-to-Many)
  const subjectsByBookMap = useMemo(() => {
    const map = new Map<string, Subject[]>();
    const allBooks = db.books || [];
    const allSubjects = db.subjects || [];
    const allUnits = db.syllabusUnits || [];
    const allScopes = db.syllabusScopes || [];

    for (const book of allBooks) {
      const linkedSubjectIds = new Set<string>();

      // a) Subject default book
      for (const s of allSubjects) {
        const def = s.default_book || s.defaultBookId || s.primary_book_code;
        if (
          def &&
          (def === book.id ||
            (book.displayCode && def === book.displayCode) ||
            (book.code && def === book.code))
        ) {
          linkedSubjectIds.add(s.id);
        }
      }

      // b) Book default subject
      if (book.defaultSubjectId) {
        linkedSubjectIds.add(book.defaultSubjectId);
      }

      // c) Syllabus units
      for (const u of allUnits) {
        const matchBook =
          u.bookId === book.id ||
          u.bookCode === book.id ||
          (book.displayCode && (u.bookCode === book.displayCode || u.bookId === book.displayCode));
        if (matchBook && u.subject_id) {
          linkedSubjectIds.add(u.subject_id);
        }
      }

      // d) Syllabus scopes
      for (const scope of allScopes) {
        const scopeSubId = scope.subject_id;
        if (!scopeSubId) continue;
        const hasBookInItems = scope.items?.some((it) => it.bookId === book.id);
        const hasBookInList = scope.book_ids?.includes(book.id);
        const isSingleBook = scope.book_id === book.id;
        if (hasBookInItems || hasBookInList || isSingleBook) {
          linkedSubjectIds.add(scopeSubId);
        }
      }

      const resolvedSubjects: Subject[] = [];
      for (const subId of linkedSubjectIds) {
        const s = subjectMap.get(subId);
        if (s && !resolvedSubjects.some((existing) => existing.id === s.id)) {
          resolvedSubjects.push(s);
        }
      }
      map.set(book.id, resolvedSubjects);
    }

    return map;
  }, [db.books, db.subjects, db.syllabusUnits, db.syllabusScopes, subjectMap]);

  // Gather all classes that study each book (Many-to-Many: from scopes and schedule rules)
  const classesByBookMap = useMemo(() => {
    const map = new Map<string, ClassEntity[]>();
    const allBooks = db.books || [];
    const allScopes = db.syllabusScopes || [];
    const allRules = db.rules || [];
    const allClasses = db.classes || [];

    for (const book of allBooks) {
      const classIdSet = new Set<string>();

      // 1. From syllabus scopes
      for (const scope of allScopes) {
        const hasBook =
          scope.book_id === book.id ||
          scope.book_ids?.includes(book.id) ||
          scope.items?.some((it) => it.bookId === book.id);
        if (hasBook && scope.class_section_id) {
          classIdSet.add(scope.class_section_id);
        }
      }

      // 2. From active schedule rules for linked subjects
      const linkedSubjects = subjectsByBookMap.get(book.id) || [];
      const linkedSubjIds = new Set(linkedSubjects.map((s) => s.id));
      for (const rule of allRules) {
        if (rule.active !== false && linkedSubjIds.has(rule.subjectId) && rule.classId) {
          classIdSet.add(rule.classId);
        }
      }

      const resolvedClasses: ClassEntity[] = [];
      for (const cId of classIdSet) {
        const cls = classMap.get(cId) || allClasses.find((c) => c.id === cId || c.name === cId || c.displayCode === cId);
        if (cls && !resolvedClasses.some((existing) => existing.id === cls.id)) {
          resolvedClasses.push(cls);
        }
      }

      // Sort classes chronologically by grade and section
      resolvedClasses.sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));
      map.set(book.id, resolvedClasses);
    }

    return map;
  }, [db.books, db.syllabusScopes, db.rules, db.classes, subjectsByBookMap, classMap]);

  const booksList = useMemo(() => {
    return db.books || [];
  }, [db.books]);

  const filteredBooks = useMemo(() => {
    if (!search.trim()) return booksList;
    const q = search.toLowerCase();
    return booksList.filter((b) => {
      const matchTitle = b.title.toLowerCase().includes(q);
      const matchAlt = (b.altTitle || '').toLowerCase().includes(q);
      const matchAuthor = (b.author || '').toLowerCase().includes(q);
      const matchPublisher = (b.publisher || '').toLowerCase().includes(q);
      const matchCode = (b.displayCode || b.id || '').toLowerCase().includes(q);
      const matchEdition = (b.edition || '').toLowerCase().includes(q);
      const linkedSubjects = subjectsByBookMap.get(b.id) || [];
      const matchSubject = linkedSubjects.some(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.code && s.code.toLowerCase().includes(q))
      );
      const linkedClasses = classesByBookMap.get(b.id) || [];
      const matchClass = linkedClasses.some(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.displayCode && c.displayCode.toLowerCase().includes(q))
      );
      return matchTitle || matchAlt || matchAuthor || matchPublisher || matchEdition || matchCode || matchSubject || matchClass;
    });
  }, [booksList, search, subjectsByBookMap, classesByBookMap]);

  const toggleExpand = (bookId: string) => {
    setExpandedBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  };

  // Stats summary
  const totalStats = useMemo(() => {
    let volumes = 0;
    let pages = 0;
    (db.books || []).forEach((b) => {
      const chs = b.chapters || [];
      if (chs.length > 0) {
        volumes += chs.length;
        pages += chs.reduce((sum, ch) => sum + (Number(ch.pageEnd) || 0), 0);
      } else {
        volumes += b.totalChapters || 1;
        pages += b.totalPages || 0;
      }
    });
    return { books: db.books?.length || 0, volumes, pages };
  }, [db.books]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Search & Stats Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul kitab, muallif, penerbit, mapel, atau kelas..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span>Koleksi:</span>
          <span className="text-indigo-700 font-bold">{totalStats.books} Kitab</span>
          <span className="text-slate-300">•</span>
          <span className="text-indigo-700 font-bold">{totalStats.volumes} Jilid</span>
          <span className="text-slate-300">•</span>
          <span className="text-indigo-700 font-bold">{totalStats.pages.toLocaleString('id-ID')} Hal</span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBooks.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <BookMarked className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Tidak ada kitab yang cocok</p>
            <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian Anda</p>
          </div>
        ) : (
          filteredBooks.map((book) => {
            const isExpanded = expandedBookIds.has(book.id);
            const chapters = book.chapters || [];
            const totalJilid = chapters.length > 0 ? chapters.length : (book.totalChapters || 0);
            const cumulativePages = chapters.length > 0
              ? chapters.reduce((sum, ch) => sum + (Number(ch.pageEnd) || 0), 0)
              : (book.totalPages || 0);

            const linkedSubjects = subjectsByBookMap.get(book.id) || [];
            const usedClasses = classesByBookMap.get(book.id) || [];
            const defaultTeacher = book.defaultTeacherId ? teacherMap.get(book.defaultTeacherId) : null;
            const unitCount = syllabusUnitsByBook.get(book.id) || 0;
            const links = book.links || [];

            return (
              <div
                key={book.id}
                id={`book-card-${book.id}`}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-4 space-y-3 flex-1">
                  {/* Card Header: Badges & Display Code */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {book.displayCode || book.id}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                      {totalJilid} Jilid • {cumulativePages.toLocaleString('id-ID')} Hal
                    </span>
                  </div>

                  {/* Title & Arabic Alt Title */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {book.title}
                    </h3>
                    {book.altTitle && book.altTitle !== book.title && (
                      <p className="text-xs text-indigo-900 font-medium mt-0.5 font-arabic" dir="auto">
                        {book.altTitle}
                      </p>
                    )}
                  </div>

                  {/* Metadata fields */}
                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                    {book.author && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          <strong className="text-slate-700">Muallif:</strong> {book.author}
                        </span>
                      </div>
                    )}
                    {book.publisher && (
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          <strong className="text-slate-700">Penerbit:</strong> {book.publisher}
                        </span>
                      </div>
                    )}
                    {book.edition && (
                      <div className="flex items-center gap-2">
                        <BookMarked className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          <strong className="text-slate-700">Edisi / Cetakan:</strong> {book.edition}
                        </span>
                      </div>
                    )}

                    {/* Linked Subjects List */}
                    <div className="pt-0.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <strong className="text-slate-700 font-semibold">
                          Mapel Terkait ({linkedSubjects.length}):
                        </strong>
                      </div>
                      {linkedSubjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {linkedSubjects.map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => onSelectSubject?.(sub.id)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60 text-slate-800 transition-colors cursor-pointer shadow-2xs group"
                              title={`Buka silabus mapel ${sub.name}`}
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: sub.color || '#3B82F6' }}
                              />
                              <span className="group-hover:text-indigo-700 truncate max-w-[130px]">{sub.name}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic block pl-5">
                          Belum ditautkan ke mapel
                        </span>
                      )}
                    </div>

                    {/* Classes Studying this Book (Bi-directional Multi-Class Support) */}
                    <div className="pt-1 border-t border-slate-200/60 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <strong className="text-slate-700 font-semibold">
                          Kelas Pengguna ({usedClasses.length}):
                        </strong>
                      </div>
                      {usedClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {usedClasses.map((cls) => (
                            <span
                              key={cls.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white border border-indigo-200 text-indigo-800 shadow-2xs"
                              title={`Kelas ${cls.name} (Tingkat ${cls.grade} - Seksi ${cls.section})`}
                            >
                              {cls.color ? (
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: cls.color }}
                                />
                              ) : (
                                <GraduationCap className="w-3 h-3 text-indigo-500 shrink-0" />
                              )}
                              <span>{cls.name}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic block pl-5">
                          Belum dialokasikan ke jadwal kelas
                        </span>
                      )}
                    </div>

                    {defaultTeacher && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          <strong className="text-slate-700">Pengampu:</strong>{' '}
                          {defaultTeacher.panggilan || defaultTeacher.name}
                        </span>
                      </div>
                    )}

                    {unitCount > 0 && (
                      <div className="flex items-center gap-2">
                        <BookmarkCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          <strong className="text-slate-700">Silabus:</strong> {unitCount} bab materi terdaftar
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Resource Links (PDF, Toko Online, Web) */}
                  {links.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Tautan &amp; Pembelian:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {links.map((link) => {
                          const isPdf = link.type === 'pdf' || link.url.endsWith('.pdf');
                          const isShopping = link.type.includes('shopping') || link.type.includes('toko');
                          return (
                            <a
                              key={link.id || link.url}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                isPdf
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                  : isShopping
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                              }`}
                            >
                              {isPdf ? (
                                <FileText className="w-3 h-3 shrink-0" />
                              ) : isShopping ? (
                                <ShoppingCart className="w-3 h-3 shrink-0" />
                              ) : (
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              )}
                              <span className="truncate max-w-[150px]">{link.label || 'Buka Link'}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Expandable Chapters/Jilid List (Polished Carousel/Slider Card) */}
                  {chapters.length > 0 && (
                    <div className="border-t border-slate-100 pt-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(book.id)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors py-1 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Rincian {chapters.length} Jilid / Bab</span>
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 animate-in fade-in duration-150 max-h-48 overflow-y-auto">
                          {chapters.map((ch, idx) => (
                            <div
                              key={ch.id || idx}
                              className="bg-white p-2 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block truncate">
                                  {ch.title || `Jilid ${ch.chapterNumber ?? (idx + 1)}`}
                                </span>
                                {ch.description && (
                                  <span className="text-[10px] text-slate-500 block truncate">
                                    {ch.description}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shrink-0">
                                {ch.pageStart && ch.pageEnd
                                  ? `Hal. ${ch.pageStart}–${ch.pageEnd}`
                                  : ch.pageEnd
                                  ? `${ch.pageEnd} hal`
                                  : '-'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer: Silabus & Jurnal Action Buttons */}
                {onSelectSubject && linkedSubjects.length > 0 && (
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                      {linkedSubjects.length === 1 ? 'Silabus Mapel:' : `Silabus (${linkedSubjects.length} Mapel):`}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {linkedSubjects.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            if (onSelectSubject) {
                              onSelectSubject(sub.id);
                            } else if (onNavigateToJournal) {
                              onNavigateToJournal(sub.id, '', '');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          title={`Buka silabus pembelajaran ${sub.name}`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: sub.color || '#3B82F6' }}
                          />
                          <span className="truncate max-w-[130px]">{sub.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
