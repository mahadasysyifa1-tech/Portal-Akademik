# Implementation Plan: AttendanceModal DB Reader, H-T-I-A Toggles & Database State Architecture

Enhance `AttendanceModal.tsx` into an explicit, transparent database-reading workstation with unified teacher and student presence toggles (H-T-I-A), amber-dot diff indicators for unsaved changes against database baselines, minimal start/end time tracking with auto-timestamping and flash visual cues, and clear lifecycle semantics for `null`, `blank`, and `no row in DB`.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Summary of Confirmed Decisions & User Feedback Integration:**
> 1. **Unified Teacher & Student Rows (Feedback Addressed)**:
>    - Teacher and student rows behave identically: both default to `null` (unlogged) if no row exists in DB, both use the exact same H-T-I-A toggle strip, both have auto-stamping and manual time adjustment, and both show amber diffs when modified.
> 2. **Toggle Colors & Configuration**:
>    - **H** (Hadir): Green (`bg-emerald-600 text-white`)
>    - **T** (Terlambat): Green tone (`bg-teal-600 text-white`)
>    - **I** (Izin): Red tone (`bg-rose-500 text-white`)
>    - **A** (Alpa): Deep red (`bg-rose-700 text-white`)
>    - Clicking an active toggle deselects it back to `null` (unlogged).
> 3. **Database Diff Indicators & Baseline Display (Feedback Addressed)**:
>    - When a field diverges from the database snapshot, a small amber dot (`•`) appears next to the field, and the original DB value is shown in subtle muted gray (e.g., `DB: H` or `DB: 07:15`).
>    - When re-aligned with DB, the amber dot disappears immediately.
> 4. **Previous Records vs. Manual Adjustment (Feedback Addressed)**:
>    - Saved database records display as neutral gray chips (e.g. `[07:15]`).
>    - Auto-capture (on toggle click) records the current clock time and provides an 800ms flash glow animation.
>    - Clicking the time chip opens an inline micro-picker allowing manual time adjustments, showing the current draft time alongside the original DB timestamp.
> 5. **Jurnal People Count**:
>    - In `KaldikMonthGrid.tsx`, people counts and column diagrams include both `Hadir` and `Terlambat` as present students.

---

## 1. Database Semantics: "No Row" vs. "NULL" vs. "Blank"

A primary source of confusion in attendance tracking is the distinction between database storage, runtime API representation, and modal UI states.

### Architectural Matrix

| State Level | No Row in Database | NULL in Column | Blank String (`""`) |
|---|---|---|---|
| **SQL Schema (`attnd_meeting_log`)** | Absence of any record for `(meeting_id, person_type, person_id)`. Indicates roll call was **never taken** for this person. | **Forbidden for `status`** (Column has `NOT NULL CHECK (status IN ('Hadir', ...))`). <br> **Allowed for `timestamp_start` / `note`** when no time or note was provided. | **Forbidden for `status`**. <br> Converted to SQL `NULL` for timestamps and notes to prevent database pollution. |
| **Server / API Layer** | Represented as `{ status: null, timestampStart: null }` in `MeetingRollCallData`. | Represented as `null` in JSON. | Sanitized to `null` before executing SQL queries. |
| **Modal UI State (`AttendanceModal`)** | No toggle selected (H, T, I, A all inactive). Status is `null`. Time chip shows `--:--`. | Displayed as empty/unassigned. | Empty input field. |

### Lifecycle of Each User Action & Database Writes

```
┌─────────────────────────┬───────────────────────────────┬───────────────────────────────────────────┐
│ User Action in Modal    │ Modal State & Diff Indicator  │ Database Operation on Save                │
├─────────────────────────┼───────────────────────────────┼───────────────────────────────────────────┤
│ 1. Initial Load         │ Reads DB values into baseline │ No write (read-only baseline).            │
│    (Person has no log)  │ Status: null, Time: --:--     │                                           │
├─────────────────────────┼───────────────────────────────┼───────────────────────────────────────────┤
│ 2. Click Toggle (e.g. H)│ Status: 'Hadir'               │ INSERT INTO attnd_meeting_log             │
│                         │ Time: auto-stamped (HH:mm)    │ (meeting_id, person_type, person_id,     │
│                         │ Amber dot + "DB: Kosong"      │  status, timestamp_start) VALUES (...)    │
│                         │                               │ ON CONFLICT DO UPDATE SET status='Hadir'  │
├─────────────────────────┼───────────────────────────────┼───────────────────────────────────────────┤
│ 3. Click Active Toggle  │ Status: null (deselected)     │ DELETE FROM attnd_meeting_log             │
│    (Deselect / Clear)   │ Time: cleared or retained     │ WHERE meeting_id = ?                      │
│                         │ Amber dot + "DB: H"           │   AND person_type = ? AND person_id = ?   │
├─────────────────────────┼───────────────────────────────┼───────────────────────────────────────────┤
│ 4. Change Status (H->T) │ Status: 'Terlambat'           │ UPDATE attnd_meeting_log                  │
│                         │ Amber dot + "DB: H"           │ SET status = 'Terlambat', ...             │
├─────────────────────────┼───────────────────────────────┼───────────────────────────────────────────┤
│ 5. Manual Time Edit     │ Time: edited (e.g. 07:30)     │ UPDATE attnd_meeting_log                  │
│                         │ Amber dot + "DB: 07:15"       │ SET timestamp_start = '07:30'             │
├─────────────────────────┼───────────────────────────────┼───────────────────────────────────────────┤
│ 6. Discard Draft        │ Reverts all fields to DB copy.│ No write. Client state restored.          │
│                         │ All amber dots disappear.     │                                           │
└─────────────────────────┴───────────────────────────────┴───────────────────────────────────────────┘
```

> [!NOTE]
> Previously, `saveMeetingRollCall` only performed `filter(s => !!s.status)`, which ignored deselected students and left orphan rows in the database. In this revision, when a person who previously existed in `baselineSnapshotRef` is set to `status === null`, the server explicitly executes a `DELETE` query to maintain 1:1 parity between the UI and database.

---

## 2. User Experience & Visual Design

### A. Explaining the Diff Indicator Example (Answering Comment 1)

How does the amber dot and gray DB label look in practice without cluttering the compact drawer?

#### Example 1: Student Status Modified
- **Database Stored**: Student Ahmad Fauzi has `status = 'Hadir'` stored in DB.
- **User Action**: Teacher clicks **T** (Terlambat).
- **UI Presentation**:
```
┌────────────────────────────────────────────────────────────────────────┐
│ 1  Ahmad Fauzi Al-Ghifari                          [07:15] [H][T*][I][A]│
│    🟡 DB: Hadir                                                        │
└────────────────────────────────────────────────────────────────────────┘
```
*(The yellow dot `🟡` with `text-[10px] text-slate-400 font-mono` appears compactly beneath the student name. If the user clicks **H** again to match DB, the label and dot vanish completely).*

#### Example 2: Materi & Page Progress Modified
- **Database Stored**: `Bab 1` / `Hal. 12`
- **User Action**: Teacher changes dropdown to `Bab 2` and page to `24`.
- **UI Presentation**:
```
Judul materi 🟡 (DB: Bab 1)                   Hal. 🟡 (DB: 12)
┌────────────────────────────────┐            ┌─────────┐
│ Bab 2 - Thaharah & Wudhu     ▼ │            │ 24      │
└────────────────────────────────┘            └─────────┘
```

### B. Previous Records vs. Manual Adjustment (Answering Comment 2)

How are saved records, auto-stamped values, and manual edits distinguished?

1. **Previous Record (DB Baseline)**:
   - Displayed as a clean, quiet neutral pill: `[ 07:15 ]` (`bg-slate-100 text-slate-600 border border-slate-200`).
   - Indicates: *"This record was previously saved and verified in the database."*

2. **Auto-Capture & Visual Flash**:
   - When any toggle button (H, T, I, A) is clicked:
     - If no time is set, the system captures `new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })` (e.g. `07:22`).
     - The time pill momentarily triggers an **800ms flash animation**:
       `animate-pulse bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400 font-bold`.
     - An amber dot appears beside the pill if it differs from the database baseline.

3. **Manual Adjustment & Review**:
   - Clicking directly on the time chip `[ 07:22 ]` expands a micro-popover or inline time input directly inside the row:
```
┌────────────────────────────────────────────────────────────┐
│ Edit Waktu Kehadiran:                                     │
│ Mulai: [ 07:22 ]   Selesai: [ 08:00 ]                     │
│ ℹ️ Database sebelumnya: 07:15                             │
│ [ Kembalikan ke DB ]  [ Selesai ]                         │
└────────────────────────────────────────────────────────────┘
```
   - This allows users to inspect the exact past DB record, restore it with a single click, or type a custom time without leaving the drawer.

### C. Unified Teacher and Student Row Behavior (Answering Comment 3)

Both Teacher and Student rows share identical logic and visual layout:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Icon] Pengampu: Ustadz Abdullah           [07:00 - --:--]  [H][T][I][A]│
│        🟡 DB: Belum diisi                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ 1  Ahmad Fauzi Al-Ghifari                  [07:15 - --:--]  [H][T][I][A]│
│    🟡 DB: Hadir                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Initial State**: If not logged in DB, both show `status: null` (no button highlighted) and time `--:--`.
- **Toggle Controls**: Both use the same 4-button group:
  - **H**: `bg-emerald-600 text-white` (Green)
  - **T**: `bg-teal-600 text-white` (Green variant)
  - **I**: `bg-rose-500 text-white` (Red variant)
  - **A**: `bg-rose-700 text-white` (Deep Red)
- **Toggling Off**: Clicking the currently active status button deselects it back to `null` for both teacher and students.
- **Diff Tracking**: Both track `baselineSnapshotRef` and display the amber dot if modified.

---

## 3. KaldikView Integration: People Count with Terlambat

In `src/components/kaldik/KaldikMonthGrid.tsx`:
- When computing journal density and attendance counts in `getJurnalCellStats()`:
  - Previously: only counted `Hadir` students: `s.status === 'Hadir'`.
  - Updated: counts both `Hadir` and `Terlambat` students:
    ```ts
    const isPresent = s.status === 'Hadir' || s.status === 'Terlambat';
    ```
  - Reflects accurate classroom reality: late students are physically present and accounted for in the session bar diagram.

---

## 4. Technical Architecture & File Changes

```
┌───────────────────────────────────────────────────────────────┐
│                      KaldikMonthGrid.tsx                      │
│  • getJurnalCellStats(): Hadir + Terlambat in density & count │
└───────────────────────────────┬───────────────────────────────┘
                                │ opens
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                      AttendanceModal.tsx                      │
│  • STATUS_OPTIONS: [H (emerald), T (teal), I (rose), A (red)] │
│  • Unified teacher/student row renderers with time chip       │
│  • Flash animation trigger on auto-timestamping               │
│  • Diff helper: compare current state vs baselineSnapshotRef  │
│  • Amber dot + DB baseline subtitle on diff                   │
└───────────────────────────────┬───────────────────────────────┘
                                │ calls save
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                   server/db/attendance.ts                     │
│  • saveMeetingRollCall():                                     │
│    - Upsert active status logs (H, T, I, A)                   │
│    - Explicit DELETE for deselected logs (status === null)    │
│    - Convert blank strings ("") to NULL in SQL queries        │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. Verification Plan

### Automated Build & Types
1. Run `lint_applet` (`tsc --noEmit`) to verify zero syntax or type regressions.
2. Run `compile_applet` (`npm run build`) to confirm clean client and server compilation.

### User Interaction Testing
1. **Teacher vs. Student Equivalence**:
   - Open a scheduled session where neither teacher nor students have been logged.
   - Verify both teacher and students start with no button selected (`null`) and time `--:--`.
2. **Toggle H-T-I-A**:
   - Click **H** on a row: verifies emerald active state, auto-stamps clock time, triggers green flash.
   - Click **H** again: verifies deselection to `null`, displays amber dot with `DB: (Kosong)`.
   - Click **T**: verifies teal active state.
   - Click **I** or **A**: verifies rose/red active state.
3. **Database Diff Indicators**:
   - Verify amber dot appears only when state diverges from DB snapshot.
   - Verify reverting the value back to original removes the amber dot.
4. **Time Review & Editing**:
   - Click the time chip `[07:15]` to open the micro-editor. Adjust time, verify amber dot reflects `DB: 07:15`.
5. **Kaldik Journal Count**:
   - Mark 2 students as Hadir and 1 student as Terlambat.
   - Confirm the Kaldik journal view shows 3 students in the people count and updates the density bar diagram.
