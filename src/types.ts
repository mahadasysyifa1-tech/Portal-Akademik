export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface SubjectLinks {
  pdf?: string;
  shopping?: string;
  shopping2?: string;
  site?: string;
  [key: string]: string | undefined;
}

export interface Subject {
  id: string; // Auto-generated unique text ID, e.g. 'sub-54462'
  display_code?: string; // User-editable display short code, e.g. 'ARB', 'MATH101'
  displayCode?: string;
  code?: string; // Alias for display_code
  name: string;
  color: string;
  department: string;
  defaultTeacherId?: string;
  defaultRoomId?: string;
  default_teacher_id?: string | null;
  default_room_id?: string | null;
  default_book?: string | null;
  defaultBookId?: string | null;
  default_book_id?: string | null;
  primary_book_code?: string | null;
  book?: string;
  links?: SubjectLinks;
  pdfLink?: string;
  shoppingLink?: string;
  shoppingLink2?: string;
  siteLink?: string;
}

export interface Book {
  id: string; // Auto-generated unique text ID, e.g. 'bk-math-101'
  display_code?: string;
  displayCode?: string;
  title: string;
  altTitle?: string;
  author?: string;
  publisher?: string;
  edition?: string;
  totalChapters?: number;
  totalPages?: number;
  defaultSubjectId?: string;
  defaultTeacherId?: string;
  links?: BookLink[];
  chapters?: BookChapter[];
}

export interface BookLink {
  id?: string;
  bookId: string;
  type: 'pdf' | 'drive' | 'shopping_tokopedia' | 'shopping_shopee' | 'shopping' | 'site' | string;
  label: string;
  url: string;
  sortOrder?: number;
}

export interface BookChapter {
  id: string; // unique code, e.g. 'chap-bk-math-01'
  bookId: string;
  chapterNumber: number;
  title: string;
  pageStart?: number;
  pageEnd?: number;
  description?: string;
}

export interface Material {
  id: string; // unique code, e.g. 'mat-1'
  bookId: string;
  chapterBookId?: string; // Replaces chapterNumber: Chapter book id (e.g. 'chap-bk-math-01')
  chapterNumber?: number; // legacy fallback
  order: number;
  title: string;
  pageStart?: number | string;
  pageEnd?: number | string;
  part?: number | string; // Jilid / Volume / Part related to chapter/book
  no?: number;
  eno?: number;
  // Aliases for compatibility:
  subjectId?: string;
  subject_id?: string;
  chapter_book_id?: string;
  page_start?: number | string;
  page_end?: number | string;
}

export interface ClassEntity {
  id: string; // Auto-generated unique text ID, e.g. 'cls-10a'
  display_code?: string;
  displayCode?: string;
  name: string;
  grade: number;
  section: string;
  studentCount: number;
  student_count?: number;
  icon?: string;
  color?: string;
  onlineClassLink?: string;
  online_class_link?: string;
  defaultRoomId?: string;
  default_room_id?: string | null;
}

export interface Room {
  id: string; // Auto-generated unique text ID, e.g. 'rm-101'
  display_code?: string;
  displayCode?: string;
  name: string;
  building: string;
  capacity: number;
  type: 'Standard' | 'Science Lab' | 'Computer Lab' | 'Gymnasium' | 'Auditorium' | string;
}

export interface Teacher {
  id: string; // Auto-generated unique text ID, e.g. 'tch-chen'
  display_code?: string;
  displayCode?: string;
  name: string;
  panggilan?: string;
  email: string;
  department: string;
  maxPeriodsPerWeek: number;
  max_periods_per_week?: number;
  color?: string;
  assignedClassIds?: string[];
}

export interface Session {
  id: string; // Auto-generated unique text ID, e.g. 'ses-1'
  display_code?: string;
  displayCode?: string;
  name: string;
  order: number;
  startTime: string; // timeA (e.g. '08:00')
  endTime: string; // timeB (e.g. '10:00')
  sort_order?: number;
  start_time?: string;
  end_time?: string;
}

export interface Period {
  id: string;
  name: string; // e.g. 'Period 1 (Term 1)'
  periodNumber: number;
  startDate: string; // dateA (e.g. '2026-09-01')
  endDate: string; // dateB (e.g. '2026-09-30')
  description?: string;
  period_number?: number;
  start_date?: string;
  end_date?: string;
}

export interface RuleException {
  id: string;
  ruleId: string;
  periodId: string; // The date-range period that triggers this exception
  overrideSessionId?: string; // e.g. 'ses-3' (override time-range session)
  overrideRoomId?: string;
  overrideTeacherId?: string;
  overrideSubjectId?: string;
  note?: string;
  period_id?: string;
  override_session_id?: string;
  override_room_id?: string;
  override_teacher_id?: string;
  override_subject_id?: string;
}

export interface ResolvedSlot {
  ruleId: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  roomId: string;
  sessionId: string;
  day: DayOfWeek;
  periodId: string;
  dateRanges?: { startDate: string; endDate: string }[];
  hasException?: boolean;
  exceptionDetail?: string;
}

export interface ScheduleRule {
  id: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  roomId: string;
  sessionId: string;
  dayOfWeek?: DayOfWeek;
  daysOfWeek?: DayOfWeek[];
  periodIds: string[];
  dateRanges?: { startDate: string; endDate: string }[];
  repeatDetail: 'Weekly' | 'Bi-Weekly' | 'Custom';
  active: boolean;
  exceptions?: RuleException[];
  notes?: string;
  createdAt?: string;

  // Interoperability aliases for SQLite / Python JSON exports
  subject_id?: string;
  class_id?: string;
  teacher_id?: string;
  room_id?: string;
  session_id?: string;
  day_of_week?: string;
  days_of_week?: string[];
  period_ids?: string[];
  repeat_detail?: string;
}

export interface EventLog {
  id: string;
  timestamp: string;
  action: string;
  category: 'rule' | 'database' | 'conflict' | 'system';
  details: string;
}

export type ConflictType = 'teacher' | 'class' | 'room' | 'session';

export interface ScheduleConflict {
  id: string;
  type: ConflictType;
  title: string;
  description: string;
  day: DayOfWeek;
  periodId: string;
  sessionId: string;
  involvedRuleIds: string[];
  severity: 'critical' | 'warning';
  entityName?: string;
  message?: string;
}

export interface ScheduleCell {
  day: DayOfWeek;
  periodId: string;
  sessionId: string;
  isFilled: boolean;
  ruleId?: string;
  subjectId?: string;
  classId?: string;
  teacherId?: string;
  roomId?: string;
  hasException?: boolean;
  exceptionDetail?: string;
  conflicts: ScheduleConflict[];
  slots?: ResolvedSlot[];
}

export type KaldikEventType = 'kbm' | 'holiday' | 'exam' | 'activity' | 'general';

export interface KaldikEvent {
  id: string;
  title: string;
  isKbm?: boolean;
  type: KaldikEventType;
  isAllDay: boolean;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  startTime?: string; // '08:00'
  endTime?: string; // '10:00'
  isRecurring?: boolean;
  daysOfWeek?: DayOfWeek[]; // e.g. ['Monday', 'Thursday']
  repeatDetail?: 'Weekly' | 'Bi-Weekly' | 'Custom';
  periodId?: string; // Associated period ID for KBM or academic terms
  color?: string; // Hex color badge e.g. '#F59E0B'
  description?: string;
  createdAt?: string;
}

export interface DatabaseState {
  subjects: Subject[];
  classes: ClassEntity[];
  rooms: Room[];
  teachers: Teacher[];
  sessions: Session[];
  periods: Period[];
  rules: ScheduleRule[];
  kaldikEvents?: KaldikEvent[];
  books?: Book[];
  materials?: Material[];
  syllabusUnits?: SyllabusUnit[];
  syllabusScopes?: SyllabusScope[];
  students?: StudentRecord[];
  enrollments?: EnrollmentRecord[];
}

export interface StudentRecord {
  id: string;
  nisn?: string;
  name: string;
  gender?: 'L' | 'P';
  phone?: string;
  enrolledClassIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EnrollmentRecord {
  id?: number;
  classId: string;
  studentId: string;
  teacherId?: string;
  academicYear?: string;
  active?: number | boolean;
}

export interface SyllabusUnit {
  id: string;
  bookId?: string; // from book_code
  bookCode?: string;
  chapterBookId?: string; // chapter book id
  chapterNumber?: number;
  subject_id?: string; // dynamically resolved via scope/book or legacy mapel_id
  order: number; // sequential order
  title: string;
  page_start: number | string;
  page_end: number | string;
  part?: number | string;
  no?: number;
  eno?: number;
  isPartialStart?: boolean;
  isPartialEnd?: boolean;
  raw_page_start?: number | string;
  raw_page_end?: number | string;
  display_page_start?: number | string;
  display_page_end?: number | string;
  midpage?: number;
}

export interface SyllabusScopeItem {
  id: string;
  scopeId: string;
  bookId: string;
  chapterBookId?: string;
  chapterNumber?: number;
  startMaterialId?: string;
  endMaterialId?: string;
  sortOrder?: number;
  note?: string;
}

export interface SyllabusPacingAdjustment {
  checkpointSessionIndex: number; // 1-based meetingIndex (e.g. 8)
  checkpointSessionNumber?: number; // displayed session number override from this checkpoint
  checkpointSessionId?: string; // id of scheduled session occurrence
  checkpointDate?: string; // 'YYYY-MM-DD'
  checkpointUnitId: string; // unit id where the teacher is currently at
  checkpointPage: number; // actual page currently reached
  strategy: 'accelerate' | 'cut';
  cutUnitIds?: string[]; // unit IDs to drop/cut from syllabus
  updatedAt?: string;
  notes?: string;
}

export interface SyllabusScope {
  id: string;
  subject_id: string;
  class_section_id: string; // class entity id
  name?: string;
  notes?: string;
  book_ids?: string[]; // Multiple book selection in syllabus scope!
  book_id?: string; // Primary/first book
  start_unit_id?: string; // FK to SyllabusUnit / Material (bridge)
  end_unit_id?: string; // FK to SyllabusUnit / Material (bridge)
  items?: SyllabusScopeItem[]; // Multi-book, multi-chapter scope items
  adjustment?: SyllabusPacingAdjustment;
}

export interface ScheduledSessionOccurrence {
  id: string; // unique identifier: `${date}_${sessionId}_${ruleId}`
  date: string; // 'YYYY-MM-DD'
  day: DayOfWeek;
  sessionId: string; // references Session
  sessionName: string;
  startTime: string;
  endTime: string;
  ruleId: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  roomId: string;
  periodId: string;
  meetingIndex: number; // 1-based index for this subject & class in the term
}

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'ok'; at: string; counts: Record<string, number> }
  | { kind: 'error'; message: string };

// ----------------------------------------------------------------------------
// Attendance (Presensi Terpadu) Types
// ----------------------------------------------------------------------------
export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Terlambat' | 'Alpa';
export type AttendancePersonType = 'student' | 'teacher';

export interface Student {
  id: string;
  nisn?: string;
  name: string;
  gender?: 'L' | 'P';
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceEnrollment {
  id: number;
  classId: string;
  studentId: string;
  teacherId?: string;
  academicYear?: string;
  active: boolean;
  student?: Student;
}

export interface AttendanceMeetingSummary {
  id: string;
  meetingDate: string;
  meetingIndex?: number;
  activeMeetingIndex?: number;
  classId: string;
  className: string;
  classColor?: string;
  classGrade?: number;
  classSection?: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  teacherId: string;
  teacherName: string;
  roomId: string;
  roomName: string;
  sessionId: string;
  sessionName: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  summary: {
    totalEnrolled: number;
    hadirCount: number;
    izinCount: number;
    sakitCount: number;
    terlambatCount: number;
    alpaCount: number;
    teacherStatus?: AttendanceStatus;
  };
}

export interface AttendanceRollCallStudent {
  studentId: string;
  name: string;
  nisn: string;
  gender: 'L' | 'P';
  status: AttendanceStatus | null;
  timestampStart?: string;
  timestampEnd?: string;
  note?: string;
}

export interface AttendanceRollCallTeacher {
  id: string;
  name: string;
  status: AttendanceStatus | null;
  timestampStart?: string;
  note?: string;
}

export interface AttendanceRollCallData {
  meeting: AttendanceMeetingSummary;
  teacher: AttendanceRollCallTeacher;
  students: AttendanceRollCallStudent[];
}

export interface GenerateMeetingsOptions {
  startDate?: string;
  endDate?: string;
  periodId?: string;
  skipHolidays?: boolean;
  overwriteScheduled?: boolean;
}

export interface GenerateMeetingsResult {
  success: boolean;
  totalDaysProcessed: number;
  totalCreated: number;
  totalUpdated: number;
  totalPreserved: number;
  totalSkippedHolidays: number;
  startDate: string;
  endDate: string;
  message: string;
}
