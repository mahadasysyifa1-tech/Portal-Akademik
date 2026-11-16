import {
  Book,
  ClassEntity,
  DatabaseState,
  Room,
  StudentRecord,
  Subject,
  Teacher,
} from '../types';

export interface SubjectBookRelations {
  booksBySubjectMap: Map<string, Book[]>;
  subjectsByBookMap: Map<string, Subject[]>;
}

export interface TeacherLoadStats {
  sessions: number;
  subjects: Set<string>;
}

export interface ClassDerivedRelations {
  defaultRoom?: Room;
  subjects: Subject[];
  books: Book[];
  weeklySessions: number;
  teachers: Teacher[];
  students: StudentRecord[];
}

function findBookByRef(
  ref: string | null | undefined,
  allBooks: Book[],
  bookById: Map<string, Book>
): Book | undefined {
  if (!ref) return undefined;
  return (
    bookById.get(ref) ||
    allBooks.find(
      (b) =>
        b.id === ref ||
        b.displayCode === ref ||
        b.display_code === ref ||
        (b as { code?: string }).code === ref
    )
  );
}

function findSubjectByRef(
  ref: string | null | undefined,
  allSubjects: Subject[],
  subjectById: Map<string, Subject>
): Subject | undefined {
  if (!ref) return undefined;
  return (
    subjectById.get(ref) ||
    allSubjects.find(
      (s) =>
        s.id === ref ||
        s.code === ref ||
        s.displayCode === ref ||
        s.display_code === ref
    )
  );
}

export function bookMatchesRef(book: Book, ref: string | null | undefined): boolean {
  if (!ref) return false;
  return (
    book.id === ref ||
    book.displayCode === ref ||
    book.display_code === ref ||
    (book as { code?: string }).code === ref
  );
}

function subjectMatchesRef(subject: Subject, ref: string | null | undefined): boolean {
  if (!ref) return false;
  return (
    subject.id === ref ||
    subject.code === ref ||
    subject.displayCode === ref ||
    subject.display_code === ref
  );
}

export function getSubjectPrimaryBookRef(subject: Subject): string | null | undefined {
  return (
    subject.default_book ||
    subject.defaultBookId ||
    subject.default_book_id ||
    subject.primary_book_code ||
    subject.book
  );
}

/**
 * Symmetrically resolves Many-to-Many relationships between Subjects and Books
 * across subject defaults, book defaultSubjectId, syllabusUnits, and syllabusScopes.
 */
export function buildSubjectBookRelations(db: DatabaseState): SubjectBookRelations {
  const allBooks = db.books || [];
  const allSubjects = db.subjects || [];
  const allUnits = db.syllabusUnits || [];
  const allScopes = db.syllabusScopes || [];

  const bookById = new Map<string, Book>(allBooks.map((b) => [b.id, b]));
  const subjectById = new Map<string, Subject>(allSubjects.map((s) => [s.id, s]));

  const subjectToBookIds = new Map<string, Set<string>>();
  const bookToSubjectIds = new Map<string, Set<string>>();

  const addPair = (subject: Subject | undefined, book: Book | undefined) => {
    if (!subject || !book) return;
    let bSet = subjectToBookIds.get(subject.id);
    if (!bSet) {
      bSet = new Set<string>();
      subjectToBookIds.set(subject.id, bSet);
    }
    bSet.add(book.id);

    let sSet = bookToSubjectIds.get(book.id);
    if (!sSet) {
      sSet = new Set<string>();
      bookToSubjectIds.set(book.id, sSet);
    }
    sSet.add(subject.id);
  };

  // 1. Subject primary/default book links
  for (const subject of allSubjects) {
    const defRef = getSubjectPrimaryBookRef(subject);
    if (defRef) {
      addPair(subject, findBookByRef(defRef, allBooks, bookById));
    }
  }

  // 2. Book default subject links
  for (const book of allBooks) {
    if (book.defaultSubjectId) {
      addPair(findSubjectByRef(book.defaultSubjectId, allSubjects, subjectById), book);
    }
  }

  // 3. Syllabus units referencing both a subject and a book
  for (const unit of allUnits) {
    const sub = findSubjectByRef(unit.subject_id, allSubjects, subjectById);
    const bk = findBookByRef(unit.bookId || unit.bookCode, allBooks, bookById);
    addPair(sub, bk);
  }

  // 4. Syllabus scopes (single or multi-book distributions)
  for (const scope of allScopes) {
    const sub = findSubjectByRef(scope.subject_id, allSubjects, subjectById);
    if (!sub) continue;

    if (scope.book_id) {
      addPair(sub, findBookByRef(scope.book_id, allBooks, bookById));
    }
    scope.book_ids?.forEach((bRef) => {
      addPair(sub, findBookByRef(bRef, allBooks, bookById));
    });
    scope.items?.forEach((item) => {
      if (item.bookId) {
        addPair(sub, findBookByRef(item.bookId, allBooks, bookById));
      }
    });
  }

  const booksBySubjectMap = new Map<string, Book[]>();
  for (const subject of allSubjects) {
    const defRef = getSubjectPrimaryBookRef(subject);
    const ids = subjectToBookIds.get(subject.id);
    const resolved: Book[] = [];
    if (ids) {
      ids.forEach((bId) => {
        const b = bookById.get(bId);
        if (b) resolved.push(b);
      });
    }
    resolved.sort((a, b) => {
      const aPrimary = bookMatchesRef(a, defRef);
      const bPrimary = bookMatchesRef(b, defRef);
      if (aPrimary && !bPrimary) return -1;
      if (!aPrimary && bPrimary) return 1;
      return a.title.localeCompare(b.title, 'id');
    });
    booksBySubjectMap.set(subject.id, resolved);
  }

  const subjectsByBookMap = new Map<string, Subject[]>();
  for (const book of allBooks) {
    const ids = bookToSubjectIds.get(book.id);
    const resolved: Subject[] = [];
    if (ids) {
      ids.forEach((sId) => {
        const s = subjectById.get(sId);
        if (s) resolved.push(s);
      });
    }
    resolved.sort((a, b) => a.name.localeCompare(b.name, 'id'));
    subjectsByBookMap.set(book.id, resolved);
  }

  return { booksBySubjectMap, subjectsByBookMap };
}

/**
 * Resolves classes studying each Book from syllabusScopes and active schedule rules.
 */
export function buildBookClassRelations(
  db: DatabaseState,
  subjectsByBookMap: Map<string, Subject[]>
): Map<string, ClassEntity[]> {
  const allBooks = db.books || [];
  const allScopes = db.syllabusScopes || [];
  const allRules = db.rules || [];
  const allClasses = db.classes || [];
  const classMap = new Map<string, ClassEntity>(allClasses.map((c) => [c.id, c]));

  const map = new Map<string, ClassEntity[]>();

  for (const book of allBooks) {
    const classIdSet = new Set<string>();

    // 1. Direct syllabus scopes using this book (by id or code alias)
    for (const scope of allScopes) {
      const hasBook =
        bookMatchesRef(book, scope.book_id) ||
        scope.book_ids?.some((bRef) => bookMatchesRef(book, bRef)) ||
        scope.items?.some((it) => bookMatchesRef(book, it.bookId));
      if (hasBook && scope.class_section_id) {
        classIdSet.add(scope.class_section_id);
      }
    }

    // 2. Active schedule rules for subjects linked to this book
    const linkedSubjects = subjectsByBookMap.get(book.id) || [];
    for (const rule of allRules) {
      if (
        rule.active !== false &&
        rule.classId &&
        linkedSubjects.some((s) => subjectMatchesRef(s, rule.subjectId))
      ) {
        classIdSet.add(rule.classId);
      }
    }

    const resolvedClasses: ClassEntity[] = [];
    for (const cId of classIdSet) {
      const cls =
        classMap.get(cId) ||
        allClasses.find(
          (c) =>
            c.id === cId ||
            c.name === cId ||
            c.displayCode === cId ||
            c.display_code === cId
        );
      if (cls && !resolvedClasses.some((existing) => existing.id === cls.id)) {
        resolvedClasses.push(cls);
      }
    }

    resolvedClasses.sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section, 'id'));
    map.set(book.id, resolvedClasses);
  }

  return map;
}

/**
 * Aggregates weekly active session counts and taught subject IDs per teacher.
 */
export function buildTeacherStatsMap(db: DatabaseState): Record<string, TeacherLoadStats> {
  const stats: Record<string, TeacherLoadStats> = {};
  (db.teachers || []).forEach((t) => {
    stats[t.id] = { sessions: 0, subjects: new Set<string>() };
  });

  (db.rules || []).forEach((r) => {
    if (r.active && stats[r.teacherId]) {
      const daysCount = r.daysOfWeek?.length || 1;
      stats[r.teacherId].sessions += daysCount;
      stats[r.teacherId].subjects.add(r.subjectId);
    }
  });

  return stats;
}

export function getTeacherTaughtSubjects(
  db: DatabaseState,
  teacherId: string,
  teacherStats?: Record<string, TeacherLoadStats>
): Subject[] {
  const statsMap = teacherStats || buildTeacherStatsMap(db);
  const stats = statsMap[teacherId];
  if (!stats) return [];

  const subjectById = new Map<string, Subject>((db.subjects || []).map((s) => [s.id, s]));
  const result: Subject[] = [];
  stats.subjects.forEach((sid) => {
    const sub = subjectById.get(sid);
    if (sub) result.push(sub);
  });
  return result;
}

/**
 * Reconciles student class enrollments across student.enrolledClassIds, db.enrollments,
 * and legacy/direct student.classId consistently across directories and HomeTab.
 */
export function buildStudentEnrollmentsMap(db: DatabaseState): Map<string, ClassEntity[]> {
  const allClasses = db.classes || [];
  const classMap = new Map<string, ClassEntity>(allClasses.map((c) => [c.id, c]));
  const classIdsByStudent = new Map<string, string[]>();

  const appendClassId = (studentId: string, classId: string | undefined) => {
    if (!classId) return;
    const current = classIdsByStudent.get(studentId) || [];
    if (!current.includes(classId)) {
      current.push(classId);
    }
    classIdsByStudent.set(studentId, current);
  };

  (db.students || []).forEach((student) => {
    if (Array.isArray(student.enrolledClassIds)) {
      student.enrolledClassIds.forEach((cid) => appendClassId(student.id, cid));
    }
    const legacyClassId = (student as StudentRecord & { classId?: string }).classId;
    if (legacyClassId) {
      appendClassId(student.id, legacyClassId);
    }
  });

  (db.enrollments || []).forEach((enrollment) => {
    if (enrollment.active === false || enrollment.active === 0) return;
    appendClassId(enrollment.studentId, enrollment.classId);
  });

  const resolvedMap = new Map<string, ClassEntity[]>();
  (db.students || []).forEach((student) => {
    const ids = classIdsByStudent.get(student.id) || [];
    const classes: ClassEntity[] = [];
    ids.forEach((cid) => {
      const cls = classMap.get(cid);
      if (cls && !classes.some((existing) => existing.id === cls.id)) {
        classes.push(cls);
      }
    });
    resolvedMap.set(student.id, classes);
  });

  return resolvedMap;
}

export function getStudentEnrolledClasses(
  db: DatabaseState,
  student: StudentRecord | null,
  enrollmentsMap?: Map<string, ClassEntity[]>,
  viewerClassId?: string
): ClassEntity[] {
  const allClasses = db.classes || [];
  if (!student) {
    if (viewerClassId) {
      const cls = allClasses.find((c) => c.id === viewerClassId);
      return cls ? [cls] : [];
    }
    return [];
  }

  const map = enrollmentsMap || buildStudentEnrollmentsMap(db);
  const matched = map.get(student.id) || [];
  if (matched.length > 0) return matched;

  if (viewerClassId) {
    const directCls = allClasses.find((c) => c.id === viewerClassId);
    if (directCls) return [directCls];
  }

  return allClasses.slice(0, 1);
}

/**
 * Computes derived cross-entity relations for every ClassEntity:
 * default room, subjects taught, books used, weekly session count,
 * enlisted teachers, and enlisted students.
 */
export function buildClassRelationsMap(db: DatabaseState): Map<string, ClassDerivedRelations> {
  const allClasses = db.classes || [];
  const allSubjects = db.subjects || [];
  const allBooks = db.books || [];
  const allRooms = db.rooms || [];
  const allTeachers = db.teachers || [];
  const allStudents = db.students || [];
  const allRules = db.rules || [];
  const allScopes = db.syllabusScopes || [];

  const subjectById = new Map<string, Subject>(allSubjects.map((s) => [s.id, s]));
  const bookById = new Map<string, Book>(allBooks.map((b) => [b.id, b]));
  const roomById = new Map<string, Room>(allRooms.map((r) => [r.id, r]));
  const teacherById = new Map<string, Teacher>(allTeachers.map((t) => [t.id, t]));

  const { booksBySubjectMap } = buildSubjectBookRelations(db);
  const studentEnrollmentsMap = buildStudentEnrollmentsMap(db);

  const studentsByClassId = new Map<string, StudentRecord[]>();
  allStudents.forEach((student) => {
    const enrolled = studentEnrollmentsMap.get(student.id) || [];
    enrolled.forEach((cls) => {
      const list = studentsByClassId.get(cls.id) || [];
      if (!list.some((existing) => existing.id === student.id)) {
        list.push(student);
      }
      studentsByClassId.set(cls.id, list);
    });
  });

  const classMatchesRef = (cls: ClassEntity, ref: string | null | undefined): boolean => {
    if (!ref) return false;
    return (
      cls.id === ref ||
      cls.name === ref ||
      cls.displayCode === ref ||
      cls.display_code === ref
    );
  };

  const result = new Map<string, ClassDerivedRelations>();

  for (const cls of allClasses) {
    const defaultRoomRef = cls.defaultRoomId || cls.default_room_id;
    const defaultRoom = defaultRoomRef
      ? roomById.get(defaultRoomRef) ||
        allRooms.find(
          (r) =>
            r.id === defaultRoomRef ||
            r.displayCode === defaultRoomRef ||
            r.display_code === defaultRoomRef
        )
      : undefined;

    const subjectSet = new Map<string, Subject>();
    const bookSet = new Map<string, Book>();
    const teacherSet = new Map<string, Teacher>();
    let weeklySessions = 0;

    // 1. Active schedule rules for this class -> sessions, subjects, teachers
    for (const rule of allRules) {
      if (rule.active === false) continue;
      if (!classMatchesRef(cls, rule.classId)) continue;

      weeklySessions += rule.daysOfWeek?.length || 1;

      const sub = findSubjectByRef(rule.subjectId, allSubjects, subjectById);
      if (sub) subjectSet.set(sub.id, sub);

      const tch = teacherById.get(rule.teacherId);
      if (tch) teacherSet.set(tch.id, tch);
    }

    // 2. Syllabus scopes for this class -> additional subjects & direct books
    for (const scope of allScopes) {
      if (!classMatchesRef(cls, scope.class_section_id)) continue;

      const sub = findSubjectByRef(scope.subject_id, allSubjects, subjectById);
      if (sub) subjectSet.set(sub.id, sub);

      const addBookRef = (ref?: string | null) => {
        const bk = findBookByRef(ref, allBooks, bookById);
        if (bk) bookSet.set(bk.id, bk);
      };
      addBookRef(scope.book_id);
      scope.book_ids?.forEach((ref) => addBookRef(ref));
      scope.items?.forEach((it) => addBookRef(it.bookId));
    }

    // 3. Collect linked books across all class subjects
    subjectSet.forEach((sub) => {
      const linkedBooks = booksBySubjectMap.get(sub.id) || [];
      linkedBooks.forEach((bk) => bookSet.set(bk.id, bk));
    });

    // 4. Include teachers explicitly assigned to this class via assignedClassIds
    for (const tch of allTeachers) {
      if (Array.isArray(tch.assignedClassIds) && tch.assignedClassIds.some((cid) => classMatchesRef(cls, cid))) {
        teacherSet.set(tch.id, tch);
      }
    }

    const subjects = Array.from(subjectSet.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'id')
    );
    const books = Array.from(bookSet.values()).sort((a, b) =>
      a.title.localeCompare(b.title, 'id')
    );
    const teachers = Array.from(teacherSet.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'id')
    );
    const students = [...(studentsByClassId.get(cls.id) || [])].sort((a, b) =>
      a.name.localeCompare(b.name, 'id')
    );

    result.set(cls.id, {
      defaultRoom,
      subjects,
      books,
      weeklySessions,
      teachers,
      students,
    });
  }

  return result;
}

