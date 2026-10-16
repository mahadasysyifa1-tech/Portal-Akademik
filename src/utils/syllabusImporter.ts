import { SyllabusUnit, DatabaseState, Book, Subject } from '../types';

/**
 * Escapes a field for CSV format (RFC 4180)
 */
function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Robust CSV line tokenizer respecting quoted fields
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nextCh = text[i + 1];

    if (ch === '"') {
      if (insideQuotes && nextCh === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (ch === ',' && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((ch === '\r' || ch === '\n') && !insideQuotes) {
      if (ch === '\r' && nextCh === '\n') i++;
      currentRow.push(currentVal.trim());
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += ch;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function cleanHeaderKey(h: string): string {
  return h.toLowerCase().replace(/[\s_\-]/g, '');
}

/**
 * Parse Syllabus CSV per Book-centric specification:
 * - book_code -> Book (matched against db.books by id, code, or displayCode)
 * - order -> sequential order number
 * - title -> syllabus material title
 * - page_start -> start page
 * - page_end -> end page
 * - part -> volume / part number
 *
 * Subject relation is auto-inferred from Subject whose default_book matches this book.
 * Columns 'no' and 'eno' are removed.
 */
export function parseSyllabusCsv(
  csvText: string,
  books: Book[],
  subjectsOrDefaultBookId?: Subject[] | string,
  defaultBookId?: string
): { units: SyllabusUnit[]; errors: string[]; rowCount: number } {
  let subjects: Subject[] = [];
  let resolvedDefaultBookId: string | undefined = defaultBookId;

  if (typeof subjectsOrDefaultBookId === 'string') {
    resolvedDefaultBookId = subjectsOrDefaultBookId;
  } else if (Array.isArray(subjectsOrDefaultBookId)) {
    subjects = subjectsOrDefaultBookId;
  }

  const errors: string[] = [];
  const rows = parseCsvRows(csvText);

  // Look up books by id, code, or displayCode (case-insensitive)
  const bookLookup = new Map<string, Book>();
  for (const b of books || []) {
    if (b.id) bookLookup.set(b.id.trim().toLowerCase(), b);
    if (b.display_code) bookLookup.set(b.display_code.trim().toLowerCase(), b);
    if (b.displayCode) bookLookup.set(b.displayCode.trim().toLowerCase(), b);
  }

  if (rows.length < 2) {
    return { units: [], errors: ['File CSV kosong atau tidak memiliki baris data.'], rowCount: 0 };
  }

  const rawHeaders = rows[0];
  const headerKeys = rawHeaders.map(cleanHeaderKey);

  // Find column indices
  const colBookCode = headerKeys.findIndex((k) =>
    ['bookcode', 'bookid', 'buku', 'kitab', 'kodebuku', 'book', 'kode'].includes(k)
  );
  const colOrder = headerKeys.findIndex((k) =>
    ['order', 'ordern', 'urutan', 'mapeln', 'n', 'noorder', 'nomor'].includes(k)
  );
  const colTitle = headerKeys.findIndex((k) =>
    ['title', 'judul', 'mtr', 'materi', 'bab', 'topik'].includes(k)
  );
  const colPageStart = headerKeys.findIndex((k) =>
    ['pagestart', 'startpage', 'halpertama', 'halawal', 'hal1', 'halamanawal'].includes(k)
  );
  const colPageEnd = headerKeys.findIndex((k) =>
    ['pageend', 'endpage', 'halterakhir', 'halakhir', 'hal2', 'halamanakhir'].includes(k)
  );
  const colPart = headerKeys.findIndex((k) =>
    ['part', 'pt', 'jilid', 'bagian', 'volume', 'vol'].includes(k)
  );

  const rawParsedUnits: Array<{
    resolvedBook: Book;
    bookId: string;
    subject_id?: string;
    rawOrder: number;
    title: string;
    page_start: string | number;
    page_end: string | number;
    part: string | number;
  }> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || row.every((val) => val === '')) continue;

    let resolvedBook: Book | undefined;
    if (colBookCode !== -1 && row[colBookCode]) {
      const rawCode = row[colBookCode].trim();
      resolvedBook = bookLookup.get(rawCode.toLowerCase());
      if (!resolvedBook) {
        errors.push(`Baris ${r + 1}: Kode buku "${rawCode}" tidak ditemukan di daftar Buku/Kitab.`);
        continue;
      }
    } else if (resolvedDefaultBookId) {
      resolvedBook = bookLookup.get(resolvedDefaultBookId.toLowerCase()) || (books || []).find((b) => b.id === resolvedDefaultBookId);
      if (!resolvedBook) {
        errors.push(`Baris ${r + 1}: Kolom book_code kosong dan buku acuan bawaan tidak valid.`);
        continue;
      }
    } else {
      errors.push(`Baris ${r + 1}: Kolom book_code kosong atau tidak ditemukan.`);
      continue;
    }

    // Auto-infer subject from db.subjects whose default_book matches this book
    const bookId = resolvedBook.id;
    const subjectForBook = subjects.find(
      (s) =>
        s.default_book === bookId ||
        s.defaultBookId === bookId ||
        s.default_book === (resolvedBook?.displayCode || resolvedBook?.display_code) ||
        s.primary_book_code === bookId ||
        s.primary_book_code === (resolvedBook?.displayCode || resolvedBook?.display_code) ||
        (resolvedBook?.defaultSubjectId && s.id === resolvedBook.defaultSubjectId)
    );
    const inferredSubjectId = subjectForBook ? subjectForBook.id : (resolvedBook.defaultSubjectId || '');

    const rawNStr = colOrder !== -1 ? row[colOrder] : '';
    const parsedN = parseFloat(rawNStr);
    const rawOrder = isNaN(parsedN) ? r : parsedN;

    const title = (colTitle !== -1 ? row[colTitle] : '') || `Materi ${r}`;
    const pageStart = colPageStart !== -1 ? row[colPageStart] : '';
    const pageEnd = colPageEnd !== -1 ? row[colPageEnd] : '';
    const part = colPart !== -1 && row[colPart] ? row[colPart] : '1';

    rawParsedUnits.push({
      resolvedBook,
      bookId: resolvedBook.id,
      subject_id: inferredSubjectId || undefined,
      rawOrder,
      title: title.trim(),
      page_start: pageStart,
      page_end: pageEnd,
      part
    });
  }

  // Group by bookId and sort strictly by order per book to assign clean sequential order
  const grouped = new Map<string, typeof rawParsedUnits>();
  for (const item of rawParsedUnits) {
    if (!grouped.has(item.bookId)) {
      grouped.set(item.bookId, []);
    }
    grouped.get(item.bookId)!.push(item);
  }

  const finalUnits: SyllabusUnit[] = [];

  grouped.forEach((bookItems, bId) => {
    bookItems.sort((a, b) => a.rawOrder - b.rawOrder);

    bookItems.forEach((item, index) => {
      const assignedOrder = index + 1;
      finalUnits.push({
        id: `unit-${bId}-${assignedOrder}`,
        bookId: bId,
        bookCode: item.resolvedBook.displayCode || item.resolvedBook.display_code || bId,
        subject_id: item.subject_id,
        order: assignedOrder,
        title: item.title,
        page_start: item.page_start,
        page_end: item.page_end,
        part: item.part
      });
    });
  });

  return {
    units: finalUnits,
    errors,
    rowCount: finalUnits.length
  };
}

/**
 * Generates sample CSV template for SyllabusUnit
 * Template headers: book_code,order,title,page_start,page_end,part
 * If books input is provided, outputs 1 clean sample row per book in db.books
 */
export function getSampleSyllabusCsv(booksInput?: Book[] | string): string {
  const headers = ['book_code', 'order', 'title', 'page_start', 'page_end', 'part'];

  if (Array.isArray(booksInput) && booksInput.length > 0) {
    const sampleRows = booksInput.map((b, i) => {
      const code = b.displayCode || b.display_code || b.id;
      return [
        code,
        '1',
        `Mukaddimah & Bab 1 (${b.title})`,
        '1',
        '20',
        '1'
      ];
    });
    return [headers.join(','), ...sampleRows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
  }

  const defaultCode = typeof booksInput === 'string' && booksInput.trim() ? booksInput.trim() : 'BK-ARB';
  const sampleRows = [
    [defaultCode, '1', 'Mukaddimah & Kaidah Dasar', '1', '14', '1'],
    [defaultCode, '2', 'Bab 1: Pembahasan Utama', '15', '30', '1'],
    [defaultCode, '3', 'Bab 2: Pendalaman & Latihan', '31', '50', '1']
  ];

  return [headers.join(','), ...sampleRows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
}

/**
 * Export all syllabus units to CSV
 * Headers: book_id,book_title,order,title,page_start,page_end,part,unit_weight
 */
export function exportSyllabusUnitsToCsv(units: SyllabusUnit[], db?: DatabaseState): string {
  const headers = [
    'book_id',
    'book_title',
    'order',
    'title',
    'page_start',
    'page_end',
    'part',
    'unit_weight'
  ];

  const bookLookup = new Map<string, Book>();
  for (const b of db?.books || []) {
    if (b.id) bookLookup.set(b.id, b);
    if (b.display_code) bookLookup.set(b.display_code, b);
    if (b.displayCode) bookLookup.set(b.displayCode, b);
  }

  const rows = units.map((u) => {
    const book = (u.bookId && bookLookup.get(u.bookId)) || (u.bookCode && bookLookup.get(u.bookCode));
    const bookIdVal = book ? (book.displayCode || book.display_code || book.id) : (u.bookCode || u.bookId || '');
    const bookTitleVal = book ? book.title : '';

    const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
    const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
    const weight = (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart)
      ? (pEnd - pStart + 1)
      : 1;

    return [
      escapeCsv(bookIdVal),
      escapeCsv(bookTitleVal),
      escapeCsv(u.order),
      escapeCsv(u.title),
      escapeCsv(u.page_start),
      escapeCsv(u.page_end),
      escapeCsv(u.part ?? 1),
      escapeCsv(weight)
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

export const exportSyllabusToCsv = exportSyllabusUnitsToCsv;
