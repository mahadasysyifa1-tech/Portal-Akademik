import React, { useState, useMemo } from 'react';
import { DatabaseState, Subject, ClassEntity } from '../../types';
import {
  BookOpen,
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
import {
  buildBookClassRelations,
  buildSubjectBookRelations
} from '../../utils/directoryRelations';
import { useCardHighlight } from '../../hooks/useCardHighlight';
import { DirectoryShell } from './DirectoryShell';

interface BooksDirectoryProps {
  db: DatabaseState;
  initialSelectedBookId?: string | null;
  onBackToSchedule: () => void;
  onSelectSubject?: (subjectId: string) => void;
  onSelectClass?: (classId: string) => void;
  onNavigateToJournal?: (subjectId?: string, classId?: string, date?: string) => void;
}

export const BooksDirectory: React.FC<BooksDirectoryProps> = ({
  db,
  initialSelectedBookId,
  onSelectSubject,
  onSelectClass,
  onNavigateToJournal
}) => {
  const [search, setSearch] = useState('');
  const [expandedBookIds, setExpandedBookIds] = useState<Set<string>>(() => {
    return initialSelectedBookId ? new Set([initialSelectedBookId]) : new Set();
  });

  useCardHighlight(
    initialSelectedBookId,
    'book-card-',
    ['ring-4', 'ring-indigo-500', 'ring-offset-2']
  );

  const teacherMap = useMemo(() => new Map((db.teachers || []).map((t) => [t.id, t])), [db.teachers]);

  // Count how many syllabus units use each book (by id or display code)
  const syllabusUnitsByBook = useMemo(() => {
    const map = new Map<string, number>();
    const allBooks = db.books || [];
    (db.syllabusUnits || []).forEach((u) => {
      const bRef = u.bookId || u.bookCode;
      if (!bRef) return;
      const matchedBook = allBooks.find(
        (b) => b.id === bRef || b.displayCode === bRef || b.display_code === bRef
      );
      const key = matchedBook ? matchedBook.id : bRef;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [db.books, db.syllabusUnits]);

  // Unified Many-to-Many Book -> Subjects and Book -> Classes relations
  const { subjectsByBookMap } = useMemo(() => buildSubjectBookRelations(db), [db]);
  const classesByBookMap = useMemo(
    () => buildBookClassRelations(db, subjectsByBookMap),
    [db, subjectsByBookMap]
  );

  const booksList = useMemo(() => db.books || [], [db.books]);

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
      return (
        matchTitle ||
        matchAlt ||
        matchAuthor ||
        matchPublisher ||
        matchEdition ||
        matchCode ||
        matchSubject ||
        matchClass
      );
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
    <DirectoryShell
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari judul kitab, muallif, penerbit, mapel, atau kelas..."
      focusRingClass="focus-visible:ring-indigo-500"
      summarySlot={
        <div className="flex items-center gap-2">
          <span>Koleksi:</span>
          <span className="text-indigo-700 font-bold">{totalStats.books} Kitab</span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-indigo-700 font-bold">{totalStats.volumes} Jilid</span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-indigo-700 font-bold">{totalStats.pages.toLocaleString('id-ID')} Hal</span>
        </div>
      }
      isEmpty={filteredBooks.length === 0}
      emptyState={{
        icon: <BookMarked className="w-10 h-10 mx-auto text-slate-300" />,
        title: 'Tidak ada kitab yang cocok',
        description: 'Coba ubah kata kunci pencarian Anda.'
      }}
    >
      {filteredBooks.map((book) => {
        const isExpanded = expandedBookIds.has(book.id);
        const chapters = book.chapters || [];
        const totalJilid = chapters.length > 0 ? chapters.length : (book.totalChapters || 0);
        const cumulativePages =
          chapters.length > 0
            ? chapters.reduce((sum, ch) => sum + (Number(ch.pageEnd) || 0), 0)
            : (book.totalPages || 0);

        const linkedSubjects: Subject[] = subjectsByBookMap.get(book.id) || [];
        const usedClasses: ClassEntity[] = classesByBookMap.get(book.id) || [];
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
              {/* Card Header: Display Code & Unboxed Volume/Page Metadata */}
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 tabular-nums">
                  {book.displayCode || book.id}
                </span>
                <span className="text-[11px] font-mono font-semibold text-slate-500 tabular-nums">
                  {totalJilid} Jilid · {cumulativePages.toLocaleString('id-ID')} Hal
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
                    <strong className="text-slate-700 font-semibold tabular-nums">
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
                    <strong className="text-slate-700 font-semibold tabular-nums">
                      Kelas Pengguna ({usedClasses.length}):
                    </strong>
                  </div>
                  {usedClasses.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {usedClasses.map((cls) =>
                        onSelectClass ? (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => onSelectClass(cls.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            title={`Buka rincian kelas ${cls.name} (Tingkat ${cls.grade} - Seksi ${cls.section})`}
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
                          </button>
                        ) : (
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
                        )
                      )}
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
                    <span className="tabular-nums">
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

              {/* Expandable Chapters/Jilid List */}
              {chapters.length > 0 && (
                <div className="border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(book.id)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors py-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="tabular-nums">Rincian {chapters.length} Jilid / Bab</span>
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
                          <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shrink-0 tabular-nums">
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
                <span className="text-[11px] text-slate-500 shrink-0 font-medium tabular-nums">
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
      })}
    </DirectoryShell>
  );
};
