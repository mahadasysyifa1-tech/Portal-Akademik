import React from 'react';
import { BookmarkCheck, Book, ArrowRight } from 'lucide-react';
import type { SyllabusUnit } from '../../types';
import { formatUnitDisplay } from '../../utils/pacingEngine';

export interface SlotSyllabusLineProps {
  units: SyllabusUnit[];
  hasSyllabus: boolean;
  fallbackBookId?: string;
  bookMap: Map<string, any>;
  onNavigateToBooks?: (bookId?: string) => void;
  onOpenJournal?: () => void;
}

const UNIT_BADGE =
  'px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-950 border border-amber-200/80 truncate max-w-[200px] sm:max-w-[260px]';

function buildPageRangeLabel(first?: SyllabusUnit, last?: SyllabusUnit): string {
  const firstPage = first?.page_start ?? first?.page_end;
  const lastPage = last?.page_end ?? last?.page_start;

  if (firstPage !== undefined && lastPage !== undefined) {
    return firstPage !== lastPage ? `hal. ${firstPage}-${lastPage}:` : `hal. ${firstPage}:`;
  }
  if (firstPage !== undefined) return `hal. ${firstPage}:`;
  if (lastPage !== undefined) return `hal. ${lastPage}:`;
  return '';
}

function buildVolumeLabel(book: any, firstUnit?: SyllabusUnit): string {
  const chapters: any[] = book.chapters || [];
  const matchedChapter = chapters.find(
    (ch) =>
      (firstUnit?.chapterBookId && ch.id === firstUnit.chapterBookId) ||
      (firstUnit?.part && ch.chapterNumber === firstUnit.part)
  );

  if (matchedChapter) {
    const chPages = matchedChapter.pageEnd || 0;
    const chTitle = matchedChapter.title || `Jilid ${matchedChapter.chapterNumber}`;
    return chPages > 0 ? `${chTitle}: ${chPages} hal` : chTitle;
  }

  const totalJilid = chapters.length > 0 ? chapters.length : book.totalChapters || 0;
  const cumulativePages =
    chapters.length > 0
      ? chapters.reduce((sum, ch) => sum + (Number(ch.pageEnd) || 0), 0)
      : book.totalPages || 0;

  return totalJilid > 0
    ? `${totalJilid} Jilid: ${cumulativePages.toLocaleString('id-ID')} hal`
    : `${cumulativePages.toLocaleString('id-ID')} hal`;
}

export const SlotSyllabusLine: React.FC<SlotSyllabusLineProps> = ({
  units,
  hasSyllabus,
  fallbackBookId,
  bookMap,
  onNavigateToBooks,
  onOpenJournal
}) => {
  const firstUnit = units[0];
  const lastUnit = units[units.length - 1];

  const bookId = firstUnit?.bookId || fallbackBookId;
  const book = bookId ? bookMap.get(bookId) : undefined;
  const volumeLabel = book ? buildVolumeLabel(book, firstUnit) : '';
  const pageRangeLabel = buildPageRangeLabel(firstUnit, lastUnit);

  const clickable = onOpenJournal ? 'cursor-pointer hover:bg-amber-100 hover:border-amber-300' : '';
  const journalHint = onOpenJournal ? ' (Klik untuk buka Jurnal)' : '';

  return (
    <div className="flex items-center gap-1.5 text-[11px] min-w-0 flex-wrap">
      <BookmarkCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />

      {units.length === 0 ? (
        <span className="text-slate-400 italic text-[11px] truncate">
          {hasSyllabus ? 'Sesi Praktikum / Pembahasan Mandiri' : 'Belum ada data silabus'}
        </span>
      ) : (
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {book && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToBooks?.(book.id);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer shrink-0 shadow-2xs"
                title={`Kitab: ${book.title}${book.altTitle ? ` (${book.altTitle})` : ''} • Klik untuk melihat info kitab`}
              >
                <Book className="w-3 h-3 text-indigo-600 shrink-0" />
                <span className="truncate max-w-[120px] sm:max-w-[150px]">
                  {book.displayCode || book.altTitle || book.title}
                </span>
              </button>
              {volumeLabel && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0 shadow-2xs"
                  title="Volume/Bab & Jumlah Halaman"
                >
                  {volumeLabel}
                </span>
              )}
            </>
          )}

          {pageRangeLabel && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-amber-900 shrink-0">
              {firstUnit?.isPartialStart && (
                <ArrowRight
                  className="w-3 h-3 text-amber-600 shrink-0"
                  title={`Lanjutan dari sesi sebelumnya (mulai hal. ${firstUnit.page_start} dari ${firstUnit.raw_page_start}–${firstUnit.raw_page_end})`}
                />
              )}
              <span>{pageRangeLabel}</span>
              {lastUnit?.isPartialEnd && (
                <ArrowRight
                  className="w-3 h-3 text-amber-600 shrink-0"
                  title={`Bersambung ke sesi berikutnya (sampai hal. ${lastUnit?.page_end} dari ${lastUnit?.raw_page_start}–${lastUnit?.raw_page_end})`}
                />
              )}
            </span>
          )}

          <span
            className={`${UNIT_BADGE} ${clickable}`}
            title={`${formatUnitDisplay(firstUnit)}${journalHint}`}
            onClick={onOpenJournal}
          >
            {formatUnitDisplay(firstUnit)}
          </span>

          {units.length > 1 && (
            <>
              <span className="text-slate-400 shrink-0 font-bold">-</span>
              <span
                className={`${UNIT_BADGE} ${clickable}`}
                title={`${formatUnitDisplay(lastUnit)}${journalHint}`}
                onClick={onOpenJournal}
              >
                {formatUnitDisplay(lastUnit)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
