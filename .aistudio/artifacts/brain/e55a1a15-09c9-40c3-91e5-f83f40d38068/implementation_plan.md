# Normalized Schema & Single Source of Truth: `attnd_meeting`

Normalize the Turso (LibSQL) database schema by adding dedicated `actual_materi` and `actual_page` columns to `attnd_meeting`, index them, restore `attnd_meeting.notes` to clean plain-text journal notes (no JSON blobs), deprecate `syllabus_scopes.notes` completely, and ground `SyllabusView` directly on `attnd_meeting`.

---

### Key Architectural Decisions

1. **Schema Normalization in `attnd_meeting`**:
   - `actual_materi TEXT`: Material title or topic taught in the session.
   - `actual_page INTEGER`: Page number reached in the book.
   - `notes TEXT`: Clean, human-readable teacher journal text (no stringified JSON).
   - Index: `CREATE INDEX IF NOT EXISTS idx_meeting_class_subj_progress ON attnd_meeting(class_id, subject_id, actual_page);`
   - Automated backfill: Extract existing JSON blobs in `notes` using SQLite's native `json_extract` to populate `actual_materi` and `actual_page`, cleaning `notes` to plain summary text.
2. **Deprecation of `syllabus_scopes.notes`**:
   - Drop the copy triggers (`trg_sync_scope_notes_update`, `trg_sync_scope_notes_insert`).
   - Remove `notes` from `syllabus_scopes` save/read workflows.
   - `attnd_meeting` becomes the single authoritative source of truth for all sessions, progress markers, and meeting notes.
3. **SyllabusView & Pacing Migration**:
   - `pacingEngine.ts` generates session occurrences from `attnd_meeting` rows for that `(subject_id, class_id)`.
   - Cancelled sessions are rendered with a *"Sesi Dibatalkan"* badge and excluded from pacing count and unit allocation.
   - The timeline calibration point is derived directly from the latest meeting with `actual_page`.

---

### Implementation Steps

#### Step 1: Database Migration (`server/db/schemas.ts` & `server/db/index.ts`)
- In `ensureTursoSchemas()`:
  - Add `ALTER TABLE attnd_meeting ADD COLUMN actual_materi TEXT;`
  - Add `ALTER TABLE attnd_meeting ADD COLUMN actual_page INTEGER;`
  - Add `CREATE INDEX IF NOT EXISTS idx_meeting_class_subj_progress ON attnd_meeting(class_id, subject_id, actual_page);`
  - Execute backfill SQL to migrate existing JSON notes into `actual_materi`, `actual_page`, and clean `notes`.
  - Drop triggers `trg_sync_scope_notes_update` and `trg_sync_scope_notes_insert`.
- In `getDatabaseState()`:
  - Query `attnd_meeting` and include lightweight `meetings: MeetingRecord[]` in `DatabaseState`.
  - Remove subqueries on `syllabus_scopes`.

#### Step 2: Roll Call Save Normalization (`server/db/attendance.ts`)
- In `saveMeetingRollCall`:
  - Write `actual_materi` and `actual_page` as discrete SQL parameters.
  - Write `notes = meetingNotes || null` as clean plain text.
  - Remove any writes or references to `syllabus_scopes.notes`.
- In `getMeetingRollCall` & `getMonthMeetings`:
  - Return `actual_materi` and `actual_page` directly.

#### Step 3: Pacing Engine & SyllabusView (`src/utils/pacingEngine.ts` & `SyllabusTimeline.tsx`)
- In `pacingEngine.ts`:
  - Build sessions from `db.meetings` for that subject and class.
  - Exclude cancelled meetings from pacing division and unit distribution.
  - Calibrate timeline to the latest meeting's `actual_page`.
- In `SyllabusTimeline.tsx`:
  - Render cancelled sessions with a distinct *"Sesi Dibatalkan"* badge.
  - Display the latest meeting's plain text note in the header card if present.

---

### Verification Plan

1. **Schema Check**: Confirm `actual_materi` and `actual_page` exist in `attnd_meeting` via PRAGMA.
2. **Backfill Verification**: Confirm existing meetings have populated `actual_materi` and `actual_page` without JSON in `notes`.
3. **Save Verification**: Save roll call in `AttendanceModal` and confirm discrete columns are stored in Turso.
4. **Timeline & Cancellation**: Confirm `SyllabusTimeline` displays actual meetings, marks cancelled sessions, and excludes them from pace calculations.
