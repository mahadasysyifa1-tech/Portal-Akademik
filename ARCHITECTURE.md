# QUICK-ROUTE INDEX & CODEBASE MAP (FOR AI AGENTS & DEVELOPERS)

> **CRITICAL DIRECTIVE FOR AI AGENT**:
> When modifying or inspecting a feature, go **DIRECTLY** to the target file listed in the table below.
> **DO NOT** perform broad `grep` searches or speculative file scans across other directories.
> Keep edits surgical, localized, and single-pass.

---

## 1. Quick-Route Component & Feature Map

| Feature / UI Element | Primary File Location | Subcomponents / Dependencies |
| :--- | :--- | :--- |
| **Jurnal Kalender & Grid KBM** | `src/components/attendance/JournalCalendar.tsx` | Mounted in `src/components/JournalView.tsx` |
| **Jurnal Sesi & Kartu Pertemuan** | `src/components/attendance/JournalMeetingsAgenda.tsx` | Mounted in `src/components/JournalView.tsx` |
| **Jadwalkan Pertemuan (Admin Modal)** | `src/components/attendance/JournalScheduleModal.tsx` | Triggered from `src/components/JournalView.tsx` |
| **Presensi Roll-Call Modal** | `src/components/attendance/AttendanceModal.tsx` | Used across Journal & Presensi views |
| **Presensi Rekap & Bulanan** | `src/components/attendance/PresensiView.tsx` | In `src/components/attendance/` |
| **Enrollment Santri & Roster** | `src/components/attendance/EnrollmentView.tsx` | In `src/components/attendance/` |
| **Silabus Pacing & Linimasa Sesi** | `src/components/syllabus/SyllabusTimeline.tsx` | Mounted in `src/components/SyllabusView.tsx` |
| **Silabus Pemilihan Pelajaran** | `src/components/syllabus/SyllabusSubjectPicker.tsx` | Mounted in `src/components/SyllabusView.tsx` |
| **Syllabus Scope Modal (Multi-Book)** | `src/components/ruleManager/SyllabusScopeModal.tsx` | Opened via deep-link from Syllabus & RuleManager |
| **Rule Manager & Studio Jadwal** | `src/components/ruleManager/RuleManagerView.tsx` | `SyllabusPanel.tsx`, `MultiBookScopeModal.tsx` |
| **Kaldik (Kalender Akademik)** | `src/components/kaldik/KaldikView.tsx` | `KaldikEventModal.tsx` |
| **Master Data (Guru, Kelas, Ruang)** | `src/components/EntityManager.tsx` | `src/components/database/*` |
| **Pacing Calculation Engine** | `src/utils/pacingEngine.ts` | Calculates meeting pacing, pages, and targets |
| **Database Server Router & Cache** | `server/db/index.ts` | Express server database handlers & in-memory cache |
| **Attendance SQL & Month Cache** | `server/db/attendance.ts` | Turso SQL queries, `attnd_meeting`, `attnd_month_cache` |
| **Turso SQL Schemas & Indexes** | `server/db/schemas.ts` | DDL statements, composite and covering indexes |

---

## 2. Invariants & Rules

1. **Turso Cloud (LibSQL) is the sole source of truth**:
   - Never write to local SQLite files or reintroduce `better-sqlite3`.
   - Writes are atomic batch statements (`client.batch(..., 'write')`).
2. **File Size Budget**:
   - Keep individual components under 300–400 lines.
   - Heavy sub-views (modals, cards, pickers) must be extracted into their domain folder.
3. **Admin Actions**:
   - Administrative mutations (such as "Jadwalkan Pertemuan" or master edits) must be strictly guarded by `isAdmin`.
4. **Fast-Track Prompt Convention**:
   - For fast, cheap AI executions, prompts should specify: `[FILE]`, `[TASK]`, and `[SCOPE]`.

---

## 3. Syllabus & Material Hierarchy

```
Book (books table)
 └── BookChapter (book_chapters table) [id, chapter_num, title, page_start, page_end]
      └── Material / SyllabusUnit (materials table)
           ├── bookId -> Book.id
           ├── chapterBookId -> BookChapter.id
           ├── part -> Jilid / Volume number
           ├── no / eno -> Sequential syllabus order
           └── SyllabusScope (syllabus_scopes table)
                └── Scopes materials to specific class sections & terms
```
