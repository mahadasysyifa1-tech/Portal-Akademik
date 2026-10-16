import React, { useState, useMemo, useEffect } from 'react';
import {
  Subject,
  ClassEntity,
  Book,
  SyllabusUnit,
  SyllabusScope,
  SyllabusScopeItem
} from '../../types';
import {
  BookOpen,
  Calendar,
  AlertCircle,
  RotateCcw,
  X,
  BookMarked,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  Layers,
  Sparkles,
  Info,
  Scissors,
  SlidersHorizontal,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatUnitDisplay } from '../../utils/pacingEngine';

export interface SyllabusScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject;
  classObj: ClassEntity;
  totalMeetings: number;
  existingScope: SyllabusScope | undefined;
  allBooks: Book[];
  allUnits: SyllabusUnit[];
  isAdmin?: boolean;
  onSaveScope: (newScope: SyllabusScope | null) => void;
}

interface BookRangeConfig {
  mode: 'all' | 'custom';
  ranges: Array<{
    id: string;
    startUnitId: string;
    endUnitId: string;
  }>;
}

export const SyllabusScopeModal: React.FC<SyllabusScopeModalProps> = ({
  isOpen,
  onClose,
  subject,
  classObj,
  totalMeetings,
  existingScope,
  allBooks,
  allUnits,
  isAdmin = true,
  onSaveScope
}) => {
  const defaultBookId = subject.default_book || subject.defaultBookId || subject.primary_book_code;

  // 1. Initial Selected Books
  const initialBookIds = useMemo<string[]>(() => {
    if (existingScope?.book_ids && existingScope.book_ids.length > 0) {
      return [...existingScope.book_ids];
    }
    if (existingScope?.book_id) {
      return [existingScope.book_id];
    }
    if (defaultBookId) {
      return [defaultBookId];
    }
    const firstMatchingBook = allBooks.find((b) => b.defaultSubjectId === subject.id);
    if (firstMatchingBook) {
      return [firstMatchingBook.id];
    }
    return allBooks[0] ? [allBooks[0].id] : [];
  }, [existingScope, defaultBookId, subject.id, allBooks]);

  const [selectedBookIds, setSelectedBookIds] = useState<string[]>(initialBookIds);

  // Group materials by bookId
  const unitsByBook = useMemo(() => {
    const map = new Map<string, SyllabusUnit[]>();
    for (const b of allBooks) {
      map.set(b.id, []);
    }
    for (const u of allUnits) {
      const bId = u.bookId || defaultBookId || `bk-${subject.id}`;
      const list = map.get(bId) || [];
      list.push(u);
      map.set(bId, list);
    }
    // Sort each book's units by order
    for (const [bId, list] of map.entries()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return map;
  }, [allBooks, allUnits, defaultBookId, subject.id]);

  // 2. Initial Ranges for each book
  const initialBookRanges = useMemo<Record<string, BookRangeConfig>>(() => {
    const configs: Record<string, BookRangeConfig> = {};

    // Check if existingScope has items
    const scopeItems = existingScope?.items || [];

    for (const bId of initialBookIds) {
      const bUnits = unitsByBook.get(bId) || [];
      const itemsForBook = scopeItems.filter(
        (it) => (it.bookId || existingScope?.book_id || defaultBookId) === bId
      );

      if (itemsForBook.length > 0) {
        configs[bId] = {
          mode: 'custom',
          ranges: itemsForBook.map((it, idx) => ({
            id: it.id || `range-${bId}-${idx + 1}`,
            startUnitId: it.startMaterialId || bUnits[0]?.id || '',
            endUnitId: it.endMaterialId || bUnits[bUnits.length - 1]?.id || ''
          }))
        };
      } else if (
        existingScope &&
        (existingScope.start_unit_id || existingScope.end_unit_id) &&
        bId === (existingScope.book_id || initialBookIds[0])
      ) {
        // Legacy single start/end range
        configs[bId] = {
          mode: 'custom',
          ranges: [
            {
              id: `range-${bId}-1`,
              startUnitId: existingScope.start_unit_id || bUnits[0]?.id || '',
              endUnitId: existingScope.end_unit_id || bUnits[bUnits.length - 1]?.id || ''
            }
          ]
        };
      } else {
        // Default to all units of book
        configs[bId] = {
          mode: 'all',
          ranges: [
            {
              id: `range-${bId}-1`,
              startUnitId: bUnits[0]?.id || '',
              endUnitId: bUnits[bUnits.length - 1]?.id || ''
            }
          ]
        };
      }
    }

    return configs;
  }, [existingScope, initialBookIds, unitsByBook, defaultBookId]);

  const [bookRanges, setBookRanges] = useState<Record<string, BookRangeConfig>>(initialBookRanges);

  // Macro adjustment & Pacing strategy state
  const [strategy, setStrategy] = useState<'accelerate' | 'cut'>(() => existingScope?.adjustment?.strategy || 'accelerate');
  const [cutUnitIds, setCutUnitIds] = useState<string[]>(() => existingScope?.adjustment?.cutUnitIds || []);
  const [showMacroAdjustment, setShowMacroAdjustment] = useState<boolean>(Boolean(existingScope?.adjustment));

  // Synchronize state when modal opens or target subject/class changes
  useEffect(() => {
    setSelectedBookIds(initialBookIds);
    setBookRanges(initialBookRanges);
    setStrategy(existingScope?.adjustment?.strategy || 'accelerate');
    setCutUnitIds(existingScope?.adjustment?.cutUnitIds || []);
    setShowMacroAdjustment(Boolean(existingScope?.adjustment));
  }, [initialBookIds, initialBookRanges, existingScope]);

  // Book Map for quick lookup
  const bookMap = useMemo(() => new Map<string, Book>(allBooks.map((b) => [b.id, b])), [allBooks]);

  if (!isOpen) return null;

  // Available books to add
  const availableToAddBooks = allBooks.filter((b) => !selectedBookIds.includes(b.id));

  // --- Multi-Book & Scope Handlers ---
  const handleAddScope = () => {
    if (availableToAddBooks.length === 0) return;
    const nextBook = availableToAddBooks[0];
    const bId = nextBook.id;
    setSelectedBookIds((prev) => [...prev, bId]);

    const bUnits = unitsByBook.get(bId) || [];
    setBookRanges((prev) => ({
      ...prev,
      [bId]: {
        mode: 'all',
        ranges: [
          {
            id: `range-${bId}-${Date.now()}`,
            startUnitId: bUnits[0]?.id || '',
            endUnitId: bUnits[bUnits.length - 1]?.id || ''
          }
        ]
      }
    }));
  };

  const handleSwitchBook = (index: number, newBookId: string) => {
    if (!newBookId || newBookId === selectedBookIds[index]) return;
    const next = [...selectedBookIds];
    next[index] = newBookId;
    setSelectedBookIds(next);

    if (!bookRanges[newBookId]) {
      const bUnits = unitsByBook.get(newBookId) || [];
      setBookRanges((prev) => ({
        ...prev,
        [newBookId]: {
          mode: 'all',
          ranges: [
            {
              id: `range-${newBookId}-${Date.now()}`,
              startUnitId: bUnits[0]?.id || '',
              endUnitId: bUnits[bUnits.length - 1]?.id || ''
            }
          ]
        }
      }));
    }
  };

  const handleRemoveBook = (bookId: string) => {
    setSelectedBookIds((prev) => prev.filter((id) => id !== bookId));
  };

  const handleMoveBook = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedBookIds.length) return;
    const next = [...selectedBookIds];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setSelectedBookIds(next);
  };

  const handleSetOnlyDefaultBook = () => {
    if (!defaultBookId) return;
    setSelectedBookIds([defaultBookId]);
    const bUnits = unitsByBook.get(defaultBookId) || [];
    setBookRanges({
      [defaultBookId]: {
        mode: 'all',
        ranges: [
          {
            id: `range-${defaultBookId}-1`,
            startUnitId: bUnits[0]?.id || '',
            endUnitId: bUnits[bUnits.length - 1]?.id || ''
          }
        ]
      }
    });
  };

  // --- Multi-Range Handlers per Book ---
  const handleToggleBookMode = (bookId: string, mode: 'all' | 'custom') => {
    const bUnits = unitsByBook.get(bookId) || [];
    setBookRanges((prev) => {
      const current = prev[bookId];
      if (mode === 'all') {
        return {
          ...prev,
          [bookId]: {
            mode: 'all',
            ranges: [
              {
                id: current?.ranges[0]?.id || `range-${bookId}-1`,
                startUnitId: bUnits[0]?.id || '',
                endUnitId: bUnits[bUnits.length - 1]?.id || ''
              }
            ]
          }
        };
      }
      return {
        ...prev,
        [bookId]: {
          mode: 'custom',
          ranges:
            current?.ranges && current.ranges.length > 0
              ? current.ranges
              : [
                  {
                    id: `range-${bookId}-1`,
                    startUnitId: bUnits[0]?.id || '',
                    endUnitId: bUnits[bUnits.length - 1]?.id || ''
                  }
                ]
        }
      };
    });
  };

  const handleAddRangeToBook = (bookId: string) => {
    const bUnits = unitsByBook.get(bookId) || [];
    if (bUnits.length === 0) return;

    setBookRanges((prev) => {
      const current = prev[bookId] || { mode: 'custom', ranges: [] };
      const lastRange = current.ranges[current.ranges.length - 1];

      // Find an intelligent next start unit
      let nextStartIdx = 0;
      if (lastRange && lastRange.endUnitId) {
        const lastEndIdx = bUnits.findIndex((u) => u.id === lastRange.endUnitId);
        if (lastEndIdx !== -1 && lastEndIdx + 1 < bUnits.length) {
          nextStartIdx = lastEndIdx + 1;
        }
      }

      const newRange = {
        id: `range-${bookId}-${Date.now()}-${current.ranges.length + 1}`,
        startUnitId: bUnits[nextStartIdx]?.id || bUnits[0].id,
        endUnitId: bUnits[bUnits.length - 1].id
      };

      return {
        ...prev,
        [bookId]: {
          mode: 'custom',
          ranges: [...current.ranges, newRange]
        }
      };
    });
  };

  const handleRemoveRangeFromBook = (bookId: string, rangeId: string) => {
    setBookRanges((prev) => {
      const current = prev[bookId];
      if (!current) return prev;
      const updatedRanges = current.ranges.filter((r) => r.id !== rangeId);
      return {
        ...prev,
        [bookId]: {
          ...current,
          ranges: updatedRanges
        }
      };
    });
  };

  const handleUpdateRangeBound = (
    bookId: string,
    rangeId: string,
    bound: 'start' | 'end',
    unitId: string
  ) => {
    const bUnits = unitsByBook.get(bookId) || [];
    setBookRanges((prev) => {
      const current = prev[bookId];
      if (!current) return prev;

      const updatedRanges = current.ranges.map((r) => {
        if (r.id !== rangeId) return r;

        let nextStartId = bound === 'start' ? unitId : r.startUnitId;
        let nextEndId = bound === 'end' ? unitId : r.endUnitId;

        // Auto-correct if start is positioned after end
        const sIdx = bUnits.findIndex((u) => u.id === nextStartId);
        const eIdx = bUnits.findIndex((u) => u.id === nextEndId);

        if (sIdx !== -1 && eIdx !== -1 && sIdx > eIdx) {
          if (bound === 'start') {
            nextEndId = nextStartId;
          } else {
            nextStartId = nextEndId;
          }
        }

        return {
          ...r,
          startUnitId: nextStartId,
          endUnitId: nextEndId
        };
      });

      return {
        ...prev,
        [bookId]: {
          ...current,
          ranges: updatedRanges
        }
      };
    });
  };

  // --- Real-time Live Pacing & Scope Calculation ---
  const activeScopedUnits = useMemo<SyllabusUnit[]>(() => {
    const result: SyllabusUnit[] = [];
    const seenIds = new Set<string>();

    for (const bId of selectedBookIds) {
      const bUnits = unitsByBook.get(bId) || [];
      if (bUnits.length === 0) continue;

      const config = bookRanges[bId];
      if (!config || config.mode === 'all') {
        for (const u of bUnits) {
          if (!seenIds.has(u.id)) {
            seenIds.add(u.id);
            result.push(u);
          }
        }
      } else {
        // Multi-range slicing
        for (const r of config.ranges) {
          let sIdx = 0;
          let eIdx = bUnits.length - 1;
          if (r.startUnitId) {
            const found = bUnits.findIndex((u) => u.id === r.startUnitId);
            if (found !== -1) sIdx = found;
          }
          if (r.endUnitId) {
            const found = bUnits.findIndex((u) => u.id === r.endUnitId);
            if (found !== -1) eIdx = found;
          }
          if (sIdx > eIdx) [sIdx, eIdx] = [eIdx, sIdx];

          for (const u of bUnits.slice(sIdx, eIdx + 1)) {
            if (!seenIds.has(u.id)) {
              seenIds.add(u.id);
              result.push(u);
            }
          }
        }
      }
    }

    return result;
  }, [selectedBookIds, unitsByBook, bookRanges]);

  // Calculate pages dynamically: page_end - page_start + 1
  const liveTotalPages = useMemo(() => {
    return activeScopedUnits.reduce((acc, u) => {
      const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
      const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
      if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
        return acc + (pEnd - pStart + 1);
      }
      return acc + 1;
    }, 0);
  }, [activeScopedUnits]);

  const liveTotalChapters = activeScopedUnits.length;
  const liveLaju = totalMeetings > 0 && liveTotalPages > 0 ? liveTotalPages / totalMeetings : null;

  // Laju badge metrics
  let lajuLevel = 2;
  let lajuLabel = 'Wajar';
  let lajuColor = 'emerald';
  if (liveLaju !== null) {
    if (liveLaju > 10) {
      lajuLevel = 4;
      lajuLabel = 'Berat';
      lajuColor = 'rose';
    } else if (liveLaju > 5) {
      lajuLevel = 3;
      lajuLabel = 'Cepat';
      lajuColor = 'amber';
    } else if (liveLaju < 2) {
      lajuLevel = 1;
      lajuLabel = 'Ringan';
      lajuColor = 'sky';
    }
  }

  // --- Save / Reset Actions ---
  const handleSave = () => {
    const scopeId = existingScope?.id || `scope-${subject.id}-${classObj.id}`;
    const items: SyllabusScopeItem[] = [];
    let sortOrder = 1;

    for (const bId of selectedBookIds) {
      const bUnits = unitsByBook.get(bId) || [];
      if (bUnits.length === 0) continue;

      const config = bookRanges[bId];
      if (!config || config.mode === 'all') {
        items.push({
          id: `${scopeId}-item-${sortOrder}`,
          scopeId,
          bookId: bId,
          startMaterialId: bUnits[0]?.id || '',
          endMaterialId: bUnits[bUnits.length - 1]?.id || '',
          sortOrder: sortOrder++
        });
      } else {
        for (const r of config.ranges) {
          if (!r.startUnitId || !r.endUnitId) continue;
          items.push({
            id: `${scopeId}-item-${sortOrder}`,
            scopeId,
            bookId: bId,
            startMaterialId: r.startUnitId,
            endMaterialId: r.endUnitId,
            sortOrder: sortOrder++
          });
        }
      }
    }

    const firstItem = items[0];
    const lastItem = items[items.length - 1];

    const adjustment = existingScope?.adjustment
      ? {
          ...existingScope.adjustment,
          strategy,
          cutUnitIds: strategy === 'cut' ? cutUnitIds : []
        }
      : cutUnitIds.length > 0 || strategy === 'cut'
      ? {
          checkpointSessionIndex: 1,
          checkpointUnitId: firstItem?.startMaterialId || '',
          checkpointPage: 1,
          strategy,
          cutUnitIds: strategy === 'cut' ? cutUnitIds : []
        }
      : undefined;

    const newScope: SyllabusScope = {
      id: scopeId,
      subject_id: subject.id,
      class_section_id: classObj.id,
      book_ids: selectedBookIds,
      book_id: selectedBookIds[0] || undefined,
      start_unit_id: firstItem?.startMaterialId || '',
      end_unit_id: lastItem?.endMaterialId || '',
      items,
      adjustment
    };

    onSaveScope(newScope);
    onClose();
  };

  const handleResetToDefault = () => {
    // Calling onSaveScope(null) deletes the custom scope override
    onSaveScope(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* 1. Modal Header */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-xs"
              style={{ backgroundColor: subject.color || '#4f46e5' }}
            >
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  <span>Silabus</span>
                </h3>
                <span className="font-bold text-white px-1.5 py-0.2 rounded" style={{ backgroundColor: subject.color || '#4f46e5' }}>
                  {subject.name}
                </span>
                <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                  {classObj.name}
                </span>
                <span className="font-mono text-[11px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                  {subject.code || subject.id}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                <span className={`inline-flex items-center gap-1 font-semibold ${
                  totalMeetings > 0 ? 'text-slate-700' : 'text-rose-600'
                }`}>
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {totalMeetings > 0 ? totalMeetings : 'Tidak ada'} Pertemuan
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Top Live Pacing & Intensity Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Total Books */}
            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200/90 shadow-2xs">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-slate-900">{selectedBookIds.length}</span>
                <span className="text-[11px] text-slate-500">Scope</span>
              </div>
            </div>

            {/* Total Chapters */}
            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200/90 shadow-2xs">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-slate-900">{liveTotalChapters}</span>
                <span className="text-[11px] text-slate-500">Bab</span>
              </div>
            </div>

            {/* Total Pages */}
            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200/90 shadow-2xs">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-indigo-700">{liveTotalPages}</span>
                <span className="text-[11px] text-slate-500">Hal</span>
              </div>
            </div>

            {/* Live Pacing Meter */}
            <div className={`px-3 py-1.5 rounded-lg border shadow-2xs ${
              lajuColor === 'emerald'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : lajuColor === 'amber'
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : lajuColor === 'rose'
                ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                : 'bg-sky-50/70 border-sky-200 text-sky-950'
            }`}>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold">
                  {liveLaju !== null ? liveLaju.toFixed(1) : '—'}
                </span>
                <span className="text-[11px] opacity-80">hal / sesi</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.1 rounded-full uppercase ${
                  lajuColor === 'emerald'
                    ? 'bg-emerald-200/80 text-emerald-900'
                    : lajuColor === 'amber'
                    ? 'bg-amber-200/80 text-amber-900'
                    : lajuColor === 'rose'
                    ? 'bg-rose-200/80 text-rose-900'
                    : 'bg-sky-200/80 text-sky-900'
                }`}>
                  {liveLaju !== null ? lajuLabel : 'Kosong'}
                </span>

              </div>
            </div>
          </div>

        </div>

        {/* 3. Main Modal Body (Scrollable) */}
        <div className="p-4 overflow-y-auto flex-1 text-xs">
          {/* Merged Scope Section: Unified Book-Ranges Cards */}
          <div className="space-y-3">

            {/* List of Scope Cards */}
            {selectedBookIds.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
                <BookMarked className="w-6 h-6 text-slate-400 mx-auto" />
                <div className="space-y-0.5">
                  <h5 className="font-bold text-slate-700 text-xs">Belum Ada Cakupan Buku yang Ditambahkan</h5>
                  <p className="text-[11px] text-slate-500">
                    Klik tombol "+ Tambah Scope" untuk menambahkan buku dan rentang bab.
                  </p>
                </div>
                {isAdmin && availableToAddBooks.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddScope}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Scope Sekarang</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedBookIds.map((bId, idx) => {
                  const b = bookMap.get(bId);
                  const isDefault = bId === defaultBookId;
                  const bUnits = unitsByBook.get(bId) || [];
                  const config = bookRanges[bId] || { mode: 'all', ranges: [] };

                  // Calculate total pages for this specific card
                  let cardPages = 0;
                  if (config.mode === 'all') {
                    cardPages = bUnits.reduce((acc, u) => {
                      const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
                      const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
                      if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
                        return acc + (pEnd - pStart + 1);
                      }
                      return acc + 1;
                    }, 0);
                  } else {
                    for (const r of config.ranges) {
                      const sIdx = bUnits.findIndex((u) => u.id === r.startUnitId);
                      const eIdx = bUnits.findIndex((u) => u.id === r.endUnitId);
                      if (sIdx !== -1 && eIdx !== -1) {
                        const minI = Math.min(sIdx, eIdx);
                        const maxI = Math.max(sIdx, eIdx);
                        for (let i = minI; i <= maxI; i++) {
                          const u = bUnits[i];
                          const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
                          const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
                          if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
                            cardPages += (pEnd - pStart + 1);
                          } else {
                            cardPages += 1;
                          }
                        }
                      }
                    }
                  }

                  return (
                    <div
                      key={`${bId}-${idx}`}
                      className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all hover:border-slate-300"
                    >
                      {/* Slim Single-Line Card Header */}
                      <div className="bg-amber-50/90 border-b border-amber-200 px-3 py-2 flex items-center justify-between gap-2">
                        {/* Left: Order badge + Book selector + Info badges */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Order Indicator */}
                          <span
                            className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200 font-bold text-indigo-700 text-[12px] flex items-center justify-center shrink-0 shadow-2xs"
                            title={`Urutan ke-${idx + 1}`}
                          >
                            #{idx + 1}
                          </span>

                          {/* Book Selector / Title */}
                          {allBooks.length > 1 ? (
                            <select
                              value={bId}
                              disabled={!isAdmin}
                              onChange={(e) => handleSwitchBook(idx, e.target.value)}
                              className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs max-w-[180px] sm:max-w-[260px] truncate"
                            >
                              {allBooks.map((bookOption) => {
                                const isSelectedElsewhere =
                                  selectedBookIds.includes(bookOption.id) && bookOption.id !== bId;
                                return (
                                  <option
                                    key={bookOption.id}
                                    value={bookOption.id}
                                    disabled={isSelectedElsewhere}
                                  >
                                    {bookOption.title}{' '}
                                    {bookOption.edition ? `(${bookOption.edition})` : ''}{' '}
                                    {bookOption.id === defaultBookId ? '⭐ [Default]' : ''}
                                    {isSelectedElsewhere ? ' (Sudah dipilih)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]">
                              {b?.title || bId}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 hidden sm:inline">
                            ({bUnits.length} Bab)
                          </span>
                          <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.2 rounded border border-indigo-100">
                            Total: {cardPages} Hal
                          </span>
                        </div>

                        {/* Right: Compact Mode Switch + Move Up / Move Down / Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Mode Toggle: Single Toggle (On: All / Off: Custom) */}
                          <div className="flex items-center shrink-0">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={config.mode === 'all'}
                              disabled={!isAdmin}
                              onClick={() => handleToggleBookMode(bId, config.mode === 'all' ? 'custom' : 'all')}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group select-none"
                              title={
                                config.mode === 'all'
                                  ? 'Mode Cakupan: Semua Bab (Aktif) — Klik untuk atur Kustom'
                                  : 'Mode Cakupan: Kustom (Nonaktif) — Klik untuk Semua Bab'
                              }
                            >
                              <span
                                className={`text-[11px] transition-colors ${
                                  config.mode === 'all' ? 'text-indigo-700 font-bold' : 'text-slate-500 font-medium'
                                }`}
                              >
                                {config.mode === 'all' ? 'Semua Bab' : 'Kustom'}
                              </span>
                              <span
                                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
                                  config.mode === 'all' ? 'bg-indigo-600' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                                    config.mode === 'all' ? 'translate-x-3.5' : 'translate-x-0.5'
                                  }`}
                                />
                              </span>
                            </button>
                          </div>

                          <div className="h-3.5 w-px bg-slate-300 mx-0.5 hidden sm:block" />

                          {/* Sorting controls between cards */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0 || !isAdmin}
                              onClick={() => handleMoveBook(idx, 'up')}
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-200/70 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                              title="Geser Kartu ke Atas"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === selectedBookIds.length - 1 || !isAdmin}
                              onClick={() => handleMoveBook(idx, 'down')}
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-200/70 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                              title="Geser Kartu ke Bawah"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Remove Card button */}
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => handleRemoveBook(bId)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0"
                            title="Hapus Scope Kartu Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Slim Card Body */}
                      <div className="p-2.5 space-y-2">
                        {bUnits.length === 0 ? (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Buku ini belum memiliki materi/bab terdaftar di database.</span>
                          </div>
                        ) : config.mode === 'all' ? (
                          <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50/60 border border-indigo-100/80 rounded-lg text-xs text-indigo-950">
                            <div className="flex items-center gap-2 min-w-0">
                              <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="truncate">
                                Seluruh isi buku: <strong>Bab {bUnits[0]?.order || 1} s/d {bUnits[bUnits.length - 1]?.order || bUnits.length}</strong>
                              </span>
                            </div>
                            <span className="font-bold text-indigo-800 bg-white px-2 py-0.5 rounded border border-indigo-200 shadow-2xs shrink-0 text-[11px]">
                              {bUnits.length} Bab • {cardPages} Hal
                            </span>
                          </div>
                        ) : (
                          /* Custom Multi-Range Section - Clean Inline Rows */
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                            </div>

                            <div className="space-y-1.5">
                              {config.ranges.map((r, rIdx) => {
                                // Calculate page range for this specific range
                                let rangePages = 0;
                                const sIdx = bUnits.findIndex((u) => u.id === r.startUnitId);
                                const eIdx = bUnits.findIndex((u) => u.id === r.endUnitId);
                                if (sIdx !== -1 && eIdx !== -1 && sIdx <= eIdx) {
                                  for (let i = sIdx; i <= eIdx; i++) {
                                    const u = bUnits[i];
                                    const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
                                    const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
                                    if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
                                      rangePages += (pEnd - pStart + 1);
                                    } else {
                                      rangePages += 1;
                                    }
                                  }
                                }

                                return (
                                  <div
                                    key={r.id}
                                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                                  >
                                    {/* Range Indicator */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="w-5 h-5 rounded-md bg-slate-200/80 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                                        R{rIdx + 1}
                                      </span>
                                    </div>

                                    {/* Selectors: Start and End units inline */}
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <select
                                        value={r.startUnitId}
                                        disabled={!isAdmin}
                                        onChange={(e) =>
                                          handleUpdateRangeBound(bId, r.id, 'start', e.target.value)
                                        }
                                        className="flex-1 min-w-0 text-xs py-1 px-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate shadow-2xs"
                                        title="Mulai dari Bab"
                                      >
                                        {bUnits.map((u) => (
                                          <option key={u.id} value={u.id}>
                                            Bab {u.order}: {formatUnitDisplay(u)} {u.page_start ? (String(u.page_start) === String(u.page_end) ? `(Hal ${u.page_start})` : `(Hal ${u.page_start}–${u.page_end})`) : ''}
                                          </option>
                                        ))}
                                      </select>

                                      <span className="text-slate-400 font-semibold text-xs shrink-0">s/d</span>

                                      <select
                                        value={r.endUnitId}
                                        disabled={!isAdmin}
                                        onChange={(e) =>
                                          handleUpdateRangeBound(bId, r.id, 'end', e.target.value)
                                        }
                                        className="flex-1 min-w-0 text-xs py-1 px-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate shadow-2xs"
                                        title="Hingga Bab"
                                      >
                                        {bUnits.map((u) => (
                                          <option key={u.id} value={u.id}>
                                            Bab {u.order}: {formatUnitDisplay(u)} {u.page_start ? (String(u.page_start) === String(u.page_end) ? `(Hal ${u.page_start})` : `(Hal ${u.page_start}–${u.page_end})`) : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Right: Page count pill + buttons */}
                                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                      <span className="text-[11px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                                        {rangePages} Hal
                                      </span>
                                      {/* Delete Range button */}
                                      {config.ranges.length > 1 && isAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveRangeFromBook(bId, r.id)}
                                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                          title="Hapus Rentang Bab Ini"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {/* Add Another Range Button */}
                                      {isAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => handleAddRangeToBook(bId)}
                                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                        </button>
                                        )}

                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Bottom Add Scope Action */}
                {isAdmin && availableToAddBooks.length > 0 && (
                  <div className="pt-1 flex justify-center">
                    <button
                      type="button"
                      onClick={handleAddScope}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 font-medium text-xs transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Scope Buku Lainnya ({availableToAddBooks.length} buku tersedia)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Macro Curriculum Adjustment Section (Opsi Penyesuaian Makro Silabus) */}
            <div className="pt-2 border-t border-slate-200">
              <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-3.5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">
                        Penyesuaian Makro Silabus &amp; Strategi Laju
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        Pengaturan strategi adaptif laju kurikulum dan pemangkasan bab
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMacroAdjustment(!showMacroAdjustment)}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>{showMacroAdjustment ? 'Sembunyikan' : 'Konfigurasi'}</span>
                    {showMacroAdjustment ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {existingScope?.adjustment && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        Sesi #{existingScope.adjustment.checkpointSessionIndex} terkalibrasi ke Hal. {existingScope.adjustment.checkpointPage}
                        {existingScope.adjustment.strategy === 'cut' && ` (${(existingScope.adjustment.cutUnitIds || []).length} bab dipangkas)`}
                      </span>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setCutUnitIds([]);
                          setStrategy('accelerate');
                          if (existingScope) {
                            const updated = { ...existingScope };
                            delete updated.adjustment;
                            onSaveScope(updated);
                          }
                        }}
                        className="px-2 py-0.5 text-[10px] font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer"
                      >
                        Hapus Kalibrasi
                      </button>
                    )}
                  </div>
                )}

                {showMacroAdjustment && (
                  <div className="space-y-3 pt-1 border-t border-slate-200/60">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                        Strategi Adaptasi Kurikulum:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          strategy === 'accelerate'
                            ? 'border-indigo-500 bg-indigo-50/50 text-indigo-950 font-semibold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}>
                          <input
                            type="radio"
                            name="pacing-strategy"
                            checked={strategy === 'accelerate'}
                            onChange={() => setStrategy('accelerate')}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="font-bold">Akselerasi / Kejar Materi</div>
                            <div className="text-[11px] text-slate-500 font-normal">
                              Tetap membahas semua bab dengan meningkatkan kecepatan (hal/sesi)
                            </div>
                          </div>
                        </label>

                        <label className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          strategy === 'cut'
                            ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-semibold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}>
                          <input
                            type="radio"
                            name="pacing-strategy"
                            checked={strategy === 'cut'}
                            onChange={() => setStrategy('cut')}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="font-bold flex items-center gap-1">
                              <Scissors className="w-3.5 h-3.5 text-amber-600" />
                              <span>Pemangkasan Bab Terpilih</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-normal">
                              Melewati bab-bab tertentu agar target tercapai tanpa membebani santri
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {strategy === 'cut' && (
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-slate-700">
                          Pilih Bab yang Dipangkas / Dilewati:
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1 bg-white p-2 rounded-xl border border-slate-200">
                          {allUnits
                            .filter((u) => u.subject_id === subject.id || !u.subject_id)
                            .map((u) => {
                            const isChecked = cutUnitIds.includes(u.id);
                            return (
                              <label
                                key={u.id}
                                className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                  isChecked ? 'bg-amber-50 text-amber-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setCutUnitIds((prev) => [...prev, u.id]);
                                    } else {
                                      setCutUnitIds((prev) => prev.filter((id) => id !== u.id));
                                    }
                                  }}
                                />
                                <span className="truncate">
                                  Bab {u.order}: {formatUnitDisplay(u)} {u.page_start ? `(Hal ${u.page_start}–${u.page_end || '...'})` : ''}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Modal Footer Actions */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div>
            {existingScope && isAdmin && (
              <button
                type="button"
                onClick={handleResetToDefault}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-amber-700 hover:bg-amber-50 px-3 py-2 rounded-xl border border-slate-300 transition-colors cursor-pointer w-full sm:w-auto justify-center"
                title="Hapus kustomisasi scope ini dan kembalikan ke default penuh buku acuan mapel"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ke Default</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!isAdmin || selectedBookIds.length === 0}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Silabus</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
