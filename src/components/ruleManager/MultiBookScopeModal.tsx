import React, { useState, useMemo } from 'react';
import {
  DatabaseState,
  SyllabusScope,
  SyllabusScopeItem,
  SyllabusUnit,
  Book,
  Subject,
  ClassEntity
} from '../../types';
import {
  BookOpen,
  BookMarked,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  RotateCcw,
  Check,
  Layers,
  AlertCircle,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { formatUnitDisplay } from '../../utils/pacingEngine';

export interface MultiBookScopeModalProps {
  subject: Subject;
  classObj: ClassEntity;
  totalMeetings: number;
  existingScope?: SyllabusScope;
  db: DatabaseState;
  onClose: () => void;
  onSaveScope: (newScope: SyllabusScope) => void;
  onResetScope: () => void;
}

interface LocalRangeItem {
  id: string;
  bookId: string;
  startMaterialId: string;
  endMaterialId: string;
}

export const MultiBookScopeModal: React.FC<MultiBookScopeModalProps> = ({
  subject,
  classObj,
  totalMeetings,
  existingScope,
  db,
  onClose,
  onSaveScope,
  onResetScope
}) => {
  const allBooks = useMemo(() => db.books || [], [db.books]);
  const bookMap = useMemo(() => new Map(allBooks.map((b) => [b.id, b])), [allBooks]);
  const allUnits = useMemo(() => db.syllabusUnits || [], [db.syllabusUnits]);

  // Determine initial books in scope
  const initialBookIds = useMemo<string[]>(() => {
    if (existingScope?.book_ids && existingScope.book_ids.length > 0) {
      return [...existingScope.book_ids];
    }
    if (existingScope?.book_id) {
      return [existingScope.book_id];
    }
    const defBook = subject.default_book || subject.defaultBookId || allBooks[0]?.id;
    return defBook ? [defBook] : [];
  }, [existingScope, subject, allBooks]);

  const [selectedBookIds, setSelectedBookIds] = useState<string[]>(initialBookIds);

  // Determine initial ranges per book
  const initialRanges = useMemo<LocalRangeItem[]>(() => {
    if (existingScope?.items && existingScope.items.length > 0) {
      return existingScope.items.map((it, idx) => ({
        id: it.id || `rng-${idx + 1}`,
        bookId: it.bookId || initialBookIds[0] || '',
        startMaterialId: it.startMaterialId || '',
        endMaterialId: it.endMaterialId || ''
      }));
    }

    if (existingScope && (existingScope.start_unit_id || existingScope.end_unit_id)) {
      const bId = initialBookIds[0] || '';
      return [
        {
          id: 'rng-1',
          bookId: bId,
          startMaterialId: existingScope.start_unit_id || '',
          endMaterialId: existingScope.end_unit_id || ''
        }
      ];
    }

    // Default: 1 full range per selected book
    const ranges: LocalRangeItem[] = [];
    for (const bId of initialBookIds) {
      const bUnits = allUnits
        .filter((u) => u.bookId === bId)
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      ranges.push({
        id: `rng-${bId}-1`,
        bookId: bId,
        startMaterialId: bUnits[0]?.id || '',
        endMaterialId: bUnits[bUnits.length - 1]?.id || ''
      });
    }
    return ranges;
  }, [existingScope, initialBookIds, allUnits]);

  const [bookRanges, setBookRanges] = useState<LocalRangeItem[]>(initialRanges);
  const [selectedNewBookId, setSelectedNewBookId] = useState<string>('');

  // Units grouped by book
  const unitsByBook = useMemo(() => {
    const map = new Map<string, SyllabusUnit[]>();
    for (const u of allUnits) {
      if (!u.bookId) continue;
      const list = map.get(u.bookId) || [];
      list.push(u);
      map.set(u.bookId, list);
    }
    for (const [bId, list] of map.entries()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return map;
  }, [allUnits]);

  // Live Pacing & Preview Calculation
  const preview = useMemo(() => {
    const resultUnits: SyllabusUnit[] = [];

    for (const bId of selectedBookIds) {
      const bUnits = unitsByBook.get(bId) || [];
      if (bUnits.length === 0) continue;

      const rangesForBook = bookRanges.filter((r) => r.bookId === bId);
      if (rangesForBook.length === 0) {
        resultUnits.push(...bUnits);
      } else {
        for (const rng of rangesForBook) {
          let sIdx = 0;
          let eIdx = bUnits.length - 1;
          if (rng.startMaterialId) {
            const found = bUnits.findIndex((u) => u.id === rng.startMaterialId);
            if (found !== -1) sIdx = found;
          }
          if (rng.endMaterialId) {
            const found = bUnits.findIndex((u) => u.id === rng.endMaterialId);
            if (found !== -1) eIdx = found;
          }
          if (sIdx > eIdx) [sIdx, eIdx] = [eIdx, sIdx];
          resultUnits.push(...bUnits.slice(sIdx, eIdx + 1));
        }
      }
    }

    // Deduplicate units
    const uniqueUnits: SyllabusUnit[] = [];
    const seenIds = new Set<string>();
    for (const u of resultUnits) {
      if (!seenIds.has(u.id)) {
        seenIds.add(u.id);
        uniqueUnits.push(u);
      }
    }

    // Dynamic page count from real page spans (page_end - page_start + 1)
    const totalPages = uniqueUnits.reduce((acc, u) => {
      const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
      const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
      if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
        return acc + (pEnd - pStart + 1);
      }
      return acc + 1;
    }, 0);

    const laju = totalMeetings > 0 && totalPages > 0 ? totalPages / totalMeetings : null;

    let intensityLabel = 'Wajar';
    let intensityBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    let intensityBar = 'bg-emerald-500';
    let intensityLevel = 2;

    if (laju !== null) {
      if (laju > 10) {
        intensityLabel = 'Berat';
        intensityBg = 'bg-rose-50 text-rose-800 border-rose-200';
        intensityBar = 'bg-rose-500';
        intensityLevel = 4;
      } else if (laju > 5) {
        intensityLabel = 'Cepat';
        intensityBg = 'bg-amber-50 text-amber-800 border-amber-200';
        intensityBar = 'bg-amber-500';
        intensityLevel = 3;
      } else if (laju < 2) {
        intensityLabel = 'Ringan';
        intensityBg = 'bg-sky-50 text-sky-800 border-sky-200';
        intensityBar = 'bg-sky-500';
        intensityLevel = 1;
      }
    }

    return {
      uniqueUnits,
      totalChapters: uniqueUnits.length,
      totalPages,
      laju,
      intensityLabel,
      intensityBg,
      intensityBar,
      intensityLevel
    };
  }, [selectedBookIds, bookRanges, unitsByBook, totalMeetings]);

  // Actions for Books
  const handleAddBook = () => {
    if (!selectedNewBookId || selectedBookIds.includes(selectedNewBookId)) return;
    const bId = selectedNewBookId;
    setSelectedBookIds((prev) => [...prev, bId]);

    const bUnits = unitsByBook.get(bId) || [];
    setBookRanges((prev) => [
      ...prev,
      {
        id: `rng-${bId}-${Date.now().toString(36)}`,
        bookId: bId,
        startMaterialId: bUnits[0]?.id || '',
        endMaterialId: bUnits[bUnits.length - 1]?.id || ''
      }
    ]);
    setSelectedNewBookId('');
  };

  const handleRemoveBook = (bId: string) => {
    setSelectedBookIds((prev) => prev.filter((id) => id !== bId));
    setBookRanges((prev) => prev.filter((r) => r.bookId !== bId));
  };

  const handleMoveBook = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= selectedBookIds.length) return;
    const next = [...selectedBookIds];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setSelectedBookIds(next);
  };

  // Actions for Ranges
  const handleAddRangeToBook = (bId: string) => {
    const bUnits = unitsByBook.get(bId) || [];
    setBookRanges((prev) => [
      ...prev,
      {
        id: `rng-${bId}-${Date.now().toString(36)}`,
        bookId: bId,
        startMaterialId: bUnits[0]?.id || '',
        endMaterialId: bUnits[bUnits.length - 1]?.id || ''
      }
    ]);
  };

  const handleUpdateRange = (
    rangeId: string,
    field: 'startMaterialId' | 'endMaterialId',
    value: string
  ) => {
    setBookRanges((prev) =>
      prev.map((r) => (r.id === rangeId ? { ...r, [field]: value } : r))
    );
  };

  const handleRemoveRange = (rangeId: string) => {
    setBookRanges((prev) => prev.filter((r) => r.id !== rangeId));
  };

  const handleSetBookFull = (bId: string) => {
    const bUnits = unitsByBook.get(bId) || [];
    setBookRanges((prev) => [
      ...prev.filter((r) => r.bookId !== bId),
      {
        id: `rng-${bId}-${Date.now().toString(36)}`,
        bookId: bId,
        startMaterialId: bUnits[0]?.id || '',
        endMaterialId: bUnits[bUnits.length - 1]?.id || ''
      }
    ]);
  };

  // Save Scope
  const handleSave = () => {
    const scopeId = existingScope?.id || `scope-${subject.id}-${classObj.id}`;
    let sortOrderCounter = 1;
    const items: SyllabusScopeItem[] = [];

    for (const bId of selectedBookIds) {
      const ranges = bookRanges.filter((r) => r.bookId === bId);
      for (const rng of ranges) {
        items.push({
          id: rng.id.startsWith('rng-') ? `item-${scopeId}-${sortOrderCounter}` : rng.id,
          scopeId,
          bookId: bId,
          startMaterialId: rng.startMaterialId || undefined,
          endMaterialId: rng.endMaterialId || undefined,
          sortOrder: sortOrderCounter++
        });
      }
    }

    const newScope: SyllabusScope = {
      id: scopeId,
      subject_id: subject.id,
      class_section_id: classObj.id,
      book_ids: selectedBookIds,
      book_id: selectedBookIds[0] || undefined,
      items,
      start_unit_id: items[0]?.startMaterialId,
      end_unit_id: items[items.length - 1]?.endMaterialId
    };

    onSaveScope(newScope);
    onClose();
  };

  const unselectedBooks = allBooks.filter((b) => !selectedBookIds.includes(b.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/70 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                style={{ backgroundColor: subject.color || '#6366f1' }}
              />
              <h3 className="text-base font-bold text-slate-900">
                Atur Silabus &amp; Cakupan Materi
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">{subject.name}</span>
              <span>•</span>
              <span className="font-semibold text-indigo-700">Kelas {classObj.name}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{totalMeetings > 0 ? `${totalMeetings} Pertemuan` : '0 Sesi Terjadwal'}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Quick Guidance Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Anda dapat menggunakan <strong>beberapa buku/kitab</strong> sekaligus, mengatur urutan pengajaran, serta membagi menjadi <strong>beberapa rentang bab</strong> untuk melompati (skip) materi yang tidak diajarkan pada semester ini.
            </div>
          </div>

          {/* Book Cards List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Buku Rujukan Terpilih ({selectedBookIds.length})</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Urutan buku menentukan alur pacing silabus
              </span>
            </div>

            {selectedBookIds.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <BookMarked className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-700">Belum ada buku yang dipilih untuk paket ini.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tambahkan buku rujukan melalui pilihan di bawah.
                </p>
              </div>
            ) : (
              selectedBookIds.map((bId, bIdx) => {
                const book = bookMap.get(bId);
                const bUnits = unitsByBook.get(bId) || [];
                const ranges = bookRanges.filter((r) => r.bookId === bId);

                return (
                  <div
                    key={bId}
                    className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden"
                  >
                    {/* Book Card Header */}
                    <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={bIdx === 0}
                            onClick={() => handleMoveBook(bIdx, 'up')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Pindah ke urutan lebih awal"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={bIdx === selectedBookIds.length - 1}
                            onClick={() => handleMoveBook(bIdx, 'down')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Pindah ke urutan setelahnya"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {book?.title || bId}
                            </span>
                            {book?.altTitle && (
                              <span className="text-[10px] text-slate-500 font-medium truncate">
                                ({book.altTitle})
                              </span>
                            )}
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700">
                              {bUnits.length} Bab Master
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetBookFull(bId)}
                          className="px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                          title="Atur mencakup seluruh bab buku ini"
                        >
                          Semua Bab
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRangeToBook(bId)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Rentang Bab</span>
                        </button>
                        {selectedBookIds.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBook(bId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus buku ini dari silabus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Book Ranges List */}
                    <div className="p-3.5 space-y-3 bg-white">
                      {bUnits.length === 0 ? (
                        <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                          Buku ini belum memiliki data materi silabus di basis data. Silakan lengkapi materi buku di tab Basis Data Materi terlebih dahulu.
                        </p>
                      ) : ranges.length === 0 ? (
                        <div className="text-center py-3 text-xs text-slate-400">
                          Belum ada rentang bab yang dipilih.{' '}
                          <button
                            type="button"
                            onClick={() => handleAddRangeToBook(bId)}
                            className="text-indigo-600 font-semibold underline cursor-pointer"
                          >
                            Klik untuk tambahkan rentang
                          </button>
                        </div>
                      ) : (
                        ranges.map((rng, rIdx) => {
                          const sUnit = bUnits.find((u) => u.id === rng.startMaterialId) || bUnits[0];
                          const eUnit = bUnits.find((u) => u.id === rng.endMaterialId) || bUnits[bUnits.length - 1];

                          let sIdx = bUnits.findIndex((u) => u.id === sUnit?.id);
                          let eIdx = bUnits.findIndex((u) => u.id === eUnit?.id);
                          if (sIdx === -1) sIdx = 0;
                          if (eIdx === -1) eIdx = bUnits.length - 1;
                          if (sIdx > eIdx) [sIdx, eIdx] = [eIdx, sIdx];

                          const sliced = bUnits.slice(sIdx, eIdx + 1);
                          const slicePages = sliced.reduce((acc, u) => {
                            const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
                            const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
                            if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
                              return acc + (pEnd - pStart + 1);
                            }
                            return acc + 1;
                          }, 0);

                          return (
                            <div
                              key={rng.id}
                              className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                    Rentang {rIdx + 1}
                                  </span>
                                  <span className="text-[11px] font-medium text-slate-600">
                                    {sliced.length} Bab • {slicePages} Halaman
                                  </span>
                                </div>
                                {ranges.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRange(rng.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                    title="Hapus rentang ini"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                    Dari Bab / Materi Awal
                                  </label>
                                  <select
                                    value={rng.startMaterialId || bUnits[0]?.id || ''}
                                    onChange={(e) => handleUpdateRange(rng.id, 'startMaterialId', e.target.value)}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                                  >
                                    {bUnits.map((u, uIdx) => (
                                      <option key={u.id} value={u.id}>
                                        {u.order || uIdx + 1}. {formatUnitDisplay(u)}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                    Sampai Bab / Materi Akhir
                                  </label>
                                  <select
                                    value={rng.endMaterialId || bUnits[bUnits.length - 1]?.id || ''}
                                    onChange={(e) => handleUpdateRange(rng.id, 'endMaterialId', e.target.value)}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                                  >
                                    {bUnits.map((u, uIdx) => (
                                      <option key={u.id} value={u.id}>
                                        {u.order || uIdx + 1}. {formatUnitDisplay(u)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Add Book Control */}
            {unselectedBooks.length > 0 && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-600 font-medium">
                  Tambahkan buku atau kitab rujukan lain ke silabus mapel ini:
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={selectedNewBookId}
                    onChange={(e) => setSelectedNewBookId(e.target.value)}
                    className="p-2 bg-white border border-slate-300 rounded-lg text-xs flex-1 sm:min-w-[240px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Pilih Buku Tambahan --</option>
                    {unselectedBooks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} {b.altTitle ? `(${b.altTitle})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedNewBookId}
                    onClick={handleAddBook}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    + Tambahkan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Live Summary & Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 shrink-0">
          {/* Live Pacing Gauge */}
          <div className="p-3 rounded-xl bg-white border border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-800">
                  Total Kurikulum Terpilih: {preview.totalChapters} Bab / Unit • {preview.totalPages} Halaman
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  Beban dibagi {totalMeetings} sesi KBM terjadwal
                </div>
              </div>
            </div>

            {totalMeetings > 0 && preview.laju !== null ? (
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <div className="flex items-center gap-1">
                  <div
                    className="flex items-center gap-0.5"
                    title={`Level ${preview.intensityLevel}/4`}
                  >
                    <div className={`w-1.5 h-3.5 rounded-xs transition-colors ${preview.intensityLevel >= 1 ? preview.intensityBar : 'bg-slate-200'}`} />
                    <div className={`w-1.5 h-3.5 rounded-xs transition-colors ${preview.intensityLevel >= 2 ? preview.intensityBar : 'bg-slate-200'}`} />
                    <div className={`w-1.5 h-3.5 rounded-xs transition-colors ${preview.intensityLevel >= 3 ? preview.intensityBar : 'bg-slate-200'}`} />
                    <div className={`w-1.5 h-3.5 rounded-xs transition-colors ${preview.intensityLevel >= 4 ? preview.intensityBar : 'bg-slate-200'}`} />
                  </div>
                  <span className={`text-xs font-bold ml-1 ${preview.intensityBar.replace('bg-', 'text-')}`}>
                    {preview.intensityLabel}
                  </span>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${preview.intensityBg}`}>
                  {preview.laju.toFixed(1)} hal / sesi
                </span>
              </div>
            ) : (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                Belum ada jam jadwal aktif
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Kembalikan cakupan ke seluruh buku default mapel ini?')) {
                  onResetScope();
                  onClose();
                }
              }}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset ke Default</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Simpan Silabus</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
