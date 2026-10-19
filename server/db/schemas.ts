// ============================================================================
// Turso Database Schemas (DDL Definitions)
// Split out from server/db/index.ts to keep runtime code lean and efficient.
// Identity: Row identity is 'id TEXT PRIMARY KEY' (auto-generated, uneditable).
// Display: 'display_code TEXT' is user-editable for display badges and short labels.
// ============================================================================

export const METADATA_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    display_code TEXT,
    name TEXT NOT NULL,
    grade INTEGER NOT NULL,
    section TEXT NOT NULL,
    student_count INTEGER NOT NULL DEFAULT 0,
    color TEXT,
    icon TEXT,
    online_class_link TEXT,
    default_room_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classes_grade ON classes(grade);
CREATE INDEX IF NOT EXISTS idx_classes_section ON classes(section);

CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    display_code TEXT,
    name TEXT NOT NULL,
    panggilan TEXT,
    email TEXT,
    department TEXT,
    max_periods_per_week INTEGER NOT NULL DEFAULT 18,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teachers_department ON teachers(department);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    display_code TEXT,
    name TEXT NOT NULL,
    building TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 30,
    type TEXT NOT NULL DEFAULT 'Standard',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(building);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type);

CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    display_code TEXT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    department TEXT NOT NULL,
    default_teacher_id TEXT,
    default_room_id TEXT,
    default_book_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subjects_department ON subjects(department);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON subjects(default_teacher_id);
CREATE INDEX IF NOT EXISTS idx_subjects_default_book ON subjects(default_book_id);

CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    display_code TEXT,
    title TEXT NOT NULL,
    alt_title TEXT,
    author TEXT,
    publisher TEXT,
    edition TEXT,
    total_chapters INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0,
    default_subject_id TEXT,
    default_teacher_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_books_subject ON books(default_subject_id);
CREATE INDEX IF NOT EXISTS idx_books_teacher ON books(default_teacher_id);

CREATE TABLE IF NOT EXISTS book_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'pdf',
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_book_links_book ON book_links(book_id);

CREATE TABLE IF NOT EXISTS book_chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_num INTEGER NOT NULL,
    title TEXT NOT NULL,
    page_start INTEGER,
    page_end INTEGER,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_book_chapters_book ON book_chapters(book_id, chapter_num);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    display_code TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_sort ON sessions(sort_order);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

// Note: In kaldik.db, code columns act as canonical string IDs referencing metadata entity IDs.
export const KALDIK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    period_number INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_periods_number ON periods(period_number);
CREATE INDEX IF NOT EXISTS idx_periods_dates ON periods(start_date, end_date);

CREATE TABLE IF NOT EXISTS kaldik_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    is_kbm INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'general',
    is_all_day INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    period_code TEXT,
    color TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_dates ON kaldik_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_type ON kaldik_events(type);
CREATE INDEX IF NOT EXISTS idx_events_period ON kaldik_events(period_code);

CREATE TABLE IF NOT EXISTS schedule_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    subject_code TEXT NOT NULL,
    class_code TEXT NOT NULL,
    teacher_code TEXT NOT NULL,
    room_code TEXT NOT NULL,
    session_code TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    repeat_detail TEXT NOT NULL DEFAULT 'Weekly',
    active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rules_subject ON schedule_rules(subject_code);
CREATE INDEX IF NOT EXISTS idx_rules_class ON schedule_rules(class_code);
CREATE INDEX IF NOT EXISTS idx_rules_teacher ON schedule_rules(teacher_code);
CREATE INDEX IF NOT EXISTS idx_rules_day ON schedule_rules(day_of_week);

CREATE TABLE IF NOT EXISTS schedule_rule_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER,
    rule_code TEXT NOT NULL,
    period_code TEXT NOT NULL,
    UNIQUE(rule_code, period_code)
);

CREATE INDEX IF NOT EXISTS idx_rule_periods_rule ON schedule_rule_periods(rule_code);
CREATE INDEX IF NOT EXISTS idx_rule_periods_period ON schedule_rule_periods(period_code);

CREATE TABLE IF NOT EXISTS schedule_rule_exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    rule_id INTEGER,
    rule_code TEXT NOT NULL,
    period_code TEXT NOT NULL,
    override_session_code TEXT,
    override_room_code TEXT,
    override_teacher_code TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exceptions_rule ON schedule_rule_exceptions(rule_code);
CREATE INDEX IF NOT EXISTS idx_exceptions_period ON schedule_rule_exceptions(period_code);

CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    book_code TEXT NOT NULL,
    chapter_book_id TEXT,
    order_num INTEGER NOT NULL,
    part INTEGER DEFAULT 1,
    title TEXT NOT NULL,
    page_start INTEGER,
    page_end INTEGER,
    no INTEGER,
    eno INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_materials_book ON materials(book_code);
CREATE INDEX IF NOT EXISTS idx_materials_chapter ON materials(chapter_book_id);
CREATE INDEX IF NOT EXISTS idx_materials_order ON materials(book_code, order_num);

CREATE TABLE IF NOT EXISTS syllabus_scopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    subject_code TEXT NOT NULL,
    class_code TEXT NOT NULL,
    name TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scopes_subject_class ON syllabus_scopes(subject_code, class_code);

CREATE TABLE IF NOT EXISTS syllabus_scope_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope_code TEXT NOT NULL REFERENCES syllabus_scopes(code) ON DELETE CASCADE,
    book_code TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(scope_code, book_code)
);

CREATE INDEX IF NOT EXISTS idx_scope_books_scope ON syllabus_scope_books(scope_code);
CREATE INDEX IF NOT EXISTS idx_scope_books_book ON syllabus_scope_books(book_code);

CREATE TABLE IF NOT EXISTS syllabus_scope_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    scope_code TEXT NOT NULL,
    book_code TEXT NOT NULL,
    chapter_num INTEGER,
    chapter_book_id TEXT,
    start_material_code TEXT,
    end_material_code TEXT,
    sort_order INTEGER NOT NULL DEFAULT 1,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scope_items_scope ON syllabus_scope_items(scope_code);
CREATE INDEX IF NOT EXISTS idx_scope_items_book ON syllabus_scope_items(book_code);
`;

export const ATTENDANCE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    nisn TEXT UNIQUE,
    name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('L', 'P')),
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_nisn ON students(nisn);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);

CREATE TABLE IF NOT EXISTS attnd_enroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
    academic_year TEXT DEFAULT '2025/2026',
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_enroll_class ON attnd_enroll(class_id);
CREATE INDEX IF NOT EXISTS idx_enroll_student ON attnd_enroll(student_id);
CREATE INDEX IF NOT EXISTS idx_enroll_teacher ON attnd_enroll(teacher_id);
CREATE INDEX IF NOT EXISTS idx_enroll_class_active_covering ON attnd_enroll(class_id, active, student_id);

CREATE TABLE IF NOT EXISTS attnd_meeting (
    id TEXT PRIMARY KEY,
    meeting_date TEXT NOT NULL,
    meeting_index INTEGER,
    active_meeting_index INTEGER,
    present_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    enrolled_count INTEGER DEFAULT 0,
    is_logged INTEGER DEFAULT 0,
    target_unit_id TEXT,
    target_unit_title TEXT,
    target_page_range TEXT,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
    room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    rule_code TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meeting_date, class_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_date ON attnd_meeting(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meeting_class_subject ON attnd_meeting(class_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_meeting_teacher ON attnd_meeting(teacher_id);
CREATE INDEX IF NOT EXISTS idx_meeting_date_session_order ON attnd_meeting(meeting_date, session_id, status);
CREATE INDEX IF NOT EXISTS idx_meeting_class_subj_date ON attnd_meeting(class_id, subject_id, meeting_date, status);
CREATE INDEX IF NOT EXISTS idx_meeting_month_lookup ON attnd_meeting(meeting_date, status);

CREATE TABLE IF NOT EXISTS attnd_meeting_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id TEXT NOT NULL REFERENCES attnd_meeting(id) ON DELETE CASCADE,
    person_type TEXT NOT NULL CHECK (person_type IN ('student', 'teacher')),
    person_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Terlambat', 'Alpa')),
    timestamp_start TEXT,
    timestamp_end TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meeting_id, person_type, person_id)
);

CREATE INDEX IF NOT EXISTS idx_log_meeting ON attnd_meeting_log(meeting_id);
CREATE INDEX IF NOT EXISTS idx_log_person ON attnd_meeting_log(person_type, person_id);
CREATE INDEX IF NOT EXISTS idx_log_status ON attnd_meeting_log(status);
CREATE INDEX IF NOT EXISTS idx_log_covering ON attnd_meeting_log(meeting_id, person_type, status);

export const UNIFIED_SCHEMA_SQL = `${METADATA_SCHEMA_SQL}\n${KALDIK_SCHEMA_SQL}\n${ATTENDANCE_SCHEMA_SQL}`;
