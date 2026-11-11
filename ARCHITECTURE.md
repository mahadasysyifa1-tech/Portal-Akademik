# ARCHITECTURE SPECIFICATION (MACHINE-READABLE SPEC FOR AI AGENTS & DEVELOPERS)

> **CRITICAL DIRECTIVE FOR AI AGENT**:
> 1. When modifying or inspecting a feature, go **DIRECTLY** to the target file listed in Section 1.
> 2. **DO NOT** perform broad grep searches or speculative file scans across unrelated directories.
> 3. Keep edits surgical, localized, and single-pass. Always read Section 9 (Anti-Pattern Registry) before modifying state, database, or normalization logic.

---

## 1. Quick-Route Component & AST Map

| Domain / Subsystem | Primary File Path | Core Subcomponents & Dependencies | Responsibility / Contract |
| :--- | :--- | :--- | :--- |
| **Kaldik: Orchestrator** | `src/components/kaldik/KaldikView.tsx` | `KaldikToolbar`, `KaldikMonthGrid`, `KaldikDayMatrix`, `KaldikDayAgenda`, `AttendanceModal` | Unified view for Calendar (events) and Journal (KBM matrix, attendance, material status). |
| **Kaldik: Toolbar & Nav** | `src/components/kaldik/KaldikToolbar.tsx` | `KaldikModeSwitch.tsx`, period/category filters, quick actions | Month pagination, mode switching (Kaldik vs Jurnal), and generate meetings trigger. |
| **Kaldik: Monthly Grid** | `src/components/kaldik/KaldikMonthGrid.tsx` | `kaldikCalendar.ts`, `kaldikEventFilter.ts` | 7-column calendar month grid, event badges, completion dots (green/amber). |
| **Kaldik: KBM Day Matrix** | `src/components/kaldik/KaldikDayMatrix.tsx` | `SlotSyllabusLine.tsx`, `useAttendancePendingStore` | Grid of Class × Session for selected date; status toggle (Batal/Pulihkan) and attendance drawer trigger. |
| **Kaldik: Event Agenda** | `src/components/kaldik/KaldikDayAgenda.tsx` | `KaldikEventModal.tsx` | Chronological list of non-KBM / academic events for selected date; edit/delete triggers. |
| **Kaldik: Syllabus Line** | `src/components/kaldik/SlotSyllabusLine.tsx` | `pacingEngine.ts`, `kaldikHelpers.ts` | Displays book, part, and page range for each slot in matrix. |
| **Kaldik: Event Modal** | `src/components/kaldik/KaldikEventModal.tsx` | `kaldikValidation.ts`, `types.ts` | Form to create/edit calendar events; dynamic period range validation. |
| **Attendance: Roll-Call Drawer** | `src/components/attendance/AttendanceModal.tsx` | `useAttendancePendingStore`, `rollCallCache.ts` | Slide-over drawer for teacher & student attendance, start/end material & page steppers. |
| **Attendance: Enrollment** | `src/components/attendance/EnrollmentView.tsx` | `server/db/attendance.ts` (`/api/enrollment/*`) | Student roster, class assignment, active/inactive enrollment toggles. |
| **Syllabus: Timeline & Pacing**| `src/components/SyllabusView.tsx` | `src/components/syllabus/SyllabusTimeline.tsx`, `pacingEngine.ts` | Curriculum progression, Target View vs Adjusted View toggle, cumulative page diff tracking. |
| **Schedule: Studio & Audit** | `src/components/UnifiedStudio.tsx` | `CalendarView.tsx`, `WeekGridView.tsx`, `AdminAuditGrid.tsx` | Weekly timetable grid (Student, Teacher, and Admin Audit views), conflict center. |
| **Rules: Rule Manager Studio** | `src/components/ruleManager/RuleManagerView.tsx` | `RulesDatabaseTab.tsx`, `KaldikEventsDatabaseTab.tsx`, `SyllabusPanel.tsx` | Dual-panel workspace for managing schedule rules, kaldik events, and syllabus scopes. |
| **Master Data: Entity Manager**| `src/components/EntityManager.tsx` | Master CRUD modals (`classes`, `teachers`, `rooms`, `subjects`, `periods`, `books`) | Full entity data management with in-memory validation and Turso persistence. |
| **Data Store: Pending Drafts** | `src/utils/useAttendancePendingStore.ts` | React Hook (in-memory `Map` stores) | Holds uncommitted attendance logs and session status changes before batch flush to Turso. |
| **Data Cache: Roll-Call** | `src/utils/rollCallCache.ts` | In-memory cache with `attendance:saved` event listener | Month-level client roll-call cache to eliminate redundant network fetches. |
| **Engine: Schedule & Conflict**| `src/utils/scheduleEngine.ts` | `dateNormalizer.ts` | `computeResolvedSlots`, `detectConflicts` (teacher/class/room/session overlaps). |
| **Engine: Pacing & Syllabus** | `src/utils/pacingEngine.ts` | `dateNormalizer.ts` | `getScopedUnits`, `computePacingProjection`, `computePacingStatus`, cumulative page math. |
| **Engine: Date Normalizer** | `src/utils/dateNormalizer.ts` | Pure date calculations | `getNormalizedDateRangesForRule`, `normalizeDateRanges`, `checkDateRangesOverlap`. |
| **Hydration & Normalization** | `src/utils/normalize.ts` | Sanitizers & defaults | `normalizeDatabaseState`, `normalizeRule`, `normalizeKaldikEvent`. |
| **Server: Application API** | `server.ts` | Express.js, Vite middleware | API endpoints for database sync, batch attendance, day sessions, and roll-calls. |
| **Server: Turso Data Access** | `server/db/index.ts` | LibSQL client, schemas | `getDatabaseState()`, `saveDatabaseState()`, caching layer. |
| **Server: Attendance Queries** | `server/db/attendance.ts` | LibSQL transactions | `batchSaveAttendance()`, `getMonthMeetings()`, `generateAllRuleMeetings()`. |
| **Server: DDL Schemas** | `server/db/schemas.ts` | Raw SQLite DDL string definitions | Database table declarations, foreign keys, and covering indexes. |

---

## 2. System Architecture & Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PERSISTENCE: TURSO LIBSQL                        │
│  ┌───────────────────────┬───────────────────────┬───────────────────┐  │
│  │    Metadata Domain    │     Kaldik Domain     │ Attendance Domain │  │
│  │ classes, teachers,    │ periods, kaldik_event,│ students, enroll, │  │
│  │ rooms, subjects,      │ schedule_rules,       │ attnd_meeting,    │  │
│  │ books, book_chapters, │ rule_periods, exc,    │ attnd_meeting_log │  │
│  │ sessions              │ materials, scopes     │                   │  │
│  └───────────────────────┴───────────────────────┴───────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ SQL Transaction / Client Batch
┌────────────────────────────────────▼────────────────────────────────────┐
│                   SERVER DATA ACCESS LAYER (server/db/)                 │
│  • server/db/schemas.ts     : Authoritative DDL & indexes               │
│  • server/db/index.ts       : getDatabaseState(), saveDatabaseState()   │
│  • server/db/attendance.ts  : batchSaveAttendance(), month meetings     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ JSON REST API
┌────────────────────────────────────▼────────────────────────────────────┐
│                    EXPRESS BACKEND ENGINE (server.ts)                   │
│  • /api/database (GET/POST)              • /api/attendance/batch-save   │
│  • /api/attendance/day-sessions (GET)    • /api/attendance/month-meetings
│  • /api/attendance/month-rollcalls (GET) • /api/attendance/generate...  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP Fetch
┌────────────────────────────────────▼────────────────────────────────────┐
│                      FRONTEND CLIENT RUNTIME (src/)                     │
│                                                                         │
│  ┌─────────────────────────┐        ┌────────────────────────────────┐  │
│  │ App.tsx (State Core)    │        │ useAttendancePendingStore.ts   │  │
│  │ • db: DatabaseState     ├───────►│ • rollCallDrafts (Map)         │  │
│  │ • isDirty (structural)  │        │ • statusDrafts (Map)           │  │
│  │ • saveDatabase()        │        │ • flushBatchSave() (atomic)    │  │
│  └────────────┬────────────┘        └────────────────┬───────────────┘  │
│               │                                      │                  │
│       ┌───────┴──────────────────────────────┐       │                  │
│       ▼                                      ▼       ▼                  │
│  ┌──────────────────────────────┐       ┌────────────────────────────┐  │
│  │ Domain Engines               │       │ Header.tsx                 │  │
│  │ • scheduleEngine.ts          │       │ • Global Draft Banner      │  │
│  │ • dateNormalizer.ts          │       │ • "Simpan ke Turso"        │  │
│  │ • pacingEngine.ts            │       │ • "Buang Draft"            │  │
│  │ • normalize.ts               │       └────────────────────────────┘  │
│  └────────────┬─────────────────┘                                       │
│               │                                                         │
│       ┌───────┴──────────────────────────────┐                          │
│       ▼                                      ▼                          │
│  ┌──────────────────────────────┐       ┌────────────────────────────┐  │
│  │ KaldikView & Subcomponents   │       │ AttendanceModal.tsx        │  │
│  │ • Mode Kaldik (Event Agenda) │◄─────►│ • Slide-over drawer        │  │
│  │ • Mode Jurnal (KBM Matrix)   │       │ • Start/End material stepp.│  │
│  │ • Monthly grid & dot status  │       │ • Multi-part range detect  │  │
│  └──────────────────────────────┘       └────────────────────────────┘  │
│               │                                      ▲                  │
│               ▼                                      │                  │
│  ┌──────────────────────────────┐                    │                  │
│  │ SyllabusView & Timeline      ├────────────────────┘                  │
│  │ • Target View vs Adjusted    │                                       │
│  │ • Pacing progress calculation│                                       │
│  └──────────────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & DDL Specification (Turso LibSQL)

All tables exist inside the single unified Turso database. Primary keys are canonical string IDs (`TEXT PRIMARY KEY`) or sequential codes (`code TEXT NOT NULL UNIQUE`).

### 3.1 Metadata Domain
- **`classes`**: `id` (PK), `display_code`, `name`, `grade` (INT), `section`, `student_count` (INT), `color`, `icon`, `default_room_id`.
- **`teachers`**: `id` (PK), `display_code`, `name`, `panggilan`, `email`, `department`, `max_periods_per_week` (INT), `color`.
- **`rooms`**: `id` (PK), `display_code`, `name`, `building`, `capacity` (INT), `type`.
- **`subjects`**: `id` (PK), `display_code`, `name`, `color`, `department`, `default_teacher_id`, `default_room_id`, `default_book_id`.
- **`books`**: `id` (PK), `display_code`, `title`, `author`, `publisher`, `edition`, `total_chapters` (INT), `total_pages` (INT), `default_subject_id`.
- **`book_chapters`**: `id` (PK), `book_id` (FK -> books.id ON DELETE CASCADE), `chapter_num` (INT), `title`, `page_start` (INT), `page_end` (INT).
- **`sessions`**: `id` (PK), `display_code`, `name`, `sort_order` (INT), `start_time` (HH:MM), `end_time` (HH:MM).

### 3.2 Kaldik & Rules Domain
- **`periods`**: `id` (INTEGER PK), `code` (TEXT UNIQUE), `name`, `period_number` (INT), `start_date` (YYYY-MM-DD), `end_date` (YYYY-MM-DD), `description`.
- **`kaldik_events`**: `id` (INTEGER PK), `code` (TEXT UNIQUE), `title`, `is_kbm` (0|1), `type` (`'kbm'|'holiday'|'exam'|'activity'|'general'`), `is_all_day` (0|1), `start_date`, `end_date`, `start_time`, `end_time`, `is_recurring` (0|1), `days_of_week` (JSON array), `repeat_detail` (`'Weekly'|'Bi-Weekly'|'Custom'`), `period_code` (FK -> periods.code), `color`, `description`.
- **`schedule_rules`**: `id` (INTEGER PK), `code` (TEXT UNIQUE), `subject_code`, `class_code`, `teacher_code`, `room_code`, `session_code`, `day_of_week`, `repeat_detail` (`'Weekly'|'Bi-Weekly'|'Custom'`), `active` (0|1), `notes`.
- **`schedule_rule_periods`**: `id` (INTEGER PK), `rule_code`, `period_code`, `UNIQUE(rule_code, period_code)`. Junction for multi-period rule binding.
- **`schedule_rule_exceptions`**: `id` (INTEGER PK), `code` (TEXT UNIQUE), `rule_code`, `period_code`, `override_session_code`, `override_room_code`, `override_teacher_code`, `note`.
- **`materials`**: `id` (INTEGER PK), `code` (TEXT UNIQUE), `book_code`, `chapter_book_id`, `order_num` (INT), `part` (INT, volume/jilid), `title`, `page_start` (INT), `page_end` (INT), `no`, `eno`.
- **`syllabus_scopes`**: `id` (INTEGER PK), `code` (TEXT UNIQUE), `subject_code`, `class_code`, `name`, `notes`.
- **`syllabus_scope_books`**: `id` (INTEGER PK), `scope_code`, `book_code`, `sort_order` (INT). Junction for multi-book scope sequencing.
- **`syllabus_scope_items`**: `id` (INTEGER PK), `code` (TEXT UNIQUE), `scope_code`, `book_code`, `chapter_book_id`, `start_material_code`, `end_material_code`, `sort_order` (INT).

### 3.3 Attendance Domain
- **`students`**: `id` (PK), `nisn` (TEXT UNIQUE), `name`, `gender` (`'L'|'P'`), `phone`.
- **`attnd_enroll`**: `id` (INTEGER PK), `class_id` (FK -> classes.id), `student_id` (FK -> students.id), `teacher_id`, `academic_year`, `active` (0|1), `UNIQUE(class_id, student_id)`.
- **`attnd_meeting`**: `id` (PK, format: `mtg-{date}-{classId}-{sessionId}`), `meeting_date` (YYYY-MM-DD), `meeting_index` (INT), `class_id`, `subject_id`, `teacher_id`, `room_id`, `session_id`, `rule_code`, `status` (`'scheduled'|'completed'|'cancelled'`), `actual_materi_id`, `actual_page` (INT), `actual_start_materi_id`, `actual_start_page` (INT), `present_count` (INT), `absent_count` (INT), `enrolled_count` (INT), `is_logged` (0|1), `notes`, `UNIQUE(meeting_date, class_id, session_id)`.
- **`attnd_meeting_log`**: `id` (INTEGER PK), `meeting_id` (FK -> attnd_meeting.id ON DELETE CASCADE), `person_type` (`'student'|'teacher'`), `person_id`, `status` (`'Hadir'|'Izin'|'Sakit'|'Alpa'|'Terlambat'`), `timestamp_start` (HH:MM), `timestamp_end` (HH:MM), `note`, `UNIQUE(meeting_id, person_type, person_id)`.

---

## 4. API Contracts & Transaction Lifecycles

| Endpoint | Method | Input Payload / Query | Output Contract | Transaction Guarantees |
| :--- | :--- | :--- | :--- | :--- |
| `/api/database` | `GET` | None | `DatabaseState` (all 15 tables) | Read snapshot, in-memory cache with 30s TTL. |
| `/api/database/save` | `POST` | `DatabaseState` snapshot | `{ success: true, savedAt: string, counts: Record<string, number> }` | Sequential Turso write for Kaldik and Metadata tables. Verification read-back. |
| `/api/attendance/batch-save` | `POST` | `{ statusUpdates?: PendingStatusUpdate[], rollCallLogs?: PendingRollCallLog[] }` | `{ success: true, updatedCount: number }` | **Single atomic transaction** via `client.batch(statements, 'write')`. Inserts/updates `attnd_meeting`, upserts active logs, and executes `DELETE FROM attnd_meeting_log` for deselected students/teachers. |
| `/api/attendance/day-sessions` | `GET` | `?date=YYYY-MM-DD` | `MeetingSummaryRow[]` | Fast path: returns existing `attnd_meeting` rows. If date has 0 records, lazily generates scheduled slots from active rules. |
| `/api/attendance/month-meetings` | `GET` | `?year=YYYY&month=M` | `MeetingRecord[]` (lightweight list) | Month range query on `attnd_meeting` for fast grid dot indicators. |
| `/api/attendance/month-rollcalls`| `GET` | `?year=YYYY&month=M` | `AttendanceRollCallData[]` | Full roll-call snapshot (meetings + teachers + students) populated into client `rollCallCache`. |
| `/api/attendance/meetings/:id/logs` | `GET` | None | `AttendanceRollCallData` | Single meeting roll-call record with student list and recorded times. |
| `/api/attendance/generate-all-meetings` | `POST` | None | `{ success: true, totalProcessed: number, totalUpserted: number, holidaysSkipped: number, preservedCompleted: number }` | Batch upserts meetings across all periods. Preserves completed sessions; skips non-KBM/holiday dates. |

---

## 5. State Management & Store Rules

### 5.1 Central App State (`App.tsx`)
1. **`db: DatabaseState`**: The client-side database model. Hydrated from `/api/database` on mount and cached in browser `localStorage('school_schedule_db')`.
2. **`isDirty: boolean` (Structural Dirty Flag)**: Tracks changes to structural entities (rules, classes, teachers, subjects, rooms, periods, sessions, kaldikEvents, books, materials, scopes).
3. **`saveDatabase(updater)` Contract**:
   - Compares all 14 structural tables against previous state using deep structural comparison.
   - If **only `meetings` changed** (e.g. attendance edits, material progress), `saveDatabase` updates `db.meetings` in memory **WITHOUT setting `isDirty = true`**.
   - If any structural entity changed, sets `isDirty = true` and updates `localStorage`.

### 5.2 Pending Drafts Store (`useAttendancePendingStore.ts`)
1. **`rollCallDrafts: Map<string, PendingRollCallLog>`**: Staged attendance records, teacher logs, student statuses, and start/end material progress.
2. **`statusDrafts: Map<string, 'scheduled'|'completed'|'cancelled'>`**: Staged meeting status cancellations or restorations.
3. **`pendingCount: number`**: `Set([...statusDrafts.keys(), ...rollCallDrafts.keys()]).size`.
4. **Draft Banner Contract (`Header.tsx`)**:
   - Shows `Perubahan belum disimpan: [draftItems]`.
   - `draftItems` contains `'presensi (N sesi)'` when `pendingCount > 0`.
   - `draftItems` contains `'jadwal/database'` when `isDirty === true`.
   - **"Buang Draft"** button calls `handleDiscardAllDrafts()`, which clears `attendancePendingStore.clearDrafts()` and resets `isDirty = false`.

### 5.3 Client Roll-Call Cache (`src/utils/rollCallCache.ts`)
- Pre-caches month roll-calls to open `AttendanceModal` instantly without network latency.
- Listens to window event `'attendance:saved'` to call `invalidateRollCallCache()`, preventing stale data from lingering in the modal.

---

## 6. Rules & Kaldik Events Architecture

### 6.1 Rule Period Binding & Date Resolution
- Each `ScheduleRule` binds to one or more periods via `periodIds: string[]`.
- `getNormalizedDateRangesForRule(rule, periods)`:
  1. Resolves each `periodId` into `{ startDate, endDate }`.
  2. Merges overlapping or consecutive dates into disjoint intervals via `normalizeDateRanges()`.
  3. Returns disjoint `DateRange[]`.
- `computeResolvedSlots(rules, periods)`:
  - Expands multi-day rules (`daysOfWeek`) into individual slots per day.
  - Carries `dateRanges` for fast conflict checking.
- `detectConflicts(db)`:
  - Buckets slots by `day_sessionId`.
  - For each pair in the same bucket, calls `checkDateRangesOverlap(slotA.dateRanges, slotB.dateRanges)`.
  - Identifies Teacher, Class, Room, and Session conflicts with exact overlapping date spans.

### 6.2 Kaldik Events Mechanics
- **Event Types**:
  - `kbm`: Official teaching term. Dynamically takes its date range live from `periods.find(p => p.id === evt.periodId)`.
  - `holiday`: Non-KBM holiday. Automatically skipped by `generateAllRuleMeetings`.
  - `exam`, `activity`, `general`: School calendar events.
- **Recurrence Specification**:
  - `isRecurring: boolean`, `daysOfWeek: DayOfWeek[]`, `repeatDetail: string`.
  - Filtered by `eventOccursOn(evt, dateStr, dayOfWeek, periods, filters)`.

### 6.3 Rule Exceptions Architecture (Known State)
- `schedule_rule_exceptions` table is persisted in Turso and editable in `RuleForm.tsx`.
- *Architecture Note*: Grid rendering and auto-meeting generation currently use base rule properties; period exception override execution is queued for future unified rules rework.

---

## 7. Pacing & Curriculum Engine

### 7.1 Entity Hierarchy
```
Book (books table)
 └── BookChapter (book_chapters table) [id, chapter_num, title, page_start, page_end]
      └── Material / SyllabusUnit (materials table)
           ├── bookId -> Book.id
           ├── chapterBookId -> BookChapter.id
           ├── part -> Volume / Jilid number (INTEGER, e.g. 1, 2, 3)
           ├── order_num -> Global sequence within book
           └── SyllabusScope (syllabus_scopes table)
                ├── Scopes syllabus to specific subject & class
                └── syllabus_scope_books -> Ordered books for this class
```

### 7.2 Cumulative Page Algorithm (`pacingEngine.ts`)
- For multi-volume books or sequenced books, raw page numbers cannot be subtracted directly (e.g. Volume 2 starts at page 1 again).
- `getCumulativePage(scopedUnits, unitId, pageNum)` computes cumulative linear page offset:
  $$\text{Cumulative Page} = \sum_{i=0}^{\text{unitIdx}-1} (\text{page\_end}_i - \text{page\_start}_i + 1) + (\text{pageNum} - \text{page\_start}_{\text{unitIdx}} + 1)$$
- Used by `computePacingStatus` to calculate exact progress differential:
  $$\text{diff} = \text{Cumulative Page}_{\text{actual}} - \text{Cumulative Page}_{\text{target}}$$
  - `diff < 0`: **Tertinggal** (Behind schedule by $|diff|$ pages).
  - `diff > 0`: **Mendahului** (Ahead of schedule by $diff$ pages).
  - `diff === 0`: **Sesuai Target** (On track).

### 7.3 Target View vs Adjusted View (`SyllabusTimeline.tsx`)
- **Adjusted View**: Shows real KBM execution, reflecting cancelled sessions (grayed out with `Ban` icon), actual pages recorded, and shifted pacing.
- **Target View**: Shows pure baseline curriculum distribution as planned before any cancellations or attendance entries. Sequential meeting numbers (#1, #2, #3...) rearrange without gaps.

---

## 8. Attendance Drawer (`AttendanceModal.tsx`) Mechanics

1. **Multi-Part Safe Stepping**:
   - `findUnitForPageWithPartPriority(pageNum, preferredPart)` ensures stepping page 100 in Volume 3 stays within Volume 3 and does not jump to Volume 1 or 2 unless crossing boundary.
   - Stepper buttons (`ChevronUp`, `ChevronDown`, `SkipBack`, `SkipForward` with `rotate-90`) highlight with amber ring when at boundary (`isAtRangeMax`, `isAtRangeMin`) to indicate material transition.
   - On material transition, `triggerMaterialFlash('start' | 'end')` pulses the material dropdown to notify the user.
2. **Invalid Time Prevention**:
   - `resolveTimes(start, end)` enforces `start < end`. If start $\ge$ end, automatically resets to schedule default times (`data.meeting.startTime` / `endTime`).
3. **Auto-Save Draft Serialization**:
   - `serializeState()` produces canonical JSON array of normalized scalar values.
   - Reverting inputs to baseline automatically cleans the pending draft without requiring manual trash click.

---

## 9. Known Pitfalls & Anti-Pattern Registry (DO NOT REPEAT)

| Anti-Pattern / Pitfall | Why It Breaks The System | Enforced Rule |
| :--- | :--- | :--- |
| **Omitting start fields in `normalize.ts`** | `normalizeDatabaseState` mapping `meetings` without `actual_start_materi_id` and `actual_start_page` wipes out start material progress on every `/api/database` sync. | Always map `actual_start_materi_id` and `actual_start_page` in `normalize.ts`. |
| **Omitting `DELETE` in `batchSaveAttendance`** | Filtering only `loggedStudents` on student logs leaves deselected students in `attnd_meeting_log`. When reloaded, unselected students reappear as 'Hadir'. | Always emit `DELETE FROM attnd_meeting_log` when `s.status` is null/empty in batch save. |
| **Marking `isDirty = true` on `meetings` update** | Updating local meeting cache (e.g. from attendance modal) triggers `isDirty = true`, permanently showing `'jadwal/database'` unsaved draft notification in header. | `saveDatabase` must compare all 14 structural tables; if only `meetings` changed, update state without setting `isDirty`. |
| **Wrapping `onUpdateDb` with `(updater) => saveDatabase(updater(db))`** | Evaluates functional updater against stale closure `db`, breaking referential equality and triggering false `isDirty = true`. | Pass `onUpdateDb={saveDatabase}` directly to views so updater receives current state in `setDb(prev)`. |
| **Detaching `AttendanceModal` from `SyllabusView`** | User explicitly instructed to keep `AttendanceModal` embedded directly in `SyllabusView` for 1-click attendance editing from timeline cards. | Keep `AttendanceModal` wired directly inside `SyllabusView.tsx`. Do not remove or convert to external deeplink redirect. |
| **Leaving `rollCallCache` without invalidation** | After saving attendance, opening the modal again returns stale cached roll-call data without querying fresh logs. | Invalidate `rollCallCache` on `attendance:saved` window event. |
| **Using `window.alert` or `window.open`** | Application runs inside an iframe dev environment where native alerts and popups are blocked or disrupt UX. | Use in-app confirmation modals or toast banners. |
