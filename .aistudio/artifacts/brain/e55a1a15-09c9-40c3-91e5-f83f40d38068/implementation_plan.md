# Revised Implementation Plan: Symmetrical Split-Pane Layout for KaldikView

## 1. Executive Summary & Design Vision

This plan re-architects **KaldikView** (both **Mode Kaldik** and **Mode Jurnal**) into a unified, **symmetrical desktop split-pane (38% Left / 62% Right)** with a sleek visual language, zero header clutters, and ultra-ergonomic mobile interactions.

### Key Refinements from User Feedback
1. **Jurnal Day Cell Visual Design (Double Visualization, Zero Text Clutter)**:
   - **Center Zone**: A minimal **column diagram chart** illustrating total people attendance density and trend for that day across all classes/sessions (purely visual height bars without noisy number counters).
   - **Footer Zone**: The **responsive stacked horizontal progress bar** representing meetings status (Emerald = completed, Amber = scheduled, Slate = cancelled), **replacing the text session count entirely**.
2. **Kaldik Day Cell Visual Design**:
   - **Center Zone**: Colored event pills (libur, ujian, kegiatan).
   - **Footer Zone**: Event count pill (`N Agenda` / `Libur`).
3. **Mobile 7-Day Strip with Edge-Stepping Arrows**:
   - Tapping any date in the full calendar collapses the grid into a minimal **7-day week strip**.
   - Features **tiny `<` and `>` arrow buttons at both ends** to step to the previous or next day. If the user steps past the edge of the week (e.g. from Sunday to Monday or vice versa), the strip automatically shifts to the adjacent week!
   - Tapping the active selected date deselects it and expands back to the full 5-week month calendar.
4. **Header-less Right Workspace**:
   - No redundant date headers or title banners. The right pane dives **straight into the active detail** (`KaldikDayAgenda` in Kaldik mode; `KaldikDayMatrix` in Jurnal mode).
5. **Slide-Over Attendance Drawer with Up/Down Steppers**:
   - Opens from the right edge with a smooth backdrop blur.
   - Header features simple **icon-only navigation with zero text clutter**:
     - `ChevronUp` (▲ Previous session in the daily timeline)
     - `ChevronDown` (▼ Next session in the daily timeline)
     - `X` (Close drawer)
6. **No Duplicate Mode Switch**:
   - The toolbar skips the mode switch because `Header.tsx` already controls it globally.

---

## 2. Desktop Symmetrical Split-Pane Architecture (`lg+`)

Both modes share the identical container layout with a **38% Left / 62% Right** grid ratio:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: Bulan/Tahun Navigation | Filter Periode & Event (No duplicate Mode Switch)    │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│ LEFT PANE (38% Width, Sticky)            │ RIGHT PANE (62% Width, Scrollable Canvas)   │
│                                          │                                             │
│ ┌──────────────────────────────────────┐ │ ┌─────────────────────────────────────────┐ │
│ │ Unified Month Calendar Grid          │ │ │ STRAIGHT TO DETAIL PANE (Zero Header):  │ │
│ │ • Identical box size in both modes   │ │ │ • If Mode Kaldik:                       │ │
│ │ • Mode Kaldik: Event chips + count   │ │ │     KaldikDayAgenda (Event cards & CRUD)│ │
│ │ • Mode Jurnal: Column Chart + Bar    │ │ │ • If Mode Jurnal:                       │ │
│ ├──────────────────────────────────────┤ │ │     KaldikDayMatrix (Sesi × Kelas,      │ │
│ │ Legend Strip & Monthly Stats         │ │ │     Silabus & Tombol Presensi)          │ │
│ └──────────────────────────────────────┘ │ └─────────────────────────────────────────┘ │
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 3. Calendar Day Cell Rendering Specification

```tsx
// Unified Day Cell Layout
<button
  type="button"
  onClick={() => handleCellClick(d.dateStr)}
  className={`day-cell min-h-[78px] p-2 rounded-xl border flex flex-col justify-between transition-all ...`}
>
  {/* Top Row: Date Number & Quick Indicators */}
  <div className="flex items-center justify-between">
    <span className={`text-xs font-bold leading-none ${d.isToday ? 'w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center' : ''}`}>
      {d.dayNumber}
    </span>
    {mode === 'jurnal' && hasDraft && (
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Perubahan draft belum disimpan" />
    )}
  </div>

  {/* Center Zone */}
  {mode === 'kaldik' ? (
    <div className="space-y-1 my-1">
      {d.events.slice(0, 2).map((evt) => (
        <div key={evt.id} className="text-[10px] font-semibold truncate px-1 rounded" style={{ ... }}>
          {evt.title}
        </div>
      ))}
      {d.events.length > 2 && <span className="text-[9px] text-slate-400">+{d.events.length - 2}</span>}
    </div>
  ) : (
    /* Jurnal Mode: Column diagram chart of total attendance density */
    <div className="my-1 flex items-end justify-center gap-1 h-6 px-1">
      {attendanceDensityBars.map((heightPercent, idx) => (
        <div
          key={idx}
          style={{ height: `${heightPercent}%` }}
          className={`w-1.5 rounded-t-xs transition-all ${
            isAllCompleted ? 'bg-emerald-400' : isPartiallyCompleted ? 'bg-amber-400' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  )}

  {/* Footer Zone */}
  <div className="pt-1 border-t border-slate-100 flex items-center justify-between w-full">
    {mode === 'kaldik' ? (
      <span className="text-[10px] text-slate-500 font-medium truncate">
        {holidayEvent ? 'Libur' : d.events.length > 0 ? `${d.events.length} Agenda` : '—'}
      </span>
    ) : (
      /* Jurnal Mode: Stacked Horizontal Progress Bar replacing text count */
      totalMeetings > 0 ? (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5" title={`${done}/${totalMeetings} Pertemuan Selesai`}>
          {done > 0 && <div style={{ width: `${(done / totalMeetings) * 100}%` }} className="bg-emerald-500 h-full" />}
          {pending > 0 && <div style={{ width: `${(pending / totalMeetings) * 100}%` }} className="bg-amber-400 h-full" />}
          {cancelled > 0 && <div style={{ width: `${(cancelled / totalMeetings) * 100}%` }} className="bg-slate-300 h-full" />}
        </div>
      ) : (
        <span className="text-[10px] text-slate-300">—</span>
      )
    )}
  </div>
</button>
```

---

## 4. Mobile 7-Day Strip with Edge-Stepping Arrows (`< lg`)

When a date is selected on mobile, the calendar snaps into an ultra-slim horizontal strip:

```
┌────────────────────────────────────────────────────────────────────────┐
│ [◀]  Sen 14  •  Sel 15  •  [Rab 16]  •  Kam 17  •  Jum 18  •  Sab 19  [▶]│
└────────────────────────────────────────────────────────────────────────┘
```

### Navigation Behavior:
- **`[◀]` (Previous Day)**: Moves selected date by `-1`. If current date is Monday, automatically slides the week window to the previous week's Sunday.
- **`[▶]` (Next Day)**: Moves selected date by `+1`. If current date is Sunday, automatically slides the week window to the next week's Monday.
- **Tap Active Date Again**: Deselects the date and expands back to the full 5-week month calendar.
- Minimal height (~50px), leaving **85%+ of smartphone screen** dedicated directly to the detail pane.

---

## 5. Slide-Over Attendance Drawer (`AttendanceDrawer.tsx`)

Replaces the full-screen modal with a slide-over panel on the right:
- **Dimensions**: `fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] md:w-[560px] bg-white shadow-2xl flex flex-col`.
- **Icon-Only Header**:
  ```tsx
  <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
    <div className="flex items-center gap-2">
      {/* Up/Down session steppers with no text clutters */}
      <button onClick={handlePrevSession} disabled={!hasPrevSession} className="p-1.5 rounded-lg border hover:bg-white text-slate-600 disabled:opacity-30">
        <ChevronUp className="w-4 h-4" />
      </button>
      <button onClick={handleNextSession} disabled={!hasNextSession} className="p-1.5 rounded-lg border hover:bg-white text-slate-600 disabled:opacity-30">
        <ChevronDown className="w-4 h-4" />
      </button>
      <span className="text-xs font-bold text-slate-700 ml-1">
        {sessionName} • {className}
      </span>
    </div>
    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
      <X className="w-4 h-4" />
    </button>
  </div>
  ```
- **Content**:
  - Target syllabus material, book title, and page range.
  - Teacher attendance toggle (`Hadir`, `Izin`, `Sakit`, `Alpa`).
  - Student roll call roster cards with 1-click status pills.
  - Sticky bottom action bar with `[Simpan ke Draft]` and `[Batal]`.

---

## 6. Implementation Steps & File Changes

| Step | Component | Planned Changes |
| :--- | :--- | :--- |
| **1** | `KaldikToolbar.tsx` | Remove the duplicate `KaldikModeSwitch` control. |
| **2** | `KaldikMonthGrid.tsx` | Integrate: (a) Jurnal center column diagram chart, (b) Jurnal footer stacked horizontal progress bar, (c) Kaldik event count footer, (d) Mobile 7-day strip with edge-stepping `<` and `>` arrow buttons. |
| **3** | `KaldikView.tsx` | Apply symmetrical `38% / 62%` desktop split grid. Remove all day header banners to go straight to `KaldikDayAgenda` / `KaldikDayMatrix`. |
| **4** | `AttendanceDrawer.tsx` | Create/adapt slide-over drawer with `ChevronUp` / `ChevronDown` icon-only session navigation. |

---

## 7. Ready for Implementation

Everything is aligned with your exact instructions. Click **Proceed** to start executing!
