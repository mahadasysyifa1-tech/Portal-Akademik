import { createClient, Client } from '@libsql/client';
import type {
  DatabaseState,
  Subject,
  ClassEntity,
  Room,
  Teacher,
  Session,
  Period,
  DayOfWeek,
  ScheduleRule,
  RuleException,
  KaldikEvent,
  SyllabusUnit,
  SyllabusScope,
  SyllabusScopeItem,
  Book,
  BookLink,
  BookChapter,
  Material,
} from '../../src/types.ts';

// ----------------------------------------------------------------------------
// Turso Cloud Database Connection (LibSQL - Unified ijma-metadata)
// ----------------------------------------------------------------------------
const TURSO_URL = (process.env.TURSO_METADATA_URL || process.env.TURSO_DATABASE_URL || '').trim();
const TURSO_TOKEN = (process.env.TURSO_METADATA_TOKEN || process.env.TURSO_AUTH_TOKEN || '').trim();

export const tursoClient: Client | null =
  TURSO_URL && TURSO_TOKEN
    ? createClient({
        url: TURSO_URL,
        authToken: TURSO_TOKEN,
      })
    : null;

// Backwards-compatible aliases if needed
export const tursoMetadataClient = tursoClient;
export const tursoKaldikClient = tursoClient;

let isTursoAvailable = false;

// ----------------------------------------------------------------------------
// SQL Schemas (Imported from schemas.ts)
// ----------------------------------------------------------------------------
import { METADATA_SCHEMA_SQL, KALDIK_SCHEMA_SQL, ATTENDANCE_SCHEMA_SQL, UNIFIED_SCHEMA_SQL } from './schemas.ts';
import { seedInitialStudentsIfEmpty, saveAllEnrollmentData, syncAttendanceOptimizationData } from './attendance.ts';
export { METADATA_SCHEMA_SQL, KALDIK_SCHEMA_SQL, ATTENDANCE_SCHEMA_SQL, UNIFIED_SCHEMA_SQL };

// Helper: split multi-statement SQL into individual statements for Turso compatibility
function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ----------------------------------------------------------------------------
// Database Initialization & Idempotent Helper Columns/Indexes Migration
// ----------------------------------------------------------------------------
async function ensureTursoSchemas() {
  if (tursoClient) {
    try {
      await tursoClient.batch(splitStatements(UNIFIED_SCHEMA_SQL), 'write');
    } catch (err: any) {
      console.warn('⚠️ [Turso] Base schema verification note:', err.message);
    }

    // Idempotent migration for helper columns on attnd_meeting
    const helperColumns = [
      'ALTER TABLE attnd_meeting ADD COLUMN present_count INTEGER DEFAULT 0',
      'ALTER TABLE attnd_meeting ADD COLUMN absent_count INTEGER DEFAULT 0',
      'ALTER TABLE attnd_meeting ADD COLUMN enrolled_count INTEGER DEFAULT 0',
      'ALTER TABLE attnd_meeting ADD COLUMN is_logged INTEGER DEFAULT 0',
      'ALTER TABLE attnd_meeting ADD COLUMN target_unit_id TEXT',
      'ALTER TABLE attnd_meeting ADD COLUMN target_unit_title TEXT',
      'ALTER TABLE attnd_meeting ADD COLUMN target_page_range TEXT',
      'ALTER TABLE attnd_meeting ADD COLUMN actual_materi_id TEXT',
      'ALTER TABLE attnd_meeting ADD COLUMN actual_page INTEGER',
    ];

    for (const sql of helperColumns) {
      try {
        await tursoClient.execute(sql);
      } catch {
        // Ignored: column already exists
      }
    }

    // Idempotent covering indexes
    const helperIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_meeting_date_session_order ON attnd_meeting(meeting_date, session_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_meeting_class_subj_date ON attnd_meeting(class_id, subject_id, meeting_date, status)',
      'CREATE INDEX IF NOT EXISTS idx_meeting_class_subj_actual_page ON attnd_meeting(class_id, subject_id, actual_page)',
      'CREATE INDEX IF NOT EXISTS idx_meeting_month_lookup ON attnd_meeting(meeting_date, status)',
      'CREATE INDEX IF NOT EXISTS idx_log_covering ON attnd_meeting_log(meeting_id, person_type, status)',
      'CREATE INDEX IF NOT EXISTS idx_enroll_class_active_covering ON attnd_enroll(class_id, active, student_id)',
    ];

    for (const idxSql of helperIndexes) {
      try {
        await tursoClient.execute(idxSql);
      } catch {
        // Ignored: index already exists
      }
    }

    // Clean up deprecated syllabus_scopes triggers
    const cleanupTriggers = [
      'DROP TRIGGER IF EXISTS trg_sync_scope_notes_update',
      'DROP TRIGGER IF EXISTS trg_sync_scope_notes_insert',
    ];
    for (const dropSql of cleanupTriggers) {
      try {
        await tursoClient.execute(dropSql);
      } catch {}
    }

    // Idempotent backfill migration: extract JSON materialProgress into actual_materi_id, actual_page, and clean notes
    try {
      await tursoClient.execute(`
        UPDATE attnd_meeting
        SET 
          actual_materi_id = COALESCE(json_extract(notes, '$.materialProgress.unitId'), json_extract(notes, '$.materialProgress.materi')),
          actual_page = CAST(json_extract(notes, '$.materialProgress.hal') AS INTEGER),
          notes = json_extract(notes, '$.summary')
        WHERE notes LIKE '{%materialProgress%'
      `);
    } catch (err: any) {
      console.warn('⚠️ [Turso] actual_materi_id backfill note:', err?.message);
    }

    // Initial sync of helper columns and month cache
    await syncAttendanceOptimizationData(tursoClient);
  }
}

const withTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ]);
};

export async function testTursoConnections(): Promise<{ metadataOk: boolean; kaldikOk: boolean; ok: boolean }> {
  let ok = false;

  if (tursoClient) {
    try {
      await withTimeout(
        tursoClient.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1"),
        3500,
        'Connection timeout (3.5s)'
      );
      ok = true;
      isTursoAvailable = true;
      console.log('✅ [Turso] Successfully connected to Unified ijma-metadata Database!');
    } catch (err: any) {
      isTursoAvailable = false;
      console.warn('⚠️ [Turso] Unified Database connection failed:', err.message);
      if (TURSO_TOKEN.length < 100) {
        console.warn('   Note: TURSO Token seems truncated (length ' + TURSO_TOKEN.length + '). Please check the secret value.');
      }
    }
  }

  return { metadataOk: ok, kaldikOk: ok, ok };
}

export async function ensureDataSeeded() {
  const { ok } = await testTursoConnections();
  console.log(`[Database] Turso Unified Database: ${ok ? 'ONLINE' : 'OFFLINE'}`);

  if (!ok) {
    console.error('❌ Turso is unreachable. Reads and writes will fail until this is fixed.');
    return;
  }
  try {
    await ensureTursoSchemas();
    // Strict zero auto-seeding policy: database starts and stays clean without mock students.
  } catch (err: any) {
    console.error('❌ Failed to ensure Turso schemas:', err.message);
  }
}

// ----------------------------------------------------------------------------
// Seed Academic Data (Aligned with Kaldik & Arabic Language Curriculum)
// ----------------------------------------------------------------------------
export const academicSeedData: DatabaseState = {
  classes: [
    { id: 'cls-10a', name: 'Dasar', grade: 1, section: 'INFORMAL', studentCount: 5, icon: 'Layers', color: '#E0F2FE', defaultRoomId: 'rm-19571' },
    { id: 'cls-25914', name: 'Lanjutan', grade: 2, section: 'INFORMAL', studentCount: 10, icon: 'Sparkles', color: '#FEF3C7', onlineClassLink: 'https://meet.google.com/gvz-sytj-acu', defaultRoomId: 'rm-101' },
    { id: 'cla-1789583887114', name: 'Iltizam', grade: 10, section: 'ASRAMA', studentCount: 8, icon: 'Bookmark', color: '#ECFCCB' },
  ],
  teachers: [
    { id: 'tch-10414', name: 'Ustadz Ridwan', panggilan: 'Ust. Ridwan', email: 'ridwan@pesantren.id', department: 'Bahasa Arab', maxPeriodsPerWeek: 18, color: '#0284C7' },
    { id: 'tch-AMZ', name: 'Ustadz Ahmad', panggilan: 'Ust. Ahmad', email: 'ahmad@pesantren.id', department: 'Bahasa Arab', maxPeriodsPerWeek: 18, color: '#10B981' },
    { id: 'tch-ZZH', name: 'Ustadz Zain', panggilan: 'Ust. Zain', email: 'zain@pesantren.id', department: 'Tahfidz', maxPeriodsPerWeek: 18, color: '#8B5CF6' },
  ],
  rooms: [
    { id: 'rm-19571', name: 'Ruang Kelas 1', building: 'Gedung Utama', capacity: 20, type: 'Standard' },
    { id: 'rm-101', name: 'Ruang Kelas 2', building: 'Gedung Utama', capacity: 25, type: 'Standard' },
    { id: 'rm-musholla', name: 'Musholla', building: 'Pusat Ibadah', capacity: 100, type: 'Hall' },
  ],
  subjects: [
    {
      id: 'sub-54462',
      code: 'sub-54462',
      name: 'Tadrib',
      color: '#3B82F6',
      department: 'Bahasa Arab',
      defaultTeacherId: 'tch-10414',
      defaultRoomId: 'rm-19571',
      default_book: 'bk-sub-54462',
    },
    {
      id: 'sub-14104',
      code: 'sub-14104',
      name: "Ta'bir",
      color: '#10B981',
      department: 'Bahasa Arab',
      defaultTeacherId: 'tch-AMZ',
      defaultRoomId: 'rm-101',
      default_book: 'bk-sub-14104',
    },
    {
      id: 'sub-55953',
      code: 'sub-55953',
      name: 'Nahwu',
      color: '#8B5CF6',
      department: 'Bahasa Arab',
      defaultTeacherId: 'tch-10414',
      defaultRoomId: 'rm-19571',
      default_book: 'bk-sub-55953',
    },
    {
      id: 'sub-51325',
      code: 'sub-51325',
      name: 'Sharaf',
      color: '#F59E0B',
      department: 'Bahasa Arab',
      defaultTeacherId: 'tch-AMZ',
      defaultRoomId: 'rm-101',
      default_book: 'bk-sub-51325',
    },
    {
      id: 'sub-1789606082781',
      code: 'sub-1789606082781',
      name: 'Halaqah Quran',
      color: '#06B6D4',
      department: 'Al-Quran',
      defaultTeacherId: 'tch-ZZH',
      defaultRoomId: 'rm-musholla',
      default_book: 'bk-sub-1789606082781',
    },
  ],
  books: [
    {
      id: 'bk-sub-54462',
      title: 'العربية للناشئين',
      altTitle: 'Tadrib',
      author: 'Penyusun Akademik',
      publisher: 'Maktabah Arabiyyah',
      edition: 'Jilid 1-6',
      totalChapters: 6,
      totalPages: 350,
      defaultSubjectId: 'sub-54462',
      links: [
        { id: 'l1', bookId: 'bk-sub-54462', type: 'pdf', label: 'Download PDF Kitab', url: 'https://archive.org/details/Alarabiyah_linnasyiiyin/' },
        { id: 'l2', bookId: 'bk-sub-54462', type: 'shopping_tokopedia', label: 'Beli di Toko Online 1', url: 'https://yufidstore.com/search?type=product&q=Linnasyiin' },
      ],
      chapters: [
        { id: 'ch-tad-1', bookId: 'bk-sub-54462', chapterNumber: 1, title: 'Jilid 1', pageStart: 1, pageEnd: 60 },
        { id: 'ch-tad-2', bookId: 'bk-sub-54462', chapterNumber: 2, title: 'Jilid 2', pageStart: 61, pageEnd: 120 },
      ],
    },
    {
      id: 'bk-sub-14104',
      title: 'دروس اللغة العربية',
      altTitle: "Ta'bir",
      author: 'Dr. V. Abdur Rahim',
      publisher: 'Islamic University of Madinah',
      totalChapters: 4,
      totalPages: 280,
      defaultSubjectId: 'sub-14104',
      links: [],
      chapters: [],
    },
    {
      id: 'bk-sub-55953',
      title: 'النحو الواضح',
      altTitle: 'Nahwu',
      author: 'Ali Al-Jarim & Mustafa Amin',
      publisher: 'Darul Maarif',
      totalChapters: 3,
      totalPages: 240,
      defaultSubjectId: 'sub-55953',
      links: [],
      chapters: [],
    },
    {
      id: 'bk-sub-51325',
      title: 'كتاب التصريف',
      altTitle: 'Sharaf',
      author: 'Hasan bin Ahmad',
      publisher: 'Pustaka Ilmiah',
      totalChapters: 3,
      totalPages: 180,
      defaultSubjectId: 'sub-51325',
      links: [],
      chapters: [],
    },
    {
      id: 'bk-sub-1789606082781',
      title: 'Al-Quran Al-Karim',
      altTitle: 'Halaqah Quran',
      author: 'Mushaf Madinah',
      totalChapters: 30,
      totalPages: 604,
      defaultSubjectId: 'sub-1789606082781',
      links: [],
      chapters: [],
    },
  ],
  sessions: [
    { id: 'ses-1', name: 'Sesi 1 (Pagi)', order: 1, startTime: '07:30', endTime: '09:00' },
    { id: 'ses-2', name: 'Sesi 2 (Dhuha)', order: 2, startTime: '09:15', endTime: '10:45' },
    { id: 'ses-3', name: 'Sesi 3 (Siang)', order: 3, startTime: '13:00', endTime: '14:30' },
    { id: 'ses-4', name: 'Sesi 4 (Sore)', order: 4, startTime: '16:00', endTime: '17:30' },
  ],
  periods: [],
  rules: [],
  kaldikEvents: [],
  materials: [],
  syllabusScopes: [],
  syllabusUnits: [],
};

// ----------------------------------------------------------------------------
// Mapping Helpers (Rows to Domain Types)
// ----------------------------------------------------------------------------
function mapMetadataRows(
  rawClasses: any[],
  rawTeachers: any[],
  rawRooms: any[],
  rawSubjects: any[],
  rawBooks: any[],
  rawBookLinks: any[],
  rawChapters: any[],
  rawSessions: any[]
) {
  const classes: ClassEntity[] = rawClasses.map((c) => {
    const classId = String(c.id || c.code);
    const dispCode = c.display_code || c.code || classId;
    return {
      id: classId,
      display_code: dispCode,
      displayCode: dispCode,
      name: c.name,
      grade: Number(c.grade) || 0,
      section: c.section,
      studentCount: c.student_count ?? 0,
      color: c.color,
      icon: c.icon,
      onlineClassLink: c.online_class_link,
      defaultRoomId: c.default_room_id || c.default_room_code,
    };
  });

  const teachers: Teacher[] = rawTeachers.map((t) => {
    const teacherId = String(t.id || t.code);
    const dispCode = t.display_code || t.panggilan || t.code || teacherId;
    return {
      id: teacherId,
      display_code: dispCode,
      displayCode: dispCode,
      name: t.name,
      panggilan: t.panggilan,
      email: t.email,
      department: t.department,
      maxPeriodsPerWeek: t.max_periods_per_week ?? 18,
      color: t.color,
    };
  });

  const rooms: Room[] = rawRooms.map((r) => {
    const roomId = String(r.id || r.code);
    const dispCode = r.display_code || r.code || roomId;
    return {
      id: roomId,
      display_code: dispCode,
      displayCode: dispCode,
      name: r.name,
      building: r.building,
      capacity: r.capacity,
      type: r.type,
    };
  });

  const linksByBook = new Map<string, BookLink[]>();
  for (const l of rawBookLinks) {
    const bookId = l.book_id || l.book_code;
    const list = linksByBook.get(bookId) || [];
    list.push({
      id: String(l.id),
      bookId,
      type: l.type,
      label: l.label,
      url: l.url,
      sortOrder: l.sort_order,
    });
    linksByBook.set(bookId, list);
  }

  const chaptersByBook = new Map<string, BookChapter[]>();
  for (const ch of rawChapters) {
    const bookId = ch.book_id || ch.book_code;
    const list = chaptersByBook.get(bookId) || [];
    list.push({
      id: String(ch.id || ch.code),
      bookId,
      chapterNumber: ch.chapter_num,
      title: ch.title,
      pageStart: ch.page_start,
      pageEnd: ch.page_end,
      description: ch.description,
    });
    chaptersByBook.set(bookId, list);
  }

  const books: Book[] = rawBooks.map((b) => {
    const bookId = String(b.id || b.code);
    const dispCode = b.display_code || b.alt_title || b.code || bookId;
    const bookChapters = chaptersByBook.get(bookId) || [];
    let calculatedTotalPages = b.total_pages ?? 0;
    if (bookChapters.length > 0) {
      const sumChapterPages = bookChapters.reduce((sum, ch) => sum + (Number(ch.pageEnd) || 0), 0);
      if (sumChapterPages > 0) {
        calculatedTotalPages = sumChapterPages;
      }
    }
    const calculatedTotalChapters = bookChapters.length > 0 ? bookChapters.length : (b.total_chapters ?? 0);

    return {
      id: bookId,
      display_code: dispCode,
      displayCode: dispCode,
      title: b.title,
      altTitle: b.alt_title,
      author: b.author,
      publisher: b.publisher,
      edition: b.edition,
      totalChapters: calculatedTotalChapters,
      totalPages: calculatedTotalPages,
      defaultSubjectId: b.default_subject_id || b.default_subject_code,
      defaultTeacherId: b.default_teacher_id || b.default_teacher_code,
      links: linksByBook.get(bookId) || [],
      chapters: bookChapters,
    };
  });

  const subjects: Subject[] = rawSubjects.map((s) => {
    const subjId = String(s.id || s.code);
    const dispCode = s.display_code || s.code || subjId;
    return {
      id: subjId,
      code: dispCode,
      display_code: dispCode,
      displayCode: dispCode,
      name: s.name,
      color: s.color,
      department: s.department,
      defaultTeacherId: s.default_teacher_id || s.default_teacher_code,
      defaultRoomId: s.default_room_id || s.default_room_code,
      default_book: s.default_book_id || s.default_book || null,
      defaultBookId: s.default_book_id || s.default_book || null,
      default_book_id: s.default_book_id || s.default_book || null,
    };
  });

  const sessions: Session[] = rawSessions.map((s) => {
    const sessionId = String(s.id || s.code);
    const dispCode = s.display_code || s.code || sessionId;
    return {
      id: sessionId,
      display_code: dispCode,
      displayCode: dispCode,
      name: s.name,
      order: s.sort_order,
      startTime: s.start_time,
      endTime: s.end_time,
    };
  });

  return { classes, teachers, rooms, subjects, books, sessions };
}

function mapKaldikRows(
  rawPeriods: any[],
  rawEvents: any[],
  rawRules: any[],
  rawRulePeriods: any[],
  rawExceptions: any[],
  rawMaterials: any[],
  rawScopes: any[],
  rawScopeItems: any[],
  rawScopeBooks: any[] = []
) {
  const periods: Period[] = rawPeriods.map((p) => ({
    id: p.code,
    name: p.name,
    periodNumber: p.period_number,
    startDate: p.start_date,
    endDate: p.end_date,
    description: p.description,
  }));

  const kaldikEvents: KaldikEvent[] = rawEvents.map((e) => ({
    id: e.code,
    title: e.title,
    isKbm: Boolean(e.is_kbm),
    type: e.type,
    isAllDay: Boolean(e.is_all_day),
    startDate: e.start_date,
    endDate: e.end_date,
    startTime: e.start_time,
    endTime: e.end_time,
    periodId: e.period_code,
    color: e.color,
    description: e.description,
  }));

  const rulePeriodsMap = new Map<string, string[]>();
  for (const rp of rawRulePeriods) {
    const list = rulePeriodsMap.get(rp.rule_code) || [];
    list.push(rp.period_code);
    rulePeriodsMap.set(rp.rule_code, list);
  }

  const ruleExceptionsMap = new Map<string, RuleException[]>();
  for (const ex of rawExceptions) {
    const list = ruleExceptionsMap.get(ex.rule_code) || [];
    list.push({
      id: ex.code,
      ruleId: ex.rule_code,
      periodId: ex.period_code,
      overrideSessionId: ex.override_session_code,
      overrideRoomId: ex.override_room_code,
      overrideTeacherId: ex.override_teacher_code,
      note: ex.note,
    });
    ruleExceptionsMap.set(ex.rule_code, list);
  }

  const rules: ScheduleRule[] = rawRules.map((r) => {
    let ruleDays: DayOfWeek[] = [];
    if (r.day_of_week) {
      if (typeof r.day_of_week === 'string' && r.day_of_week.startsWith('[')) {
        try {
          const parsed = JSON.parse(r.day_of_week);
          if (Array.isArray(parsed)) ruleDays = parsed.map(String) as DayOfWeek[];
        } catch {
          ruleDays = [r.day_of_week as DayOfWeek];
        }
      } else if (typeof r.day_of_week === 'string' && r.day_of_week.includes(',')) {
        ruleDays = r.day_of_week.split(',').map((d: string) => d.trim() as DayOfWeek);
      } else if (r.day_of_week) {
        ruleDays = [String(r.day_of_week).trim() as DayOfWeek];
      }
    }
    if (ruleDays.length === 0) ruleDays = ['Monday'];
    const primaryDay = ruleDays[0];
    const pIds = rulePeriodsMap.get(r.code) || [];

    return {
      id: r.code,
      subjectId: r.subject_code,
      classId: r.class_code,
      teacherId: r.teacher_code,
      roomId: r.room_code,
      sessionId: r.session_code,
      dayOfWeek: primaryDay,
      daysOfWeek: ruleDays,
      periodIds: pIds,
      repeatDetail: r.repeat_detail as any,
      active: Boolean(r.active),
      notes: r.notes,
      exceptions: ruleExceptionsMap.get(r.code) || [],
      // Interoperability aliases
      subject_id: r.subject_code,
      class_id: r.class_code,
      teacher_id: r.teacher_code,
      room_id: r.room_code,
      session_id: r.session_code,
      day_of_week: r.day_of_week,
      days_of_week: ruleDays,
      period_ids: pIds,
      repeat_detail: r.repeat_detail,
    };
  });

  const materials: Material[] = rawMaterials.map((m) => {
    const chapterBookId = m.chapter_book_id || (m.chapter_num ? `chap-${m.book_code}-${m.chapter_num}` : undefined);
    return {
      id: m.code,
      bookId: m.book_code,
      chapterBookId,
      chapterNumber: m.chapter_num ?? undefined,
      order: m.order_num,
      title: m.title,
      pageStart: m.page_start,
      pageEnd: m.page_end,
      part: m.part ?? 1,
      no: m.no ?? 0,
      eno: m.eno ?? 0,
      chapter_book_id: chapterBookId,
      page_start: m.page_start,
      page_end: m.page_end,
    };
  });

  const syllabusUnits: SyllabusUnit[] = materials.map((m) => ({
    id: m.id,
    bookId: m.bookId,
    chapterBookId: m.chapterBookId,
    chapterNumber: m.chapterNumber,
    order: m.order,
    title: m.title,
    page_start: m.pageStart ?? '',
    page_end: m.pageEnd ?? '',
    part: m.part ?? 1,
    no: m.no ?? 0,
    eno: m.eno ?? 0,
  }));

  const scopeBooksMap = new Map<string, string[]>();
  for (const sb of rawScopeBooks) {
    const list = scopeBooksMap.get(sb.scope_code) || [];
    list.push(sb.book_code);
    scopeBooksMap.set(sb.scope_code, list);
  }

  const scopeItemsMap = new Map<string, SyllabusScopeItem[]>();
  for (const it of rawScopeItems) {
    const list = scopeItemsMap.get(it.scope_code) || [];
    list.push({
      id: it.code,
      scopeId: it.scope_code,
      bookId: it.book_code,
      chapterBookId: it.chapter_book_id || (it.chapter_num ? `chap-${it.book_code}-${it.chapter_num}` : undefined),
      chapterNumber: it.chapter_num ?? undefined,
      startMaterialId: it.start_material_code,
      endMaterialId: it.end_material_code,
      sortOrder: it.sort_order,
      note: it.note,
    });
    scopeItemsMap.set(it.scope_code, list);
  }

  const syllabusScopes: SyllabusScope[] = rawScopes.map((sc) => {
    const items = scopeItemsMap.get(sc.code) || [];
    const booksFromDb = scopeBooksMap.get(sc.code) || [];
    const derivedBooks = Array.from(new Set(items.map((it) => it.bookId).filter(Boolean)));
    const bookIds = booksFromDb.length > 0 ? booksFromDb : derivedBooks;
    const firstItem = items[0];
    let userNotes = sc.notes;
    let adjustment = undefined;
    if (sc.notes && typeof sc.notes === 'string' && sc.notes.startsWith('{') && sc.notes.includes('_adjustment')) {
      try {
        const parsed = JSON.parse(sc.notes);
        if (parsed._adjustment) {
          adjustment = parsed._adjustment;
          userNotes = parsed.userNote || null;
        }
      } catch {}
    }

    return {
      id: sc.code,
      subject_id: sc.subject_code,
      class_section_id: sc.class_code,
      name: sc.name,
      notes: userNotes,
      adjustment,
      book_ids: bookIds,
      book_id: bookIds[0] || firstItem?.bookId,
      start_unit_id: firstItem?.startMaterialId || '',
      end_unit_id: firstItem?.endMaterialId || '',
      items,
    };
  });

  return { periods, kaldikEvents, rules, materials, syllabusUnits, syllabusScopes };
}

// ----------------------------------------------------------------------------
// In-Memory DatabaseState Caching for Lightning Fast Reads
// ----------------------------------------------------------------------------
let cachedDatabaseState: DatabaseState | null = null;
let cachedStateTimestamp = 0;
const STATE_CACHE_TTL_MS = 60 * 1000; // 60s TTL

export function invalidateDatabaseStateCache(): void {
  cachedDatabaseState = null;
  cachedStateTimestamp = 0;
}

// ----------------------------------------------------------------------------
// Read Operations (Unified Turso Source of Truth with Cache)
// ----------------------------------------------------------------------------
export async function getDatabaseState(forceRefresh = false): Promise<DatabaseState> {
  if (!forceRefresh && cachedDatabaseState && Date.now() - cachedStateTimestamp < STATE_CACHE_TTL_MS) {
    return cachedDatabaseState;
  }

  if (!tursoClient) {
    throw new Error('Turso is not configured. Check the TURSO_* environment variables.');
  }

  const [classesRes, teachersRes, roomsRes, subjectsRes, booksRes, linksRes, chaptersRes, sessionsRes] =
    await Promise.all([
      tursoClient.execute('SELECT * FROM classes ORDER BY grade ASC, section ASC'),
      tursoClient.execute('SELECT * FROM teachers ORDER BY name ASC'),
      tursoClient.execute('SELECT * FROM rooms ORDER BY name ASC'),
      tursoClient.execute('SELECT * FROM subjects ORDER BY name ASC'),
      tursoClient.execute('SELECT * FROM books ORDER BY title ASC'),
      tursoClient.execute('SELECT * FROM book_links ORDER BY sort_order ASC'),
      tursoClient.execute('SELECT * FROM book_chapters ORDER BY chapter_num ASC'),
      tursoClient.execute('SELECT * FROM sessions ORDER BY sort_order ASC'),
    ]);

  const metadataData = mapMetadataRows(
    classesRes.rows as any[],
    teachersRes.rows as any[],
    roomsRes.rows as any[],
    subjectsRes.rows as any[],
    booksRes.rows as any[],
    linksRes.rows as any[],
    chaptersRes.rows as any[],
    sessionsRes.rows as any[]
  );

  let scopeBooksRows: any[] = [];
  try {
    const scopeBooksRes = await tursoClient.execute('SELECT * FROM syllabus_scope_books ORDER BY sort_order ASC');
    scopeBooksRows = scopeBooksRes.rows as any[];
  } catch {
    // table may not exist yet
  }

  const [periodsRes, eventsRes, rulesRes, rulePeriodsRes, exceptionsRes, materialsRes, scopesRes, scopeItemsRes] =
    await Promise.all([
      tursoClient.execute('SELECT * FROM periods ORDER BY period_number ASC'),
      tursoClient.execute('SELECT * FROM kaldik_events ORDER BY start_date ASC'),
      tursoClient.execute('SELECT * FROM schedule_rules'),
      tursoClient.execute('SELECT * FROM schedule_rule_periods'),
      tursoClient.execute('SELECT * FROM schedule_rule_exceptions'),
      tursoClient.execute('SELECT * FROM materials ORDER BY order_num ASC'),
      tursoClient.execute('SELECT * FROM syllabus_scopes'),
      tursoClient.execute('SELECT * FROM syllabus_scope_items ORDER BY sort_order ASC'),
    ]);

  const kaldikData = mapKaldikRows(
    periodsRes.rows as any[],
    eventsRes.rows as any[],
    rulesRes.rows as any[],
    rulePeriodsRes.rows as any[],
    exceptionsRes.rows as any[],
    materialsRes.rows as any[],
    scopesRes.rows as any[],
    scopeItemsRes.rows as any[],
    scopeBooksRows
  );

  let studentsRows: any[] = [];
  let enrollRows: any[] = [];
  let meetingsRows: any[] = [];
  try {
    const stdRes = await tursoClient.execute('SELECT * FROM students ORDER BY name ASC');
    studentsRows = stdRes.rows as any[];
  } catch {}
  try {
    const enrRes = await tursoClient.execute('SELECT * FROM attnd_enroll WHERE active = 1');
    enrollRows = enrRes.rows as any[];
  } catch {}
  try {
    const mRes = await tursoClient.execute(
      'SELECT id, meeting_date, meeting_index, class_id, subject_id, teacher_id, room_id, session_id, rule_code, status, notes, actual_materi_id, actual_page, target_unit_id, target_page_range FROM attnd_meeting ORDER BY meeting_date ASC, session_id ASC'
    );
    meetingsRows = mRes.rows as any[];
  } catch {}

  const students = studentsRows.map((s) => ({
    id: String(s.id),
    nisn: String(s.nisn || ''),
    name: String(s.name || ''),
    gender: (s.gender === 'P' ? 'P' : 'L') as 'L' | 'P',
    phone: s.phone ? String(s.phone) : undefined,
  }));

  const enrollments = enrollRows.map((e) => ({
    id: Number(e.id),
    classId: String(e.class_id),
    studentId: String(e.student_id),
    teacherId: e.teacher_id ? String(e.teacher_id) : undefined,
    academicYear: String(e.academic_year || '2025/2026'),
    active: Number(e.active ?? 1),
  }));

  const meetings = meetingsRows.map((m) => ({
    id: String(m.id),
    meeting_date: String(m.meeting_date),
    meeting_index: m.meeting_index !== null ? Number(m.meeting_index) : undefined,
    class_id: String(m.class_id),
    subject_id: String(m.subject_id),
    teacher_id: m.teacher_id ? String(m.teacher_id) : undefined,
    room_id: m.room_id ? String(m.room_id) : undefined,
    session_id: m.session_id ? String(m.session_id) : undefined,
    rule_code: m.rule_code ? String(m.rule_code) : undefined,
    status: (m.status as any) || 'scheduled',
    actual_materi_id: m.actual_materi_id ? String(m.actual_materi_id) : undefined,
    actual_page: m.actual_page !== null && m.actual_page !== undefined ? Number(m.actual_page) : undefined,
    notes: m.notes ? String(m.notes) : undefined,
    target_unit_id: m.target_unit_id ? String(m.target_unit_id) : undefined,
    target_page_range: m.target_page_range ? String(m.target_page_range) : undefined,
  }));

  const fullState: DatabaseState = { ...metadataData, ...kaldikData, students, enrollments, meetings };
  cachedDatabaseState = fullState;
  cachedStateTimestamp = Date.now();

  return fullState;
}

// ----------------------------------------------------------------------------
// Write Operations (Unified Turso Direct Save)
// ----------------------------------------------------------------------------
export async function saveDatabaseState(state: DatabaseState): Promise<void> {
  invalidateDatabaseStateCache();
  if (!tursoClient) {
    throw new Error('Turso is not configured. Check the TURSO_* environment variables.');
  }
  if (!state.subjects?.length || !state.classes?.length || !state.sessions?.length) {
    throw new Error('Penyimpanan ditolak: tabel inti (mapel/kelas/sesi) kosong. Kemungkinan data belum termuat dengan benar.');
  }

  // Save kaldik and metadata in sequence on the unified client
  await saveTursoKaldik(tursoClient, state);
  await saveTursoMetadata(tursoClient, state);
  invalidateDatabaseStateCache();
  console.log('✅ [Turso] Saved Unified Kaldik & Metadata.');
}
async function saveTursoKaldik(client: Client, state: DatabaseState) {
  const statements: Array<{ sql: string; args?: any }> = [];

  // Periods
  if (Array.isArray(state.periods)) {
    statements.push({ sql: 'DELETE FROM periods' });
    for (const prd of state.periods) {
      statements.push({
        sql: `INSERT INTO periods (code, name, period_number, start_date, end_date, description, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(code) DO UPDATE SET
                name = excluded.name,
                period_number = excluded.period_number,
                start_date = excluded.start_date,
                end_date = excluded.end_date,
                description = excluded.description,
                updated_at = CURRENT_TIMESTAMP`,
        args: [
          prd.id,
          prd.name || '',
          Number(prd.periodNumber ?? (prd as any).period_number) || 1,
          prd.startDate || (prd as any).start_date || '',
          prd.endDate || (prd as any).end_date || '',
          prd.description || null,
        ],
      });
    }
  }

  // Events
  if (Array.isArray(state.kaldikEvents)) {
    statements.push({ sql: 'DELETE FROM kaldik_events' });
    for (const evt of state.kaldikEvents) {
      statements.push({
        sql: `INSERT INTO kaldik_events (code, title, is_kbm, type, is_all_day, start_date, end_date, start_time, end_time, period_code, color, description, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(code) DO UPDATE SET
                title = excluded.title,
                is_kbm = excluded.is_kbm,
                type = excluded.type,
                is_all_day = excluded.is_all_day,
                start_date = excluded.start_date,
                end_date = excluded.end_date,
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                period_code = excluded.period_code,
                color = excluded.color,
                description = excluded.description,
                updated_at = CURRENT_TIMESTAMP`,
        args: [
          evt.id,
          evt.title || '',
          evt.isKbm ? 1 : 0,
          evt.type || 'general',
          evt.isAllDay !== false ? 1 : 0,
          evt.startDate || '',
          evt.endDate || '',
          evt.startTime || null,
          evt.endTime || null,
          evt.periodId || null,
          evt.color || null,
          evt.description || null,
        ],
      });
    }
  }

  // Rules
  if (Array.isArray(state.rules)) {
    statements.push({ sql: 'DELETE FROM schedule_rule_periods' });
    statements.push({ sql: 'DELETE FROM schedule_rule_exceptions' });
    statements.push({ sql: 'DELETE FROM schedule_rules' });

    for (const rule of state.rules) {
      const ruleDays = (Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0)
        ? rule.daysOfWeek
        : (Array.isArray((rule as any).days_of_week) && (rule as any).days_of_week.length > 0)
          ? (rule as any).days_of_week
          : [rule.dayOfWeek || (rule as any).day_of_week || 'Monday'];
      const dayOfWeekStr = ruleDays.length > 1 ? ruleDays.join(',') : (ruleDays[0] || 'Monday');

      let subjId = rule.subjectId || (rule as any).subject_id || '';
      const matchedSub = (state.subjects || []).find((s) => s.id === subjId || (s.code && s.code === subjId));
      if (matchedSub) subjId = matchedSub.id;

      let clsId = rule.classId || (rule as any).class_id || '';
      const matchedCls = (state.classes || []).find((c) => c.id === clsId || ((c as any).code && (c as any).code === clsId));
      if (matchedCls) clsId = matchedCls.id;

      statements.push({
        sql: `INSERT INTO schedule_rules (code, subject_code, class_code, teacher_code, room_code, session_code, day_of_week, repeat_detail, active, notes, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(code) DO UPDATE SET
                subject_code = excluded.subject_code,
                class_code = excluded.class_code,
                teacher_code = excluded.teacher_code,
                room_code = excluded.room_code,
                session_code = excluded.session_code,
                day_of_week = excluded.day_of_week,
                repeat_detail = excluded.repeat_detail,
                active = excluded.active,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP`,
        args: [
          rule.id,
          subjId,
          clsId,
          rule.teacherId || (rule as any).teacher_id || '',
          rule.roomId || (rule as any).room_id || '',
          rule.sessionId || (rule as any).session_id || '',
          dayOfWeekStr,
          rule.repeatDetail || (rule as any).repeat_detail || 'Weekly',
          rule.active !== false ? 1 : 0,
          rule.notes || null,
        ],
      });

      const rawPids = rule.periodIds || (rule as any).period_ids || [];
      const uniquePids = Array.from(new Set(rawPids.filter(Boolean)));
      for (const pId of uniquePids) {
        statements.push({
          sql: `INSERT INTO schedule_rule_periods (rule_id, rule_code, period_code)
                VALUES ((SELECT id FROM schedule_rules WHERE code = ?), ?, ?)
                ON CONFLICT(rule_code, period_code) DO NOTHING`,
          args: [rule.id, rule.id, pId],
        });
      }

      if (rule.exceptions && rule.exceptions.length > 0) {
        for (let eIdx = 0; eIdx < rule.exceptions.length; eIdx++) {
          const exc = rule.exceptions[eIdx];
          statements.push({
            sql: `INSERT INTO schedule_rule_exceptions (code, rule_id, rule_code, period_code, override_session_code, override_room_code, override_teacher_code, note, updated_at)
                  VALUES (?, (SELECT id FROM schedule_rules WHERE code = ?), ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                  ON CONFLICT(code) DO UPDATE SET
                    period_code = excluded.period_code,
                    override_session_code = excluded.override_session_code,
                    override_room_code = excluded.override_room_code,
                    override_teacher_code = excluded.override_teacher_code,
                    note = excluded.note,
                    updated_at = CURRENT_TIMESTAMP`,
            args: [
              exc.id || `${rule.id}-exc-${eIdx + 1}`,
              rule.id,
              rule.id,
              exc.periodId || (exc as any).period_id || '',
              exc.overrideSessionId || (exc as any).override_session_id || null,
              exc.overrideRoomId || (exc as any).override_room_id || null,
              exc.overrideTeacherId || (exc as any).override_teacher_id || null,
              exc.note || null,
            ],
          });
        }
      }
    }
  }

  // Materials
  const rawSourceMaterials: any[] = state.syllabusUnits || state.materials || [];
  statements.push({ sql: 'DELETE FROM materials' });
  {
    const seenMaterialCodes = new Set<string>();
    for (let idx = 0; idx < rawSourceMaterials.length; idx++) {
      const m = rawSourceMaterials[idx];
      let code = String(m.id || m.code || '').trim();
      if (!code) {
        code = `unit-${m.bookId || m.book_code || 'gen'}-${idx + 1}`;
      }
      let uniqueCode = code;
      let counter = 1;
      while (seenMaterialCodes.has(uniqueCode)) {
        uniqueCode = `${code}-${counter++}`;
      }
      seenMaterialCodes.add(uniqueCode);

      const bookCode = m.bookId || m.book_code || (m.subject_id ? `bk-${m.subject_id}` : 'bk-gen');
      const chapterBookId = m.chapterBookId || m.chapter_book_id || (m.chapterNumber ? `chap-${bookCode}-${m.chapterNumber}` : null);
      statements.push({
        sql: `INSERT INTO materials (code, book_code, chapter_book_id, order_num, part, title, page_start, page_end, no, eno, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(code) DO UPDATE SET
                book_code = excluded.book_code,
                chapter_book_id = excluded.chapter_book_id,
                order_num = excluded.order_num,
                part = excluded.part,
                title = excluded.title,
                page_start = excluded.page_start,
                page_end = excluded.page_end,
                no = excluded.no,
                eno = excluded.eno,
                updated_at = CURRENT_TIMESTAMP`,
        args: [
          uniqueCode,
          bookCode,
          chapterBookId,
          Number(m.order ?? m.order_num) || (idx + 1),
          m.part !== undefined ? Number(m.part) : 1,
          m.title || '',
          m.page_start !== undefined && m.page_start !== '' ? Number(m.page_start) : m.pageStart ?? null,
          m.page_end !== undefined && m.page_end !== '' ? Number(m.page_end) : m.pageEnd ?? null,
          m.no !== undefined ? Number(m.no) : 0,
          m.eno !== undefined ? Number(m.eno) : 0,
        ],
      });
    }
  }

  // Scopes & Scope Items
  if (Array.isArray(state.syllabusScopes)) {
    statements.push({ sql: 'DELETE FROM syllabus_scope_books' });
    statements.push({ sql: 'DELETE FROM syllabus_scope_items' });
    statements.push({ sql: 'DELETE FROM syllabus_scopes' });

    for (const scope of state.syllabusScopes) {
      let subjId = scope.subject_id || (scope as any).subject_code || '';
      const matchedSub = (state.subjects || []).find((s) => s.id === subjId || (s.code && s.code === subjId));
      if (matchedSub) subjId = matchedSub.id;

      let clsId = scope.class_section_id || (scope as any).class_code || '';
      const matchedCls = (state.classes || []).find((c) => c.id === clsId || ((c as any).code && (c as any).code === clsId));
      if (matchedCls) clsId = matchedCls.id;

      const scopeCode = scope.id || (subjId && clsId ? `scope-${subjId}-${clsId}` : `scope-${Math.random().toString(36).substring(2, 8)}`);

      let notesValue = scope.notes || null;
      if (scope.adjustment) {
        try {
          notesValue = JSON.stringify({
            ...(scope.notes ? { userNote: scope.notes } : {}),
            _adjustment: scope.adjustment,
          });
        } catch {}
      } else if (typeof scope.notes === 'string' && scope.notes.startsWith('{') && scope.notes.includes('_adjustment')) {
        notesValue = scope.notes;
      }

      statements.push({
        sql: `INSERT INTO syllabus_scopes (code, subject_code, class_code, name, notes, updated_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        args: [scopeCode, subjId, clsId, scope.name || null, notesValue],
      });

      const bookIds = (scope.book_ids && scope.book_ids.length > 0)
        ? scope.book_ids
        : (scope.book_id ? [scope.book_id] : (subjId ? [`bk-${subjId}`] : []));

      for (let bIdx = 0; bIdx < bookIds.length; bIdx++) {
        statements.push({
          sql: `INSERT INTO syllabus_scope_books (scope_code, book_code, sort_order)
                VALUES (?, ?, ?)`,
          args: [scopeCode, bookIds[bIdx], bIdx + 1],
        });
      }

      let items: any[] = scope.items || [];
      if (items.length === 0 && (scope.start_unit_id || scope.end_unit_id)) {
        items = [{
          id: `${scopeCode}-item-1`,
          scopeId: scopeCode,
          bookId: bookIds[0] || (subjId ? `bk-${subjId}` : 'bk-gen'),
          startMaterialId: scope.start_unit_id,
          endMaterialId: scope.end_unit_id,
          sortOrder: 1,
        }];
      }

      for (let iIdx = 0; iIdx < items.length; iIdx++) {
        const item = items[iIdx];
        const itemBook = item.bookId || (item as any).book_code || bookIds[0] || (subjId ? `bk-${subjId}` : 'bk-gen');
        const itemChapterBookId = item.chapterBookId || (item as any).chapter_book_id || (item.chapterNumber ? `chap-${itemBook}-${item.chapterNumber}` : null);
        statements.push({
          sql: `INSERT INTO syllabus_scope_items (code, scope_code, book_code, chapter_book_id, start_material_code, end_material_code, sort_order, note, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          args: [
            item.id || `${scopeCode}-item-${iIdx + 1}`,
            scopeCode,
            itemBook,
            itemChapterBookId,
            item.startMaterialId || (item as any).start_material_code || null,
            item.endMaterialId || (item as any).end_material_code || null,
            item.sortOrder ?? (iIdx + 1),
            item.note || null,
          ],
        });
      }
    }
  }

    await client.batch(statements as any, 'write');
}

async function saveTursoMetadata(client: Client, state: DatabaseState) {
  const statements: Array<{ sql: string; args?: any }> = [];

  // Classes: upsert active classes, then clean up any deleted classes safely
  if (Array.isArray(state.classes) && state.classes.length > 0) {
    const seenIds = new Set<string>();
    for (const cls of state.classes) {
      if (!cls.id || seenIds.has(cls.id)) continue;
      seenIds.add(cls.id);
      const dispCode = cls.display_code || cls.displayCode || (cls as any).code || cls.id;
      statements.push({
        sql: `INSERT INTO classes (id, display_code, name, grade, section, student_count, color, icon, online_class_link, default_room_id, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET
                display_code = excluded.display_code,
                name = excluded.name,
                grade = excluded.grade,
                section = excluded.section,
                student_count = excluded.student_count,
                color = excluded.color,
                icon = excluded.icon,
                online_class_link = excluded.online_class_link,
                default_room_id = excluded.default_room_id,
                updated_at = CURRENT_TIMESTAMP`,
        args: [
          cls.id,
          dispCode,
          cls.name || '',
          Number(cls.grade) || 0,
          cls.section || '',
          Number(cls.studentCount ?? cls.student_count) || 0,
          cls.color || null,
          cls.icon || null,
          cls.onlineClassLink || cls.online_class_link || null,
          cls.defaultRoomId || cls.default_room_id || null,
        ],
      });
    }

    const classIds = Array.from(seenIds);
    if (classIds.length > 0) {
      const placeholders = classIds.map(() => '?').join(', ');
      statements.push({
        sql: `DELETE FROM attnd_meeting_log WHERE meeting_id IN (SELECT id FROM attnd_meeting WHERE class_id NOT IN (${placeholders}))`,
        args: [...classIds],
      });
      statements.push({
        sql: `DELETE FROM attnd_meeting WHERE class_id NOT IN (${placeholders})`,
        args: [...classIds],
      });
      statements.push({
        sql: `DELETE FROM attnd_enroll WHERE class_id NOT IN (${placeholders})`,
        args: [...classIds],
      });
      statements.push({
        sql: `DELETE FROM classes WHERE id NOT IN (${placeholders})`,
        args: [...classIds],
      });
    }
  }

  // Teachers: upsert active teachers, then safely unlink and remove deleted teachers
  if (Array.isArray(state.teachers) && state.teachers.length > 0) {
    const seenIds = new Set<string>();
    for (const tch of state.teachers) {
      if (!tch.id || seenIds.has(tch.id)) continue;
      seenIds.add(tch.id);
      const dispCode = tch.display_code || tch.displayCode || tch.panggilan || (tch as any).code || tch.id;
      statements.push({
        sql: `INSERT INTO teachers (id, display_code, name, panggilan, email, department, max_periods_per_week, color, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET
                display_code = excluded.display_code,
                name = excluded.name,
                panggilan = excluded.panggilan,
                email = excluded.email,
                department = excluded.department,
                max_periods_per_week = excluded.max_periods_per_week,
                color = excluded.color,
                updated_at = CURRENT_TIMESTAMP`,
        args: [
          tch.id,
          dispCode,
          tch.name || '',
          tch.panggilan || null,
          tch.email || null,
          tch.department || '',
          Number(tch.maxPeriodsPerWeek ?? tch.max_periods_per_week) || 18,
          tch.color || null,
        ],
      });
    }

    const teacherIds = Array.from(seenIds);
    if (teacherIds.length > 0) {
      const placeholders = teacherIds.map(() => '?').join(', ');
      statements.push({
        sql: `UPDATE attnd_meeting SET teacher_id = NULL WHERE teacher_id IS NOT NULL AND teacher_id NOT IN (${placeholders})`,
        args: [...teacherIds],
      });
      statements.push({
        sql: `UPDATE attnd_enroll SET teacher_id = NULL WHERE teacher_id IS NOT NULL AND teacher_id NOT IN (${placeholders})`,
        args: [...teacherIds],
      });
      statements.push({
        sql: `DELETE FROM teachers WHERE id NOT IN (${placeholders})`,
        args: [...teacherIds],
      });
    }
  }

  // Rooms: upsert active rooms, then safely unlink and remove deleted rooms
  if (Array.isArray(state.rooms) && state.rooms.length > 0) {
    const seenIds = new Set<string>();
    for (const rm of state.rooms) {
      if (!rm.id || seenIds.has(rm.id)) continue;
      seenIds.add(rm.id);
      const dispCode = rm.display_code || rm.displayCode || (rm as any).code || rm.id;
      statements.push({
        sql: `INSERT INTO rooms (id, display_code, name, building, capacity, type, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET
                display_code = excluded.display_code,
                name = excluded.name,
                building = excluded.building,
                capacity = excluded.capacity,
                type = excluded.type,
                updated_at = CURRENT_TIMESTAMP`,
        args: [rm.id, dispCode, rm.name || '', rm.building || '', Number(rm.capacity) || 30, rm.type || 'Standard'],
      });
    }

    const roomIds = Array.from(seenIds);
    if (roomIds.length > 0) {
      const placeholders = roomIds.map(() => '?').join(', ');
      statements.push({
        sql: `UPDATE attnd_meeting SET room_id = NULL WHERE room_id IS NOT NULL AND room_id NOT IN (${placeholders})`,
        args: [...roomIds],
      });
      statements.push({
        sql: `DELETE FROM rooms WHERE id NOT IN (${placeholders})`,
        args: [...roomIds],
      });
    }
  }

  // Subjects: upsert active subjects, then safely unlink and remove deleted subjects
  if (Array.isArray(state.subjects) && state.subjects.length > 0) {
    const seenIds = new Set<string>();
    for (const sub of state.subjects) {
      if (!sub.id || seenIds.has(sub.id)) continue;
      seenIds.add(sub.id);
      const dispCode = sub.display_code || sub.displayCode || sub.code || sub.id;
      statements.push({
        sql: `INSERT INTO subjects (id, display_code, name, color, department, default_teacher_id, default_room_id, default_book_id, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET
                display_code = excluded.display_code,
                name = excluded.name,
                color = excluded.color,
                department = excluded.department,
                default_teacher_id = excluded.default_teacher_id,
                default_room_id = excluded.default_room_id,
                default_book_id = excluded.default_book_id,
                updated_at = CURRENT_TIMESTAMP`,
        args: [
          sub.id,
          dispCode,
          sub.name || '',
          sub.color || '#3B82F6',
          sub.department || '',
          sub.defaultTeacherId || sub.default_teacher_id || null,
          sub.defaultRoomId || sub.default_room_id || null,
          sub.default_book_id || sub.default_book || sub.defaultBookId || null,
        ],
      });
    }

    const subjectIds = Array.from(seenIds);
    if (subjectIds.length > 0) {
      const placeholders = subjectIds.map(() => '?').join(', ');
      statements.push({
        sql: `UPDATE attnd_meeting SET subject_id = NULL WHERE subject_id IS NOT NULL AND subject_id NOT IN (${placeholders})`,
        args: [...subjectIds],
      });
      statements.push({
        sql: `DELETE FROM subjects WHERE id NOT IN (${placeholders})`,
        args: [...subjectIds],
      });
    }
  }

  // Books: upsert active books, sync links and chapters, then clean up deleted books
  const booksToSave: Book[] = state.books || [];
  if (Array.isArray(state.books) && state.books.length > 0) {
    const seenIds = new Set<string>();
    for (const b of booksToSave) {
      if (!b.id || seenIds.has(b.id)) continue;
      seenIds.add(b.id);
      const dispCode = b.display_code || b.displayCode || b.altTitle || (b as any).code || b.id;

      let defSubjId = b.defaultSubjectId || null;
      if (defSubjId) {
        const matchedSub = (state.subjects || []).find((s) => s.id === defSubjId || (s.code && s.code === defSubjId) || (s.display_code && s.display_code === defSubjId));
        if (matchedSub) defSubjId = matchedSub.id;
      }

      statements.push({
        sql: `INSERT INTO books (id, display_code, title, alt_title, author, publisher, edition, total_chapters, total_pages, default_subject_id, default_teacher_id, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET
                display_code = excluded.display_code,
                title = excluded.title,
                alt_title = excluded.alt_title,
                author = excluded.author,
                publisher = excluded.publisher,
                edition = excluded.edition,
                total_chapters = excluded.total_chapters,
                total_pages = excluded.total_pages,
                default_subject_id = excluded.default_subject_id,
                default_teacher_id = excluded.default_teacher_id,
                updated_at = CURRENT_TIMESTAMP`,
        args: [
          b.id,
          dispCode,
          b.title || 'Buku Referensi',
          b.altTitle || null,
          b.author || null,
          b.publisher || null,
          b.edition || null,
          b.totalChapters ?? 0,
          b.totalPages ?? 0,
          defSubjId,
          b.defaultTeacherId || null,
        ],
      });
    }

    const bookIds = Array.from(seenIds);
    if (bookIds.length > 0) {
      const placeholders = bookIds.map(() => '?').join(', ');
      statements.push({
        sql: `DELETE FROM book_links WHERE book_id IN (${placeholders})`,
        args: [...bookIds],
      });
      statements.push({
        sql: `DELETE FROM book_chapters WHERE book_id IN (${placeholders})`,
        args: [...bookIds],
      });
      statements.push({
        sql: `DELETE FROM books WHERE id NOT IN (${placeholders})`,
        args: [...bookIds],
      });
    }

    for (const b of booksToSave) {
      if (!b.id) continue;
      if (b.links && b.links.length > 0) {
        for (let lIdx = 0; lIdx < b.links.length; lIdx++) {
          const link = b.links[lIdx];
          statements.push({
            sql: `INSERT INTO book_links (book_id, type, label, url, sort_order) VALUES (?, ?, ?, ?, ?)`,
            args: [b.id, link.type || 'pdf', link.label || 'Tautan', link.url, link.sortOrder ?? (lIdx + 1)],
          });
        }
      }

      if (b.chapters && b.chapters.length > 0) {
        for (const ch of b.chapters) {
          statements.push({
            sql: `INSERT INTO book_chapters (id, book_id, chapter_num, title, page_start, page_end, description, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                  ON CONFLICT(id) DO UPDATE SET
                    chapter_num = excluded.chapter_num,
                    title = excluded.title,
                    page_start = excluded.page_start,
                    page_end = excluded.page_end,
                    description = excluded.description,
                    updated_at = CURRENT_TIMESTAMP`,
            args: [
              ch.id,
              b.id,
              ch.chapterNumber,
              ch.title,
              ch.pageStart ?? null,
              ch.pageEnd ?? null,
              ch.description ?? null,
            ],
          });
        }
      }
    }
  }

  // Sessions: upsert active sessions, then safely unlink and remove deleted sessions
  if (Array.isArray(state.sessions) && state.sessions.length > 0) {
    const seenIds = new Set<string>();
    for (const ses of state.sessions) {
      if (!ses.id || seenIds.has(ses.id)) continue;
      seenIds.add(ses.id);
      const dispCode = ses.display_code || ses.displayCode || (ses as any).code || ses.id;
      statements.push({
        sql: `INSERT INTO sessions (id, display_code, name, sort_order, start_time, end_time, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET
                display_code = excluded.display_code,
                name = excluded.name,
                sort_order = excluded.sort_order,
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                updated_at = CURRENT_TIMESTAMP`,
        args: [
          ses.id,
          dispCode,
          ses.name || '',
          Number(ses.order ?? (ses as any).sort_order) || 1,
          ses.startTime || (ses as any).start_time || '08:00',
          ses.endTime || (ses as any).end_time || '10:00',
        ],
      });
    }

    const sessionIds = Array.from(seenIds);
    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map(() => '?').join(', ');
      statements.push({
        sql: `UPDATE attnd_meeting SET session_id = NULL WHERE session_id IS NOT NULL AND session_id NOT IN (${placeholders})`,
        args: [...sessionIds],
      });
      statements.push({
        sql: `DELETE FROM sessions WHERE id NOT IN (${placeholders})`,
        args: [...sessionIds],
      });
    }
  }

  await client.batch(statements as any, 'write');

  if (Array.isArray(state.students) || Array.isArray(state.enrollments)) {
    await saveAllEnrollmentData(client, state.students, state.enrollments);
  }
}



export async function resetDatabaseState(template: DatabaseState = academicSeedData): Promise<void> {
  await saveDatabaseState(template);
}
