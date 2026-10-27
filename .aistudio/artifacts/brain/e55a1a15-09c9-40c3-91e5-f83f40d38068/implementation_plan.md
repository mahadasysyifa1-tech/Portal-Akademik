# SyllabusTimeline Inspection, Action Deprecation & Pacing Indicator

Streamline `SyllabusTimeline.tsx` into a focused, pure read-only progress tracking view by deprecating administrative action buttons, transforming calibration highlights into a minimal icon next to "Materi Target", and introducing a clear header summary comparing actual recorded page progress against target page expectations.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user:
> - **Pacing Indicator Placement**: Only as a summary indicator in the header card (not cluttered across individual session cards).
> - **Pacing Metric Calculation**: Difference in pages between the most recent recorded actual page and the expected target page (`actualPage - targetPage`).
> - **Action Deprecation**: Retain breadcrumb navigation (`Pelajaran / [Subject] / [Class]`), while completely deprecating and removing all admin action buttons (`Kalibrasi Laju`, `Ubah Rentang Silabus`, admin login triggers, and in-card external link buttons).
> - **Calibration Indicator Style**: Replace bulky "Terkalibrasi" badges with a minimal, unhighlighted icon (e.g. `SlidersHorizontal` with tooltip) placed quietly right next to the "Materi Target:" label.

---

## 1. Overview & Core Concept

- **What It Does**: Presents a clear, clean, and distraction-free timeline of syllabus pacing. Teachers, students, and administrators can immediately see the schedule and verify whether classroom delivery is ahead, behind, or on track without encountering administrative configuration buttons or overwhelming badges.
- **Target Audience**: Teachers and academic coordinators reviewing class progress against the syllabus.
- **Key Value**: Instant clarity on class pacing with minimal visual noise and zero lingering deprecated actions.

---

## 2. User Experience & Visual Design

### Pacing Summary Indicator in Header
Located in the sticky top header card, beside the existing session/chapter counts:
- **Ahead of Schedule (`diff > 0`)**: Emerald accent (`+X Hal Lebih Cepat`).
- **Behind Schedule (`diff < 0`)**: Rose / Amber accent (`-X Hal Tertinggal`).
- **On Track (`diff === 0`)**: Slate / Emerald subtle accent (`Tepat Target`).
- **No Progress Recorded Yet**: Muted neutral state (`Belum Ada Catatan Progres`).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Pelajaran / Bahasa Arab / Kelas 7A                                        │
│                                                                             │
│ Total: 24 Pertemuan • Cakupan: 6 Bab • Total Halaman: 120 Hal               │
│ Target: ±5 Hal / Sesi   [ +4 Hal (Lebih Cepat) • Sesi #5 ]                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Minimal Calibration Indicator
- Remove prominent "Terkalibrasi" amber badges and commented checkpoint banners.
- When `isAdjusted` is true for a given session, render a clean, understated icon:
  `Materi Target: <SlidersHorizontal className="w-3 h-3 text-slate-400 inline-block ml-1" title="Laju disesuaikan dari kalibrasi guru" />`
- Keeps the session card typography clean and uncluttered according to anti-slop guidelines.

### Deprecating Actions
- Remove:
  1. Top header "Kalibrasi Laju" button (`onNavigateToSyllabusScope`).
  2. Top header "Ubah Rentang Silabus" button (`onNavigateToRuleManager`).
  3. Top header "Masuk admin untuk kalibrasi laju" button (`onOpenAdminLogin`).
  4. Top header "Telah Disesuaikan Guru" pill badge.
  5. In-card current session external link button (`onNavigateToSyllabusScope`).
- Retain:
  1. Breadcrumb navigation buttons to navigate back to Subjects or Classes.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Header-Only Pacing Summary**
  - *Chosen Approach*: Compute pacing variance once based on the latest recorded meeting (`actual_page`) against its corresponding session target `page_end`.
  - *Why*: Prevents repetitive badge clutter on every past session card while giving immediate status at a glance.
  - *Alternatives Considered*: Showing badge on every row was rejected to avoid visual redundancy.

- **Decision 2: Quiet Icon Beside "Materi Target"**
  - *Chosen Approach*: Inline 12px neutral icon (`SlidersHorizontal`) with tooltip.
  - *Why*: Fulfills the explicit user requirement ("Kalibrasi indicator should only be minimal not highlighted, just make a tiny icon illustrating adjusted next to 'Materi Target'").

- **Decision 3: Complete Removal of Admin Action Triggers**
  - *Chosen Approach*: Strip out unused callbacks and buttons in `SyllabusTimeline.tsx`. Keep parent props clean.
  - *Why*: Eliminates accidental navigation from the review timeline and enforces single-responsibility for this screen.

---

## 4. Technical Architecture & Implementation Steps

```
SyllabusTimeline.tsx
├── Breadcrumb Navigation (Active, retains onBackToSubjects / onBackToClasses)
├── Header Summary
│   ├── Total Sessions, Scoped Chapters, Total Pages
│   ├── Target Pages / Session
│   └── [NEW] Pacing Status Badge (+X Hal Lebih Cepat / -X Hal Tertinggal / Tepat Target)
└── Timeline Session Cards
    ├── Meeting # and Timing Details (Clean metadata, no admin external link)
    └── Material Column
        ├── Label: "Materi Target:" [NEW: + Tiny SlidersHorizontal Icon if isAdjusted]
        └── Unit List (Read-only, clean book metadata & page span)
```

### Implementation Checklist
1. **Calculate Pacing Difference in `SyllabusTimeline.tsx`**:
   - Find latest session in `pacingData.projection` where `session.actual_page && session.actual_page > 0`.
   - Compare `session.actual_page` with target end page (`item.units[item.units.length - 1]?.page_end`).
   - Derive difference: `diff = actualPage - targetEndPage`.
   - Render pacing pill in the header metadata row.
2. **Remove Deprecated Actions**:
   - Remove header action buttons container (lines 137–192).
   - Remove card-level external link button (lines 415–432).
   - Clean up unused imports (`CheckCircle2` if only used in deprecated badges, etc.).
3. **Minimize Calibration Indicator**:
   - Remove the `Terkalibrasi` pill badge from lines 395–403.
   - Insert `<SlidersHorizontal className="w-3 h-3 text-slate-400 inline ml-1" />` next to `"Materi Target:"` when `isAdjusted` is true.
4. **Compile & Lint Check**:
   - Run `compile_applet` and `lint_applet` to verify clean build without broken props or unused variables.
