import {
  DatabaseState,
  ScheduleRule,
  RuleException,
  Period,
  Session,
  Subject,
  ClassEntity,
  Teacher,
  Room,
  DayOfWeek,
  SyllabusUnit,
  SyllabusScope,
  KaldikEvent,
  Book,
  Material,
  SyllabusScopeItem,
  MeetingRecord
} from '../types';

export function normalizeKaldikEvent(raw: any): KaldikEvent {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: 'Event Baru',
      type: 'general',
      isAllDay: true,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      color: '#6366F1'
    };
  }

  const startDate = String(raw.startDate || raw.start_date || new Date().toISOString().slice(0, 10));
  const endDate = String(raw.endDate || raw.end_date || startDate);

  return {
    id: String(raw.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
    title: String(raw.title || 'Event Baru'),
    isKbm: Boolean(raw.isKbm || raw.is_kbm || raw.type === 'kbm'),
    type: (raw.type as any) || (raw.isKbm ? 'kbm' : 'general'),
    isAllDay: raw.isAllDay !== undefined ? Boolean(raw.isAllDay) : true,
    startDate,
    endDate,
    startTime: raw.startTime || raw.start_time || undefined,
    endTime: raw.endTime || raw.end_time || undefined,
    isRecurring: Boolean(raw.isRecurring || raw.is_recurring),
    daysOfWeek: Array.isArray(raw.daysOfWeek || raw.days_of_week) ? (raw.daysOfWeek || raw.days_of_week) : undefined,
    repeatDetail: raw.repeatDetail || raw.repeat_detail || undefined,
    periodId: raw.periodId || raw.period_id || undefined,
    color: raw.color || (raw.isKbm ? '#F59E0B' : '#6366F1'),
    description: raw.description || undefined,
    createdAt: raw.createdAt || raw.created_at || undefined
  };
}

export function normalizeRule(raw: any, availablePeriods: Period[] = []): ScheduleRule {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      subjectId: '',
      classId: '',
      teacherId: '',
      roomId: '',
      sessionId: '',
      dayOfWeek: 'Monday',
      daysOfWeek: ['Monday'],
      periodIds: availablePeriods.length > 0 ? [availablePeriods[0].id] : ['prd-1'],
      repeatDetail: 'Weekly',
      active: true,
      exceptions: [],
      notes: ''
    };
  }

  // 1. Resolve Period IDs (periodIds, period_ids, or JSON string)
  let periodIds: string[] = [];
  const rawPids = raw.periodIds !== undefined ? raw.periodIds : raw.period_ids;
  if (Array.isArray(rawPids)) {
    periodIds = rawPids.map(String).filter(Boolean);
  } else if (typeof rawPids === 'string') {
    try {
      const parsed = JSON.parse(rawPids);
      if (Array.isArray(parsed)) {
        periodIds = parsed.map(String).filter(Boolean);
      } else if (rawPids.includes(',')) {
        periodIds = rawPids.split(',').map((p) => p.trim()).filter(Boolean);
      } else if (rawPids.trim()) {
        periodIds = [rawPids.trim()];
      }
    } catch {
      if (rawPids.includes(',')) {
        periodIds = rawPids.split(',').map((p) => p.trim()).filter(Boolean);
      } else if (rawPids.trim()) {
        periodIds = [rawPids.trim()];
      }
    }
  }

  // Deduplicate raw period IDs
  periodIds = Array.from(new Set(periodIds.filter(Boolean)));

  if (availablePeriods.length > 0) {
    const validPeriodIds = new Set(availablePeriods.map(p => p.id));
    const filteredPids = periodIds.filter(id => validPeriodIds.has(id));
    if (filteredPids.length > 0) {
      periodIds = filteredPids;
    } else {
      periodIds = [availablePeriods[0].id];
    }
    // Always sort periodIds according to availablePeriods order/periodNumber
    const periodOrderMap = new Map(availablePeriods.map((p, idx) => [p.id, p.periodNumber ?? idx]));
    periodIds.sort((a, b) => (periodOrderMap.get(a) ?? 999) - (periodOrderMap.get(b) ?? 999));
  }

  if (periodIds.length === 0) {
    if (availablePeriods.length > 0) {
      periodIds = [availablePeriods[0].id];
    } else {
      periodIds = ['prd-1'];
    }
  }

  // 2. Resolve Days (single day and multi-day selections)
  let daysOfWeek: DayOfWeek[] = [];
  const rawDays = raw.daysOfWeek !== undefined ? raw.daysOfWeek : raw.days_of_week;
  if (Array.isArray(rawDays)) {
    daysOfWeek = rawDays.map(String).filter(Boolean) as DayOfWeek[];
  } else if (typeof rawDays === 'string') {
    try {
      const parsed = JSON.parse(rawDays);
      if (Array.isArray(parsed)) {
        daysOfWeek = parsed.map(String).filter(Boolean) as DayOfWeek[];
      } else if (rawDays.includes(',')) {
        daysOfWeek = rawDays.split(',').map((d) => d.trim()).filter(Boolean) as DayOfWeek[];
      } else if (rawDays.trim()) {
        daysOfWeek = [rawDays.trim() as DayOfWeek];
      }
    } catch {
      if (rawDays.includes(',')) {
        daysOfWeek = rawDays.split(',').map((d) => d.trim()).filter(Boolean) as DayOfWeek[];
      } else if (rawDays.trim()) {
        daysOfWeek = [rawDays.trim() as DayOfWeek];
      }
    }
  }

  // Also check raw.dayOfWeek / raw.day_of_week if daysOfWeek is still empty
  if (daysOfWeek.length === 0) {
    const rawSingle = raw.dayOfWeek || raw.day_of_week;
    if (typeof rawSingle === 'string' && rawSingle.includes(',')) {
      daysOfWeek = rawSingle.split(',').map((d) => d.trim()).filter(Boolean) as DayOfWeek[];
    } else if (rawSingle) {
      daysOfWeek = [String(rawSingle).trim() as DayOfWeek];
    }
  }

  const singleDay = (daysOfWeek[0] || raw.dayOfWeek || raw.day_of_week || 'Monday') as DayOfWeek;
  if (daysOfWeek.length === 0) {
    daysOfWeek = [singleDay];
  }

  // Deduplicate days
  daysOfWeek = Array.from(new Set(daysOfWeek));

  // 3. Resolve Exceptions
  const rawExceptions = Array.isArray(raw.exceptions) ? raw.exceptions : [];
  const exceptions: RuleException[] = rawExceptions.map((e: any, idx: number) => ({
    id: String(e.id || `exc-${raw.id || 'rule'}-${idx}`),
    ruleId: String(e.ruleId || e.rule_id || raw.id || ''),
    periodId: String(e.periodId || e.period_id || (periodIds[0] || '')),
    overrideSessionId: e.overrideSessionId || e.override_session_id || undefined,
    overrideRoomId: e.overrideRoomId || e.override_room_id || undefined,
    overrideTeacherId: e.overrideTeacherId || e.override_teacher_id || undefined,
    note: e.note || e.notes || undefined,
    period_id: String(e.periodId || e.period_id || (periodIds[0] || '')),
    override_session_id: e.overrideSessionId || e.override_session_id || undefined,
    override_room_id: e.overrideRoomId || e.override_room_id || undefined,
    override_teacher_id: e.overrideTeacherId || e.override_teacher_id || undefined
  }));

  const ruleId = String(raw.id || `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
  const subjectId = String(raw.subjectId || raw.subject_id || '');
  const classId = String(raw.classId || raw.class_id || '');
  const teacherId = String(raw.teacherId || raw.teacher_id || '');
  const roomId = String(raw.roomId || raw.room_id || '');
  const sessionId = String(raw.sessionId || raw.session_id || '');
  const repeatDetail = raw.repeatDetail || raw.repeat_detail || 'Weekly';
  const active = raw.active !== undefined ? (raw.active === 1 || raw.active === true || raw.active === '1') : true;
  const notes = raw.notes || '';
  const dateRanges = Array.isArray(raw.dateRanges) ? raw.dateRanges : undefined;

  return {
    id: ruleId,
    subjectId,
    classId,
    teacherId,
    roomId,
    sessionId,
    dayOfWeek: singleDay,
    daysOfWeek,
    periodIds,
    dateRanges,
    repeatDetail,
    active,
    exceptions,
    notes,
    createdAt: raw.createdAt || raw.created_at || undefined,

    // Dual properties for 100% interoperability with Python / SQLite / JSON
    subject_id: subjectId,
    class_id: classId,
    teacher_id: teacherId,
    room_id: roomId,
    session_id: sessionId,
    day_of_week: daysOfWeek.length > 1 ? daysOfWeek.join(',') : singleDay,
    days_of_week: daysOfWeek,
    period_ids: periodIds,
    repeat_detail: repeatDetail
  };
}

export function normalizeDatabaseState(raw: any): DatabaseState {
  if (!raw || typeof raw !== 'object') {
    return {
      subjects: [],
      classes: [],
      rooms: [],
      teachers: [],
      sessions: [],
      periods: [],
      rules: []
    };
  }

  const periods: Period[] = (Array.isArray(raw.periods) ? raw.periods : [])
    .slice()
    .sort((a: any, b: any) => Number(a.periodNumber ?? a.period_number ?? 0) - Number(b.periodNumber ?? b.period_number ?? 0))
    .map((p: any, idx: number) => ({
      id: String(p.id || `prd-${idx + 1}`),
      name: String(p.name || `Period ${idx + 1}`),
      periodNumber: idx + 1,
      startDate: String(p.startDate || p.start_date || '2026-09-01'),
      endDate: String(p.endDate || p.end_date || '2026-09-30'),
      description: p.description || '',
      period_number: idx + 1,
      start_date: String(p.startDate || p.start_date || '2026-09-01'),
      end_date: String(p.endDate || p.end_date || '2026-09-30')
    }));

  const sessions: Session[] = (Array.isArray(raw.sessions) ? raw.sessions : [])
    .slice()
    .sort((a: any, b: any) => Number(a.order ?? a.sort_order ?? 0) - Number(b.order ?? b.sort_order ?? 0))
    .map((s: any, idx: number) => {
      const id = String(s.id || `ses-${idx + 1}`);
      const displayCode = String(s.displayCode || s.display_code || s.code || id);
      return {
        id,
        displayCode,
        display_code: displayCode,
        name: String(s.name || `Session ${idx + 1}`),
        order: idx + 1,
        startTime: String(s.startTime || s.start_time || '08:00'),
        endTime: String(s.endTime || s.end_time || '10:00'),
        sort_order: idx + 1,
        start_time: String(s.startTime || s.start_time || '08:00'),
        end_time: String(s.endTime || s.end_time || '10:00')
      };
    });

  const subjects: Subject[] = (Array.isArray(raw.subjects) ? raw.subjects : []).map((s: any, idx: number) => {
    const id = String(s.id || `sub-${idx + 1}`);
    const displayCode = String(s.displayCode || s.display_code || s.code || id);
    const defaultBook = s.default_book || s.defaultBookId || s.default_book_code || undefined;
    return {
      id,
      code: displayCode,
      displayCode,
      display_code: displayCode,
      name: String(s.name || 'Subject'),
      color: String(s.color || '#4F46E5'),
      department: String(s.department || 'General'),
      defaultTeacherId: s.defaultTeacherId || s.default_teacher_id || undefined,
      defaultRoomId: s.defaultRoomId || s.default_room_id || undefined,
      default_teacher_id: s.defaultTeacherId || s.default_teacher_id || null,
      default_room_id: s.defaultRoomId || s.default_room_id || null,
      default_book: defaultBook,
      defaultBookId: defaultBook,
    };
  });

  const classes: ClassEntity[] = (Array.isArray(raw.classes) ? raw.classes : []).map((c: any, idx: number) => {
    const id = String(c.id || `cls-${idx + 1}`);
    const displayCode = String(c.displayCode || c.display_code || c.code || id);
    return {
      id,
      displayCode,
      display_code: displayCode,
      name: String(c.name || `Class ${idx + 1}`),
      grade: Number(c.grade ?? 1),
      section: String(c.section || 'A'),
      studentCount: Number(c.studentCount ?? c.student_count ?? 30),
      student_count: Number(c.studentCount ?? c.student_count ?? 30),
      icon: c.icon ? String(c.icon) : undefined,
      color: c.color ? String(c.color) : undefined,
      onlineClassLink: c.onlineClassLink || c.online_class_link || undefined,
      online_class_link: c.onlineClassLink || c.online_class_link || undefined,
      defaultRoomId: c.defaultRoomId || c.default_room_id || undefined,
      default_room_id: c.defaultRoomId || c.default_room_id || null
    };
  });

  const teachers: Teacher[] = (Array.isArray(raw.teachers) ? raw.teachers : []).map((t: any, idx: number) => {
    const id = String(t.id || `tch-${idx + 1}`);
    const displayCode = String(t.displayCode || t.display_code || t.code || t.panggilan || id);
    return {
      id,
      displayCode,
      display_code: displayCode,
      name: String(t.name || 'Teacher'),
      panggilan: t.panggilan ? String(t.panggilan) : undefined,
      email: String(t.email || ''),
      department: String(t.department || 'General'),
      maxPeriodsPerWeek: Number(t.maxPeriodsPerWeek ?? t.max_periods_per_week ?? 18),
      max_periods_per_week: Number(t.maxPeriodsPerWeek ?? t.max_periods_per_week ?? 18),
      color: t.color ? String(t.color) : undefined
    };
  });

  const rooms: Room[] = (Array.isArray(raw.rooms) ? raw.rooms : []).map((r: any, idx: number) => {
    const id = String(r.id || `rm-${idx + 1}`);
    const displayCode = String(r.displayCode || r.display_code || r.code || id);
    return {
      id,
      displayCode,
      display_code: displayCode,
      name: String(r.name || 'Room'),
      building: String(r.building || 'Main Campus'),
      capacity: Number(r.capacity ?? 30),
      type: r.type || 'Standard'
    };
  });

  // Lookup maps for normalizing foreign keys from code to canonical id
  const subjectCodeToIdMap = new Map<string, string>();
  for (const s of subjects) {
    if (s.id) subjectCodeToIdMap.set(s.id.toLowerCase(), s.id);
    if (s.code) subjectCodeToIdMap.set(s.code.toLowerCase(), s.id);
  }

  const classCodeToIdMap = new Map<string, string>();
  for (const c of classes) {
    if (c.id) classCodeToIdMap.set(c.id.toLowerCase(), c.id);
    if ((c as any).code) classCodeToIdMap.set(String((c as any).code).toLowerCase(), c.id);
  }

  const rules: ScheduleRule[] = (Array.isArray(raw.rules) ? raw.rules : []).map((r: any) => {
    const norm = normalizeRule(r, periods);
    const rawSubj = String(norm.subjectId || '').trim();
    if (rawSubj && subjectCodeToIdMap.has(rawSubj.toLowerCase())) {
      const canonicalSubjId = subjectCodeToIdMap.get(rawSubj.toLowerCase())!;
      norm.subjectId = canonicalSubjId;
      norm.subject_id = canonicalSubjId;
    }
    const rawCls = String(norm.classId || '').trim();
    if (rawCls && classCodeToIdMap.has(rawCls.toLowerCase())) {
      const canonicalClsId = classCodeToIdMap.get(rawCls.toLowerCase())!;
      norm.classId = canonicalClsId;
      norm.class_id = canonicalClsId;
    }
    return norm;
  });

  // syllabusUnits is what the UI edits, so it must win over the stale materials copy
  const rawMaterials = Array.isArray(raw.syllabusUnits)
    ? raw.syllabusUnits
    : (Array.isArray(raw.materials) ? raw.materials : []);
  const syllabusUnits: SyllabusUnit[] = rawMaterials.map((u: any, idx: number) => {
    const rawSubId = u.subject_id ?? u.subjectId ?? undefined;
    const resolvedSubId = rawSubId && subjectCodeToIdMap.has(String(rawSubId).toLowerCase())
      ? subjectCodeToIdMap.get(String(rawSubId).toLowerCase())
      : rawSubId;

    const bookId = String(u.bookId || u.book_code || (resolvedSubId ? `bk-${resolvedSubId}` : 'bk-gen'));
    const chapterBookId = u.chapterBookId || u.chapter_book_id || (u.chapterNumber ? `chap-${bookId}-${u.chapterNumber}` : undefined);
    return {
      id: String(u.id || `mat-${idx + 1}`),
      subject_id: resolvedSubId,
      bookId,
      chapterBookId,
      chapterNumber: u.chapterNumber ?? u.chapter_num ?? undefined,
      order: Number(u.order ?? (idx + 1)),
      title: String(u.title || `Materi ${idx + 1}`),
      page_start: u.page_start ?? u.pageStart ?? '',
      page_end: u.page_end ?? u.pageEnd ?? '',
      part: u.part ?? 1,
      no: Number(u.no ?? (idx + 1)),
      eno: Number(u.eno ?? (u.no ?? (idx + 1)))
    };
  });

  const materials: Material[] = rawMaterials.map((u: any, idx: number) => {
    const rawSubId = u.subject_id ?? u.subjectId ?? undefined;
    const resolvedSubId = rawSubId && subjectCodeToIdMap.has(String(rawSubId).toLowerCase())
      ? subjectCodeToIdMap.get(String(rawSubId).toLowerCase())
      : rawSubId;

    const bookCode = String(u.bookId || u.book_code || (resolvedSubId ? `bk-${resolvedSubId}` : 'bk-gen'));
    const chapterBookId = u.chapterBookId || u.chapter_book_id || (u.chapterNumber ? `chap-${bookCode}-${u.chapterNumber}` : undefined);
    return {
      id: String(u.id || `mat-${idx + 1}`),
      bookId: bookCode,
      chapterBookId,
      chapterNumber: u.chapterNumber ?? u.chapter_num ?? undefined,
      order: Number(u.order ?? (idx + 1)),
      title: String(u.title || `Materi ${idx + 1}`),
      pageStart: u.pageStart ?? u.page_start ?? '',
      pageEnd: u.pageEnd ?? u.page_end ?? '',
      part: u.part ?? 1,
      no: Number(u.no ?? (idx + 1)),
      eno: Number(u.eno ?? (u.no ?? (idx + 1))),
      chapter_book_id: chapterBookId,
      page_start: u.page_start ?? u.pageStart ?? '',
      page_end: u.page_end ?? u.pageEnd ?? ''
    };
  });

  const books: Book[] = (Array.isArray(raw.books) ? raw.books : []).map((b: any, idx: number) => {
    const id = String(b.id || b.code || `bk-${idx + 1}`);
    const displayCode = String(b.displayCode || b.display_code || b.altTitle || b.alt_title || b.code || id);
    const rawSubId = b.defaultSubjectId || b.default_subject_code || '';
    const resolvedSubId = rawSubId && subjectCodeToIdMap.has(String(rawSubId).toLowerCase())
      ? subjectCodeToIdMap.get(String(rawSubId).toLowerCase())!
      : rawSubId;

    const chapters = Array.isArray(b.chapters) ? b.chapters : [];
    let calcTotalPages = Number(b.totalPages ?? b.total_pages ?? 0);
    if (chapters.length > 0) {
      const sumChapterPages = chapters.reduce((sum: number, ch: any) => sum + (Number(ch.pageEnd ?? ch.page_end) || 0), 0);
      if (sumChapterPages > 0) {
        calcTotalPages = sumChapterPages;
      }
    }
    const calcTotalChapters = chapters.length > 0 ? chapters.length : Number(b.totalChapters ?? b.total_chapters ?? 0);

    return {
      id,
      displayCode,
      display_code: displayCode,
      title: String(b.title || `Buku ${idx + 1}`),
      altTitle: b.altTitle || b.alt_title || '',
      author: b.author || '',
      publisher: b.publisher || '',
      edition: b.edition || '',
      totalChapters: calcTotalChapters,
      totalPages: calcTotalPages,
      defaultSubjectId: resolvedSubId,
      defaultTeacherId: b.defaultTeacherId || b.default_teacher_code || '',
      links: Array.isArray(b.links) ? b.links : [],
      chapters
    };
  });

  const syllabusScopes: SyllabusScope[] = (Array.isArray(raw.syllabusScopes) ? raw.syllabusScopes : []).map((s: any, idx: number) => {
    const rawItems = Array.isArray(s.items) ? s.items : [];
    const items: SyllabusScopeItem[] = rawItems.map((it: any, itIdx: number) => {
      const bookId = String(it.bookId || it.book_code || s.book_id || (s.book_ids && s.book_ids[0]) || '');
      const chapterBookId = it.chapterBookId || it.chapter_book_id || (it.chapterNumber ? `chap-${bookId}-${it.chapterNumber}` : undefined);
      return {
        id: String(it.id || `${s.id || 'scope'}-item-${itIdx + 1}`),
        scopeId: String(it.scopeId || s.id || `scope-${idx + 1}`),
        bookId,
        chapterBookId,
        chapterNumber: it.chapterNumber ?? it.chapter_num ?? undefined,
        startMaterialId: String(it.startMaterialId || it.start_material_code || ''),
        endMaterialId: String(it.endMaterialId || it.end_material_code || ''),
        sortOrder: Number(it.sortOrder ?? it.sort_order ?? (itIdx + 1)),
        note: it.note || ''
      };
    });

    const itemBooks = Array.from(new Set(items.map((it) => it.bookId).filter(Boolean)));
    const bookIds = Array.isArray(s.book_ids) && s.book_ids.length > 0
      ? s.book_ids
      : (s.book_id ? [s.book_id] : (itemBooks.length > 0 ? itemBooks : []));

    let adjustment = s.adjustment || undefined;
    let userNotes = s.notes || '';
    if (!adjustment && typeof userNotes === 'string' && userNotes.startsWith('{') && userNotes.includes('_adjustment')) {
      try {
        const parsed = JSON.parse(userNotes);
        if (parsed && parsed._adjustment) {
          adjustment = parsed._adjustment;
          userNotes = parsed.userNote || '';
        }
      } catch {}
    }

    const rawSubjId = String(s.subject_id || s.subjectId || '');
    const resolvedSubjId = rawSubjId && subjectCodeToIdMap.has(rawSubjId.toLowerCase())
      ? subjectCodeToIdMap.get(rawSubjId.toLowerCase())!
      : rawSubjId;

    const rawClassId = String(s.class_section_id || s.classSectionId || s.classId || '');
    const resolvedClassId = rawClassId && classCodeToIdMap.has(rawClassId.toLowerCase())
      ? classCodeToIdMap.get(rawClassId.toLowerCase())!
      : rawClassId;

    return {
      id: String(s.id || `scope-${idx + 1}`),
      subject_id: resolvedSubjId,
      class_section_id: resolvedClassId,
      name: s.name || '',
      notes: userNotes,
      adjustment,
      book_ids: bookIds,
      book_id: bookIds[0] || s.book_id || s.bookId || (items[0]?.bookId || ''),
      start_unit_id: String(s.start_unit_id || s.startUnitId || (items[0]?.startMaterialId || '')),
      end_unit_id: String(s.end_unit_id || s.endUnitId || (items[items.length - 1]?.endMaterialId || items[0]?.endMaterialId || '')),
      items
    };
  });

  const kaldikEvents: KaldikEvent[] = (Array.isArray(raw.kaldikEvents) ? raw.kaldikEvents : []).map(
    normalizeKaldikEvent
  );

  const meetings: MeetingRecord[] | undefined = Array.isArray(raw.meetings)
    ? raw.meetings.map((m: any) => ({
        id: String(m.id),
        meeting_date: String(m.meeting_date || m.meetingDate || ''),
        meeting_index: typeof m.meeting_index === 'number' ? m.meeting_index : typeof m.meetingIndex === 'number' ? m.meetingIndex : undefined,
        active_meeting_index: typeof m.active_meeting_index === 'number' ? m.active_meeting_index : typeof m.activeMeetingIndex === 'number' ? m.activeMeetingIndex : undefined,
        class_id: String(m.class_id || m.classId || ''),
        subject_id: String(m.subject_id || m.subjectId || ''),
        teacher_id: m.teacher_id || m.teacherId || undefined,
        room_id: m.room_id || m.roomId || undefined,
        session_id: m.session_id || m.sessionId || undefined,
        rule_code: m.rule_code || m.ruleCode || undefined,
        status: (m.status === 'cancelled' || m.status === 'completed' || m.status === 'scheduled') ? m.status : 'scheduled',
        actual_materi_id: m.actual_materi_id || m.actualMateriId || undefined,
        actual_page: typeof m.actual_page === 'number' ? m.actual_page : typeof m.actualPage === 'number' ? m.actualPage : undefined,
        notes: m.notes || undefined,
        target_unit_id: m.target_unit_id || m.targetUnitId || undefined,
        target_page_range: m.target_page_range || m.targetPageRange || undefined
      }))
    : undefined;

  return {
    subjects,
    classes,
    rooms,
    teachers,
    sessions,
    periods,
    rules,
    kaldikEvents,
    books,
    materials,
    syllabusUnits,
    syllabusScopes,
    students: Array.isArray(raw.students) ? raw.students : undefined,
    enrollments: Array.isArray(raw.enrollments) ? raw.enrollments : undefined,
    meetings
  };
}
