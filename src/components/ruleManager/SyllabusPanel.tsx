import React, { useState, useMemo, useEffect } from 'react';
import {
  DatabaseState,
  Subject,
  ClassEntity,
  SyllabusUnit,
  SyllabusScope
} from '../../types';
import {
  BookOpen,
  Calendar,
  Search,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  BookMarked,
  Settings
} from 'lucide-react';
import {
  getAllScheduledMeetingsCountMap,
  getUnitsForSubject,
  getScopedUnits
} from '../../utils/pacingEngine';
import { ClassIcon } from '../ClassIcon';
import { SyllabusScopeModal } from './SyllabusScopeModal';

interface SyllabusPanelProps {
  db: DatabaseState;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
  onNavigateToJournal?: (subjectId?: string, classId?: string, date?: string) => void;
  initialSubjectId?: string;
  initialClassId?: string;
}

interface PackageBookScopeInfo {
  bookId: string;
  bookTitle: string;
  edition?: string;
  isDefault: boolean;
  scopedUnits: SyllabusUnit[];
  allBookUnits: SyllabusUnit[];
  totalPages: number;
  rangeText: string;
}

interface PackageItem {
  key: string;
  subject: Subject;
  classObj: ClassEntity;
  scopedBookIds: string[];
  bookScopes: PackageBookScopeInfo[];
  subjectUnits: SyllabusUnit[];
  scopedUnits: SyllabusUnit[];
  totalPages: number;
  totalMeetings: number;
  existingScope: SyllabusScope | undefined;
  laju: number | null;
  hasCustomScope: boolean;
  rangeSummary: string;
}

/**
 * Formats a clean, readable summary of chapter ranges for display in the table.
 * Examples: "Bab 1–3, Bab 5–8" or "Kitab A: Bab 1–10 • Kitab B: Bab 1–5"
 */
function buildRangeSummary(
  pkg: {
    existingScope?: SyllabusScope;
    scopedBookIds: string[];
    scopedUnits: SyllabusUnit[];
    subjectUnits: SyllabusUnit[];
  },
  bookMap: Map<string, any>
): string {
  if (pkg.scopedUnits.length === 0) {
    return '0 Bab (Materi belum diisi)';
  }

  // 1. If multi-range scope with items
  if (pkg.existingScope?.items && pkg.existingScope.items.length > 0) {
    const items = [...pkg.existingScope.items].sort((a, b) => (a.sortOrder || 1) - (b.sortOrder || 1));
    const bookGroups = new Map<string, string[]>();

    for (const it of items) {
      const bId = it.bookId || pkg.scopedBookIds[0] || 'default';
      const bUnits = pkg.subjectUnits.filter((u) => u.bookId === bId);
      const sUnit = bUnits.find((u) => u.id === it.startMaterialId);
      const eUnit = bUnits.find((u) => u.id === it.endMaterialId);

      const sOrder = sUnit?.order ?? 1;
      const eOrder = eUnit?.order ?? sOrder;
      const rangeText = sOrder === eOrder ? `Bab ${sOrder}` : `Bab ${sOrder}–${eOrder}`;

      const list = bookGroups.get(bId) || [];
      list.push(rangeText);
      bookGroups.set(bId, list);
    }

    // Format per book if multiple books, otherwise just comma-separated ranges
    if (bookGroups.size > 1) {
      const parts: string[] = [];
      for (const [bId, ranges] of bookGroups.entries()) {
        const b = bookMap.get(bId);
        const title = b?.title ? (b.title.length > 18 ? b.title.slice(0, 16) + '...' : b.title) : 'Buku';
        parts.push(`${title}: ${ranges.join(', ')}`);
      }
      return parts.join(' • ');
    }

    const firstRanges = Array.from(bookGroups.values())[0] || [];
    return firstRanges.join(', ');
  }

  // 2. Legacy single range or full default
  const first = pkg.scopedUnits[0];
  const last = pkg.scopedUnits[pkg.scopedUnits.length - 1];

  if (!first || !last) {
    return `${pkg.scopedUnits.length} Bab`;
  }

  const sOrder = first.order ?? 1;
  const eOrder = last.order ?? sOrder;

  if (sOrder === eOrder) {
    return `Bab ${sOrder}`;
  }

  if (pkg.scopedUnits.length === pkg.subjectUnits.length) {
    return `Semua Bab (${sOrder}–${eOrder})`;
  }

  return `Bab ${sOrder}–${eOrder}`;
}

export const SyllabusPanel: React.FC<SyllabusPanelProps> = ({
  db,
  onUpdateDb,
  isAdmin = true,
  onOpenAdminLogin,
  onNavigateToJournal,
  initialSubjectId,
  initialClassId
}) => {
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterSchedule, setFilterSchedule] = useState<'all' | 'scheduled' | 'unscheduled'>('all');
  const [filterScope, setFilterScope] = useState<'all' | 'custom' | 'default'>('all');
  const [onlyScheduled, setOnlyScheduled] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Active package for the dedicated scope editor modal
  const [editingScopePkgKey, setEditingScopePkgKey] = useState<string | null>(() => {
    if (initialSubjectId && initialClassId) {
      return `${initialSubjectId}_${initialClassId}`;
    }
    return null;
  });

  useEffect(() => {
    if (initialSubjectId && initialClassId) {
      setEditingScopePkgKey(`${initialSubjectId}_${initialClassId}`);
    }
  }, [initialSubjectId, initialClassId]);

  // Fast maps
  const subjectMap = useMemo(() => new Map(db.subjects.map((s) => [s.id, s])), [db.subjects]);
  const classMap = useMemo(() => new Map(db.classes.map((c) => [c.id, c])), [db.classes]);
  const bookMap = useMemo(() => new Map((db.books || []).map((b) => [b.id, b])), [db.books]);

  const scopesMap = useMemo(() => {
    const map = new Map<string, SyllabusScope>();
    for (const sc of db.syllabusScopes || []) {
      map.set(`${sc.subject_id}_${sc.class_section_id}`, sc);
    }
    return map;
  }, [db.syllabusScopes]);

  // Fast single-pass pre-aggregated scheduled meetings count
  const meetingsCountMap = useMemo(() => {
    return getAllScheduledMeetingsCountMap(db);
  }, [db.rules, db.periods, db.sessions]);

  // Compute packages with dynamic page calculation
  const allPackages = useMemo<PackageItem[]>(() => {
    const packages: PackageItem[] = [];

    const createPackageItem = (subj: Subject, cls: ClassEntity): PackageItem => {
      const key = `${subj.id}_${cls.id}`;
      const totalMeetings = meetingsCountMap.get(key) || 0;
      const existingScope = scopesMap.get(key);

      const defaultBookId = subj.default_book || subj.defaultBookId;
      const scopedBookIds: string[] =
        existingScope?.book_ids && existingScope.book_ids.length > 0
          ? existingScope.book_ids
          : existingScope?.book_id
          ? [existingScope.book_id]
          : defaultBookId
          ? [defaultBookId]
          : [];

      const subjectUnits = getUnitsForSubject(db, subj.id, existingScope);
      const scopedUnits = getScopedUnits(db, subj.id, cls.id);

      const allDbUnits = Array.isArray(db.syllabusUnits) ? db.syllabusUnits : [];
      const scopeItems = existingScope?.items || [];

      // Compute granular scope details per book
      const bookScopes: PackageBookScopeInfo[] = scopedBookIds.map((bId) => {
        const book = bookMap.get(bId);
        const bookTitle = book?.title || bId;
        const edition = book?.edition;
        const isDefault = bId === defaultBookId;

        // Units for this specific book
        const allBookUnits = allDbUnits
          .filter((u) => u.bookId === bId || (!u.bookId && bId === defaultBookId))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const scopedUnitsForBook = scopedUnits.filter(
          (u) => u.bookId === bId || (!u.bookId && bId === defaultBookId)
        );

        const bTotalPages = scopedUnitsForBook.reduce((acc, u) => {
          const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
          const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
          if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
            return acc + (pEnd - pStart + 1);
          }
          return acc + 1;
        }, 0);

        // Determine range text for this book
        let rangeText = '';
        const itemsForBook = scopeItems.filter(
          (it) => (it.bookId || existingScope?.book_id || defaultBookId) === bId
        );

        if (itemsForBook.length > 0) {
          const sorted = [...itemsForBook].sort((a, b) => (a.sortOrder || 1) - (b.sortOrder || 1));
          const ranges = sorted.map((it) => {
            const sUnit = allBookUnits.find((u) => u.id === it.startMaterialId);
            const eUnit = allBookUnits.find((u) => u.id === it.endMaterialId);
            const sOrder = sUnit?.order ?? 1;
            const eOrder = eUnit?.order ?? sOrder;
            return sOrder === eOrder ? `Bab ${sOrder}` : `Bab ${sOrder}–${eOrder}`;
          });
          rangeText = ranges.join(', ');
        } else if (scopedUnitsForBook.length === 0) {
          rangeText = '0 Bab';
        } else if (
          allBookUnits.length > 0 &&
          scopedUnitsForBook.length === allBookUnits.length
        ) {
          const first = scopedUnitsForBook[0];
          const last = scopedUnitsForBook[scopedUnitsForBook.length - 1];
          const sOrder = first?.order ?? 1;
          const eOrder = last?.order ?? sOrder;
          rangeText =
            sOrder === eOrder
              ? `Bab ${sOrder} (Semua)`
              : `Semua Bab (${sOrder}–${eOrder})`;
        } else if (scopedUnitsForBook.length > 0) {
          const first = scopedUnitsForBook[0];
          const last = scopedUnitsForBook[scopedUnitsForBook.length - 1];
          const sOrder = first?.order ?? 1;
          const eOrder = last?.order ?? sOrder;
          rangeText = sOrder === eOrder ? `Bab ${sOrder}` : `Bab ${sOrder}–${eOrder}`;
        } else {
          rangeText = '0 Bab';
        }

        return {
          bookId: bId,
          bookTitle,
          edition,
          isDefault,
          scopedUnits: scopedUnitsForBook,
          allBookUnits,
          totalPages: bTotalPages,
          rangeText
        };
      });

      // Calculate total pages dynamically: page_end - page_start + 1
      const totalPages = scopedUnits.reduce((acc, u) => {
        const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
        const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
        if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
          return acc + (pEnd - pStart + 1);
        }
        return acc + 1;
      }, 0);

      const laju = totalMeetings > 0 && totalPages > 0 ? totalPages / totalMeetings : null;
      const hasCustomScope = Boolean(existingScope);
      const rangeSummary = buildRangeSummary(
        { existingScope, scopedBookIds, scopedUnits, subjectUnits },
        bookMap
      );

      return {
        key,
        subject: subj,
        classObj: cls,
        scopedBookIds,
        bookScopes,
        subjectUnits,
        scopedUnits,
        totalPages,
        totalMeetings,
        existingScope,
        laju,
        hasCustomScope,
        rangeSummary
      };
    };

    if (onlyScheduled) {
      const relevantKeys = new Set<string>();
      for (const [key, count] of meetingsCountMap.entries()) {
        if (count > 0) relevantKeys.add(key);
      }
      for (const sc of db.syllabusScopes || []) {
        if (sc.subject_id && sc.class_section_id) {
          relevantKeys.add(`${sc.subject_id}_${sc.class_section_id}`);
        }
      }

      for (const key of relevantKeys) {
        const [subjId, clsId] = key.split('_');
        const subj = subjectMap.get(subjId);
        const cls = classMap.get(clsId);
        if (!subj || !cls) continue;
        packages.push(createPackageItem(subj, cls));
      }
    } else {
      for (const subj of db.subjects) {
        for (const cls of db.classes) {
          packages.push(createPackageItem(subj, cls));
        }
      }
    }

    // Sort by Subject Name, then Class Name
    packages.sort((a, b) => {
      const sComp = a.subject.name.localeCompare(b.subject.name);
      if (sComp !== 0) return sComp;
      return a.classObj.name.localeCompare(b.classObj.name);
    });

    return packages;
  }, [
    db,
    db.subjects,
    db.classes,
    db.syllabusScopes,
    db.syllabusUnits,
    db.books,
    scopesMap,
    meetingsCountMap,
    onlyScheduled,
    subjectMap,
    classMap,
    bookMap
  ]);

  // Filter packages
  const filteredPackages = useMemo(() => {
    return allPackages.filter((pkg) => {
      if (filterClass !== 'all' && pkg.classObj.id !== filterClass) return false;
      if (filterSubject !== 'all' && pkg.subject.id !== filterSubject) return false;
      if (filterSchedule === 'scheduled' && pkg.totalMeetings === 0) return false;
      if (filterSchedule === 'unscheduled' && pkg.totalMeetings > 0) return false;
      if (filterScope === 'custom' && !pkg.hasCustomScope) return false;
      if (filterScope === 'default' && pkg.hasCustomScope) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const subjName = pkg.subject.name.toLowerCase();
        const subjCode = (pkg.subject.code || pkg.subject.id || '').toLowerCase();
        const clsName = pkg.classObj.name.toLowerCase();
        const hasBookMatch = pkg.scopedBookIds.some((bId) => {
          const bookTitle = (bookMap.get(bId)?.title || '').toLowerCase();
          return bookTitle.includes(q);
        });
        return subjName.includes(q) || subjCode.includes(q) || clsName.includes(q) || hasBookMatch;
      }

      return true;
    });
  }, [allPackages, filterClass, filterSubject, filterSchedule, filterScope, search, bookMap]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterClass, filterSubject, filterSchedule, filterScope, onlyScheduled, pageSize]);

  const totalPagesCount = Math.max(1, Math.ceil(filteredPackages.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPagesCount);

  const paginatedPackages = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredPackages.slice(start, start + pageSize);
  }, [filteredPackages, safeCurrentPage, pageSize]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = allPackages.length;
    const scheduled = allPackages.filter((p) => p.totalMeetings > 0).length;
    const withCustomScope = allPackages.filter((p) => p.hasCustomScope).length;
    const scheduledPackages = allPackages.filter((p) => p.totalMeetings > 0 && p.laju !== null);
    const avgLaju =
      scheduledPackages.length > 0
        ? scheduledPackages.reduce((sum, p) => sum + (p.laju ?? 0), 0) / scheduledPackages.length
        : 0;

    return { total, scheduled, withCustomScope, avgLaju };
  }, [allPackages]);

  // Scope save / reset handler from the modal
  const handleSaveScopeFromModal = (
    subjectId: string,
    classId: string,
    newScope: SyllabusScope | null
  ) => {
    if (!isAdmin) {
      if (onOpenAdminLogin) onOpenAdminLogin();
      return;
    }

    onUpdateDb((prev) => {
      const scopes = prev.syllabusScopes ? [...prev.syllabusScopes] : [];
      const idx = scopes.findIndex(
        (s) => s.subject_id === subjectId && s.class_section_id === classId
      );

      if (newScope === null) {
        if (idx !== -1) {
          scopes.splice(idx, 1);
        }
      } else {
        if (idx !== -1) {
          scopes[idx] = newScope;
        } else {
          scopes.push(newScope);
        }
      }

      return {
        ...prev,
        syllabusScopes: scopes
      };
    });
  };

  const hasActiveFilter =
    search.trim() !== '' ||
    filterClass !== 'all' ||
    filterSubject !== 'all' ||
    filterSchedule !== 'all' ||
    filterScope !== 'all' ||
    !onlyScheduled;

  const resetFilters = () => {
    setSearch('');
    setFilterClass('all');
    setFilterSubject('all');
    setFilterSchedule('all');
    setFilterScope('all');
    setOnlyScheduled(true);
  };

  const targetModalPkg = useMemo(() => {
    if (!editingScopePkgKey) return null;
    return allPackages.find((p) => p.key === editingScopePkgKey) || null;
  }, [editingScopePkgKey, allPackages]);

  return (
    <div className="space-y-3">
      {/* Header & Inline Stats Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">
                Distribusi Silabus
              </h3>
              <p className="hidden text-[11px] text-slate-500">
                Atur buku acuan, rentang bab, dan pantau intensitas laju halaman per kelas.
              </p>
            </div>
          </div>

          {/* Compact Inline Pill Stats */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg">
              <span className="text-slate-500 font-medium">Paket:</span>
              <span className="font-bold text-slate-800">{stats.total}</span>
              <span className="text-[10px] text-slate-400">({stats.scheduled} KBM)</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/70 border border-amber-200/70 rounded-lg text-amber-900">
              <span className="text-amber-700 font-medium">Kustom:</span>
              <span className="font-bold">{stats.withCustomScope}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/70 border border-emerald-200/70 rounded-lg text-emerald-900">
              <span className="text-emerald-700 font-medium">Rata-rata:</span>
              <span className="font-bold">{stats.avgLaju.toFixed(1)}</span>
              <span className="text-[10px] text-emerald-600">hal/sesi</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari mapel, kode, atau kelas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-colors placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="Hapus pencarian"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Toggle: Hanya KBM Terjadwal */}
            <label
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                onlyScheduled
                  ? 'bg-indigo-50/90 text-indigo-700 border-indigo-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Abaikan kombinasi mapel & kelas tanpa jam jadwal pertemuan"
            >
              <input
                type="checkbox"
                checked={onlyScheduled}
                onChange={(e) => setOnlyScheduled(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="whitespace-nowrap">Hanya KBM Terjadwal</span>
            </label>

            {/* Filter Kelas */}
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Kelas ({db.classes.length})</option>
              {db.classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>

            {/* Filter Mapel */}
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Mapel ({db.subjects.length})</option>
              {db.subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.code})
                </option>
              ))}
            </select>

            {/* Filter Scope Override */}
            <select
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value as any)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Scope</option>
              <option value="custom">Kustom ({stats.withCustomScope})</option>
              <option value="default">Default ({stats.total - stats.withCustomScope})</option>
            </select>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs py-1.5 px-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                title="Reset semua filter"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Packages Table (Clean Display-Only Cells) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3.5 w-[70px] border-r border-b border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                  Mapel
                </th>
                <th className="px-4 py-3.5 min-w-[90px] border-b border-slate-200">Kelas</th>
                <th className="px-4 py-3.5 min-w-[70px] text-center border-b border-slate-200">Total KBM</th>
                <th className="px-4 py-3.5 min-w-[280px] border-b border-slate-200">Cakupan Silabus</th>
                <th className="px-4 py-3.5 min-w-[100px] border-b border-slate-200">Target Laju</th>
                <th className="px-4 py-3.5 text-right min-w-[100px] border-b border-slate-200">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPackages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300 opacity-60" />
                    <p className="font-semibold text-slate-600">Tidak ada paket kurikulum yang cocok dengan filter</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {onlyScheduled
                        ? 'Semua kombinasi tanpa jam pertemuan sedang disembunyikan. Coba nonaktifkan "Hanya KBM Terjadwal".'
                        : 'Coba sesuaikan kata kunci pencarian atau opsi filter di atas.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedPackages.map((pkg) => {
                  const hasUnits = pkg.scopedUnits.length > 0;

                  // Laju intensity indicator
                  let lajuBadge = (
                    <span className="text-slate-400 italic text-[11px]">—</span>
                  );

                  if (pkg.laju !== null) {
                    let colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    let barColor = 'bg-emerald-500';
                    let label = 'Wajar';
                    let level = 2;

                    if (pkg.laju > 10) {
                      colorClass = 'bg-rose-50 text-rose-800 border-rose-200';
                      barColor = 'bg-rose-500';
                      label = 'Berat';
                      level = 4;
                    } else if (pkg.laju > 5) {
                      colorClass = 'bg-amber-50 text-amber-800 border-amber-200';
                      barColor = 'bg-amber-500';
                      label = 'Cepat';
                      level = 3;
                    } else if (pkg.laju < 2) {
                      colorClass = 'bg-sky-50 text-sky-800 border-sky-200';
                      barColor = 'bg-sky-500';
                      label = 'Ringan';
                      level = 1;
                    }

                    lajuBadge = (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>
                            <span>{pkg.laju.toFixed(1)}</span>
                            <span className="text-[10px] font-normal opacity-80">hal/sesi</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* 4-step Intensity Meter */}
                          <div
                            className="flex items-center gap-0.5"
                            title={`Intensitas Laju: ${label} (${level}/4)`}
                          >
                            <div className={`w-1.5 h-3 rounded-xs transition-colors ${level >= 1 ? barColor : 'bg-slate-200'}`} />
                            <div className={`w-1.5 h-3 rounded-xs transition-colors ${level >= 2 ? barColor : 'bg-slate-200'}`} />
                            <div className={`w-1.5 h-3 rounded-xs transition-colors ${level >= 3 ? barColor : 'bg-slate-200'}`} />
                            <div className={`w-1.5 h-3 rounded-xs transition-colors ${level >= 4 ? barColor : 'bg-slate-200'}`} />
                          </div>
                          <span className={`text-[10px] font-bold ${barColor.replace('bg-', 'text-')}`}>
                            {label}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <tr
                      key={pkg.key}
                      className="hover:bg-indigo-50/20 transition-colors group"
                    >
                      {/* 1. Subject (Sticky) */}
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors px-4 py-3 align-top min-w-[180px] border-r border-b border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                        <div className="flex items-start gap-2.5">
                          <div
                            className="w-3 h-3 rounded-full mt-1 shrink-0 shadow-2xs border border-white"
                            style={{ backgroundColor: pkg.subject.color || '#6366f1' }}
                            title={`Warna: ${pkg.subject.color}`}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors block leading-snug">
                              {pkg.subject.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                {pkg.subject.code || pkg.subject.id}
                              </span>
                              {pkg.subject.department && (
                                <span className="text-[10px] text-slate-400">
                                  {pkg.subject.department}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Class */}
                      <td className="px-4 py-3 align-top border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                            <ClassIcon icon={pkg.classObj.icon} className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block leading-snug">
                              {pkg.classObj.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Tingkat {pkg.classObj.grade || '—'} {pkg.classObj.section ? `(${pkg.classObj.section})` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Total Pertemuan */}
                      <td className="px-4 py-3 align-top text-center border-b border-slate-100">
                        {pkg.totalMeetings > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200/80">
                              <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{pkg.totalMeetings}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">pertemuan</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>0 Sesi</span>
                          </span>
                        )}
                      </td>

                      {/* 4. Cakupan Silabus & Buku (Merged Column) */}
                      <td className="px-4 py-3 align-top border-b border-slate-100">
                        {pkg.bookScopes.length === 0 ? (
                          <div className="space-y-0.5">
                            <span className="text-[11px] text-slate-400 italic block">
                              Tanpa buku rujukan
                            </span>
                            <span className="text-[10px] text-slate-400">
                              0 Bab (Materi belum diisi)
                            </span>
                          </div>
                        ) : pkg.bookScopes.length === 1 ? (
                          /* Single Book View */
                          (() => {
                            const bInfo = pkg.bookScopes[0];
                            return (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                      bInfo.isDefault
                                        ? 'bg-indigo-50/90 text-indigo-800 border-indigo-200'
                                        : 'bg-amber-50/90 text-amber-800 border-amber-200'
                                    }`}
                                    title={`${bInfo.bookTitle} ${bInfo.edition ? `(${bInfo.edition})` : ''}`}
                                  >
                                    <BookMarked className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                    <span className="truncate max-w-[180px] font-semibold">{bInfo.bookTitle}</span>
                                    {bInfo.edition && (
                                      <span className="text-[10px] opacity-75 font-normal">({bInfo.edition})</span>
                                    )}
                                  </span>

                                  {pkg.hasCustomScope ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                      Kustom
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                                      Default
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pl-0.5 flex-wrap">
                                  <span className="font-bold text-slate-900">{bInfo.rangeText}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="font-medium text-slate-700">{bInfo.scopedUnits.length} Bab</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="font-semibold text-indigo-700">{bInfo.totalPages} Halaman</span>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          /* Multiple Books View: Clean Visual Breakdown */
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <BookMarked className="w-3 h-3 text-indigo-600" />
                                <span>{pkg.bookScopes.length} Buku Rujukan</span>
                              </span>
                              {pkg.hasCustomScope ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  Kustom
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                                  Default
                                </span>
                              )}
                            </div>

                            <div className="space-y-1">
                              {pkg.bookScopes.map((bInfo) => (
                                <div
                                  key={bInfo.bookId}
                                  className="flex items-center justify-between gap-2 px-2 py-1 bg-slate-50/90 rounded-lg border border-slate-200/80 hover:bg-slate-100/70 transition-colors"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        bInfo.isDefault ? 'bg-indigo-500' : 'bg-amber-500'
                                      }`}
                                    />
                                    <span
                                      className="font-medium text-slate-800 text-[11px] truncate max-w-[150px]"
                                      title={`${bInfo.bookTitle} ${bInfo.edition ? `(${bInfo.edition})` : ''}`}
                                    >
                                      {bInfo.bookTitle}
                                    </span>
                                    {bInfo.isDefault && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold shrink-0">
                                        Utama
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                                    <span className="font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                                      {bInfo.rangeText}
                                    </span>
                                    <span className="text-slate-500 font-medium">
                                      {bInfo.scopedUnits.length} Bab ({bInfo.totalPages} hal)
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="pt-0.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 font-medium">
                              <span>Total Cakupan:</span>
                              <span className="text-slate-700 font-semibold">
                                {pkg.scopedUnits.length} Bab <span className="text-slate-300 mx-0.5">•</span>{' '}
                                <span className="text-indigo-700 font-bold">{pkg.totalPages} Halaman</span>
                              </span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 5. Laju & Intensitas */}
                      <td className="px-4 py-3 align-top border-b border-slate-100">
                        {lajuBadge}
                      </td>

                      {/* 6. Actions: Primary Button [⚙️ Atur Silabus] */}
                      <td className="px-4 py-3 align-top text-right border-b border-slate-100">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingScopePkgKey(pkg.key)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Atur Buku Acuan & Rentang Bab"
                          >
                            <Settings className="w-5 h-5 text-indigo-600" />
                          </button>

                          {onNavigateToJournal && (
                            <button
                              type="button"
                              onClick={() => onNavigateToJournal(pkg.subject.id, pkg.classObj.id)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Buka Jurnal &amp; Kalender Pertemuan"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination Controls */}
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan <span className="font-bold text-slate-800">{filteredPackages.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, filteredPackages.length)}</span> dari <span className="font-bold text-slate-800">{filteredPackages.length}</span> paket
              {onlyScheduled && (
                <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full ml-1.5 font-semibold border border-indigo-200/80">
                  Hanya KBM Aktif
                </span>
              )}
            </span>

            {/* Page size selector */}
            <div className="flex items-center gap-1 ml-2 text-[11px]">
              <span className="text-slate-400">Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Pagination buttons */}
          {totalPagesCount > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 px-2 text-xs font-semibold text-slate-700">
                <span>Halaman</span>
                <span className="bg-white px-2 py-0.5 border border-slate-200 rounded text-indigo-700 font-bold">
                  {safeCurrentPage}
                </span>
                <span className="text-slate-400">dari {totalPagesCount}</span>
              </div>

              <button
                type="button"
                disabled={safeCurrentPage >= totalPagesCount}
                onClick={() => setCurrentPage((p) => Math.min(totalPagesCount, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Scope Editor Modal */}
      {targetModalPkg && (
        <SyllabusScopeModal
          isOpen={Boolean(targetModalPkg)}
          onClose={() => setEditingScopePkgKey(null)}
          subject={targetModalPkg.subject}
          classObj={targetModalPkg.classObj}
          totalMeetings={targetModalPkg.totalMeetings}
          existingScope={targetModalPkg.existingScope}
          allBooks={db.books || []}
          allUnits={db.syllabusUnits || []}
          isAdmin={isAdmin}
          onSaveScope={(newScope) =>
            handleSaveScopeFromModal(
              targetModalPkg.subject.id,
              targetModalPkg.classObj.id,
              newScope
            )
          }
        />
      )}
    </div>
  );
};
