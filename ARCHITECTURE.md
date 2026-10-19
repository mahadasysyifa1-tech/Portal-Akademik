# QUICK-ROUTE INDEX & CODEBASE MAP (FOR AI AGENTS & DEVELOPERS)

> **CRITICAL DIRECTIVE FOR AI AGENT**: When modifying or inspecting a feature, go **DIRECTLY** to the target file listed in the table below. **DO NOT** perform broad grep searches or speculative file scans across other directories. Keep edits surgical, localized, and single-pass.

---

## 1. Quick-Route Component & Feature Map

| Feature / UI Element | Primary File Location | Subcomponents / Dependencies |
| :--- | :--- | :--- |
| **Kaldik: Orkestrator Utama** | `src/components/kaldik/KaldikView.tsx` | Menyatukan mode Kalender & Jurnal, data presensi, dan modal |
| **Kaldik: Toolbar & Mode Switch** | `src/components/kaldik/KaldikToolbar.tsx` | `KaldikModeSwitch.tsx`, navigasi bulan, quick action generate |
| **Kaldik: Grid Kalender Bulanan** | `src/components/kaldik/KaldikMonthGrid.tsx` | Render sel hari, event badge, dot status kehadiran |
| **Kaldik: Legenda & Indikator** | `src/components/kaldik/KaldikLegendStrip.tsx` | Filter event, legenda warna, ringkasan sesi bulan |
| **Kaldik: Panel Detail Tanggal** | `src/components/kaldik/KaldikDayPanel.tsx` | Header tanggal terpilih, kontainer agenda / matriks |
| **Kaldik: Agenda Event (Mode Kaldik)** | `src/components/kaldik/KaldikDayAgenda.tsx` | Kartu agenda/event tanggal, edit/delete event |
| **Kaldik: Matriks KBM (Mode Jurnal)** | `src/components/kaldik/KaldikDayMatrix.tsx` | Matriks kelas × sesi, tombol absensi & batal/pulihkan |
| **Kaldik: Baris Silabus per Sesi** | `src/components/kaldik/SlotSyllabusLine.tsx` | Badge kitab, volume, dan rentang halaman KBM |
| **Kaldik: Modal Tambah/Edit Event** | `src/components/kaldik/KaldikEventModal.tsx` | Form event kalender akademik & periode KBM |
| **Presensi: Slide-Over Drawer Roll-Call** | `src/components/attendance/AttendanceModal.tsx` | Slide-over drawer pencatatan kehadiran, steppers sesi ▲/▼, auto-draft live |
| **Presensi: Roster & Enrollment** | `src/components/attendance/EnrollmentView.tsx` | Manajemen santri per kelas (`enrollment/`) |
| **Jadwal: Fixed Block SubGrid** | `src/components/schedule/FixedBlockSubGrid.tsx` | Presentational primitive baris chip kelas per sesi |
| **Studio & Jadwal Mingguan** | `src/components/UnifiedStudio.tsx` | Jadwal master mingguan, audit bentrok KBM |
| **Rule Manager & Aturan KBM** | `src/components/ruleManager/RuleManagerView.tsx` | Pengaturan aturan KBM, slot, guru, dan mapel |
| **Silabus & Pacing Linimasa** | `src/components/SyllabusView.tsx` | Silabus kurikulum, linimasa progres materi |
| **Data Master (Kelas, Guru, Ruang)** | `src/components/EntityManager.tsx` | Manajemen CRUD data entitas sekolah |
| **Data Store: Pending Drafts** | `src/utils/useAttendancePendingStore.ts` | In-memory draft store untuk batch save ke Turso |
| **Data Hook: Presensi Bulanan** | `src/hooks/useMonthMeetings.ts` | Month-at-once data engine & in-memory date index |
| **Data Cache: Roll-Call Client** | `src/utils/rollCallCache.ts` | Cache instan data roll-call per pertemuan |
| **Server: Express API Router** | `server.ts` | Backend API (`/api/attendance/*`, `/api/database/*`) |
| **Server: Data Access & Queries** | `server/db/attendance.ts` | Query SQL Turso untuk `attnd_meeting`, `attnd_meeting_log` |
| **Server: DDL Schemas & Indexes** | `server/db/schemas.ts` | Skema database terpadu Turso LibSQL |

---

## 2. Invariants & Rules

1. **Turso Cloud (LibSQL) is the sole source of truth**:
   - Seluruh data jadwal, kalender akademik, dan presensi disimpan di Turso.
   - Mutasi batch dijalankan secara atomik melalui `client.batch(..., 'write')`.
   - Tidak ada lagi skema cache sekunder redundan (`attnd_month_cache`); rekap bulanan dihitung langsung on-the-fly dari `attnd_meeting`.
2. **Kaldik adalah Single Source of Truth untuk Eksekusi**:
   - Penggabungan Jurnal ke dalam Kaldik telah tuntas.
   - Mode `kaldik` menampilkan kalender event, hari libur, dan periode KBM.
   - Mode `jurnal` menampilkan eksekusi riil jadwal KBM, status presensi santri, dan progres silabus materi.
3. **Draft Architecture (Pending Store)**:
   - Perubahan status (Batal/Pulihkan) atau input absensi pada Kaldik ditampung di `useAttendancePendingStore`.
   - Header menampilkan tombol *Simpan Perubahan* dan melakukan batch flush ke endpoint `/api/attendance/batch-save`.
4. **File Size Budget**:
   - Komponen dipertahankan modular di bawah 300–400 baris.
   - Sub-komponen domain Kaldik dipisah rapi di `src/components/kaldik/`.

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

---

## 4. Kaldik Module Layout

Kaldik dipecah menjadi orkestrator ramping, komponen presentasional modular, dan pure utilities:

```
src/components/kaldik/
├── KaldikView.tsx         # Orkestrator utama, data wiring, dan integrasi modal
├── KaldikToolbar.tsx      # Navigasi bulan, switch mode, dan filter
├── KaldikMonthGrid.tsx    # Grid kalender bulanan, badge event, completion dots
├── KaldikLegendStrip.tsx  # Legenda warna dan statistik sesi bulan
├── KaldikDayPanel.tsx     # Kontainer rincian hari terpilih
├── KaldikDayAgenda.tsx    # Agenda event/kegiatan (Mode Kaldik)
├── KaldikDayMatrix.tsx    # Matriks sesi pelajaran × kelas (Mode Jurnal)
├── SlotSyllabusLine.tsx   # Baris progres silabus kitab & halaman per sesi
├── KaldikEventModal.tsx   # Modal tambah/edit agenda & event akademik
└── KaldikModeSwitch.tsx   # Komponen toggle switch Kaldik vs Jurnal

src/utils/
├── kaldikCalendar.ts      # Pure calendar calculations, day cells, month stats
├── kaldikEventFilter.ts   # Pure event filtering logic (KBM ranges, recurring)
├── kaldikHelpers.ts       # Format tanggal lokal, ID meeting generator
├── kaldikValidation.ts    # Validasi rentang tanggal event KBM
└── useAttendancePendingStore.ts # Hook draft in-memory mutasi presensi
```
