# Master Plan: Penggabungan Jurnal ke Kaldik (Revisi Sisa Eksekusi)

Rencana kerja ini difokuskan langsung pada sisa eksekusi penggabungan modul Jurnal KBM ke dalam Kalender Akademik (Kaldik). Tahap 1 (Mode Switch dan Modularisasi Komponen) telah selesai dan lulus verifikasi kompilasi.

---

## 🔍 Arsitektur: Perbedaan `FixedBlockSubGrid` pada Jadwal (Schedule) vs Jurnal (Kaldik)

> **Pertanyaan & Catatan Pengguna**: *"Apa perbedaan antara FixedBlockSubGrid di sini dan di Jadwal? Layoutnya identik, tapi di sini tampak memanggil yang ada di sana dan menambahkan banyak hal. Apa itu? Apakah sumber datanya berbeda? Apakah keduanya mengambil dari data yang sama?"*

### 1. Komponen yang Digunakan: **100% Komponen yang Sama**
Komponen `FixedBlockSubGrid` di `src/components/schedule/FixedBlockSubGrid.tsx` adalah sebuah **shared presentational primitive** yang dapat dipakai berulang. Komponen ini menerima daftar chip kelas, status warna, tooltip, serta flag opsional `attendanceStatus` dan `isDraft`.

### 2. Perbandingan Karakteristik: Jadwal vs Jurnal

| Aspek | Di Modul Jadwal (`AdminAuditGrid` / `AdminEditGrid`) | Di Modul Jurnal (`KaldikDayMatrix`) |
| :--- | :--- | :--- |
| **Konteks** | **Template Master Mingguan** (Aturan Jadwal Tetap KBM) | **Eksekusi Riil Harian** (Pelaksanaan KBM pada Tanggal Kalender Tertentu) |
| **Dimensi Grid** | Matriks 2 Dimensi: Baris = Sesi, Kolom = Hari (Senin s.d. Ahad). | Baris = Sesi pada **1 tanggal spesifik** (misal: *15 Oktober 2026*). |
| **Sumber Data 1 (Jadwal)** | `db.scheduleRules` (Aturan pola mingguan berulang). | `selectedDayData.classSlots` (Pola mingguan yang dipetakan ke tanggal kalender aktif). |
| **Sumber Data 2 (Eksekusi)** | ❌ **Tidak ada**. Tidak mengenal tanggal atau presensi. | ✅ **Ada**. Data riil dari tabel `meetings` & `attendance` (apakah sesi terlaksana, dibatalkan, atau sudah diabsen). |
| **Informasi Tambahan pada Chip** | Hanya Mapel, Guru, Ruangan, dan indikator bentrok jadwal (`hasException`). | Menambahkan: **Status Presensi** (`scheduled`, `completed`, `cancelled`), indikator **Draft Belum Simpan**, dan progres silabus materi. |
| **Aksi Klik Chip** | Membuka modal edit aturan jadwal tetap / audit bentrok. | Membuka **AttendanceModal** (catat absensi santri) atau **Batal/Pulihkan Sesi**. |

### 3. Apakah Mengambil dari Data yang Sama?
* **Untuk struktur jadwal dasar** (daftar kelas, sesi jam, mapel, guru, ruangan): **YA, keduanya membaca dari `DatabaseState` yang sama**.
* **Untuk data status kehadiran & eksekusi sesi**: **BERBEDA**. Jadwal murni membaca aturan statis (`scheduleRules`), sedangkan Jurnal memadukan aturan statis tersebut dengan rekaman dinamis tabel `meetings` (data kehadiran per tanggal dari Turso).

> **💡 Temuan Menarik pada Kode**: Komponen `FixedBlockSubGrid.tsx` **sudah memiliki implementasi badge minimalis** bawaan (badge centang hijau `✓` untuk selesai, silang merah `✕` untuk batal, dan dot amber berkedip untuk draft). Jadi kita **tidak perlu menduplikasi komponen atau membuat CSS baru**, cukup memasok data `attendanceStatus` dan `isDraft` yang sinkron dari Turso & Pending Store!

---

## 🗺️ Roadmap Sisa Eksekusi (2 Tahap Terpadu)

```
[Tahap 1: Data Engine, Pending Store & Matrix Interactivity] ──> [Tahap 2: Cleanup, Reroute & Cutover]
- Month-at-Once Pre-fetch (Turso Cache)                         - Hapus JournalView & file mati
- Wire attendanceStatus & isDraft ke FixedBlockSubGrid          - Reroute Home -> Kaldik (Jurnal)
- Pending Store (Draft Mutasi In-Memory)                        - Update Navigasi & ARCHITECTURE.md
- Batal / Pulihkan Sesi Langsung dari Sel                       - Verifikasi Kompilasi (tsc)
- AttendanceModal Klik Sel Matriks
- Header Save Flush (Atomic Batch Turso)
```

---

## ⚡ Tahap 1: Data Engine, Pending Store & Interaktivitas Matriks

### 1. Month-at-Once Data Engine & Pre-fetch
* **Endpoint Server**: `/api/attendance/month-meetings?year=...&month=...`
  * Mengambil seluruh data sesi KBM dan ringkasan kehadiran 1 bulan kalender penuh dalam 1 request ringan (~120–180 KB JSON).
  * Menghilangkan round-trip per klik: beralih tanggal kalender berjalan instan (**0ms latency**) tanpa query jaringan baru.
* **Client In-Memory Cache**: Diindeks ke `Map<dateStr, MeetingSummaryRow[]>`.

### 2. Koneksi Data Sesi ke `FixedBlockSubGrid` (Badge Otomatis Aktif)
* Mengalirkan `attendanceStatus` dan `isDraft` dari hasil pencocokan `(date, classId, sessionId)` ke `getStateFn` di `KaldikDayMatrix`:
  * 🟢 **Completed**: Centang hijau di sudut chip (`✓`), menandakan presensi sudah selesai dicatat.
  * ⚪ **Scheduled**: Tampilan default mapel standar.
  * ⚫ **Cancelled**: Badge merah (`✕`), warna chip meredup dan teks dicoret.
  * 🟡 **Draft**: Ring amber berkedip menandakan ada perubahan lokal yang belum disimpan ke server.

### 3. Pending Store (Draft Architecture)
* State terpusat untuk menampung perubahan sebelum disimpan permanen ke database:
  * Pembatalan / pemulihan sesi tanggal tertentu.
  * Hasil input absensi santri dari AttendanceModal.
* Komponen Header membaca `pendingCount` dan menampilkan tombol *"Simpan Perubahan"*.
* Proteksi browser `beforeunload` aktif jika ada draft yang belum disimpan.

### 4. Attendance Modal Langsung dari Sel Matriks
* Mengklik sel sesi aktif langsung membuka `AttendanceModal` untuk kelas & sesi pada tanggal tersebut.
* Modal membaca data dari draft Pending Store terlebih dahulu jika sudah diubah lokal, atau dari server jika belum.
* Menyimpan di modal langsung mencatat ke Pending Store dan mengupdate visual chip menjadi draft tanpa reload.

### 5. Atomic Batch Save ke Turso (`/api/attendance/batch-save`)
* Menjalankan seluruh mutasi antrean Pending Store menggunakan single atomic transaction `client.batch(statements, 'write')`.
* Menjamin konsistensi data tanpa partial failure.

---

## 🧹 Tahap 2: Pembersihan File, Rerouting & Final Cutover

### 1. Penghapusan Komponen Usang & Dead Files
* Hapus file jurnal lama:
  * `src/components/JournalView.tsx`
  * `src/components/attendance/JournalCalendar.tsx`
  * `src/components/attendance/JournalMeetingsAgenda.tsx`
* Hapus file mati yang terbukti tidak digunakan:
  * `src/components/attendance/PresensiView.tsx`
  * `src/components/attendance/GenerateMeetingsModal.tsx`
  * `src/components/kaldik/KaldikDaySummaryModal.tsx`

### 2. Penyatuan Navigasi & Deep-Link
* Hapus tab "Jurnal" mandiri dari `Header.tsx` dan `App.tsx`.
* Arahkan semua tautan cepat dari `HomeTab` (*"Buka Jurnal Hari Ini"*, *"Presensi Sesi Aktif"*) ke tab Kaldik dengan mode aktif `jurnal` (`initialMode="jurnal"`).
* Update `routing.ts` agar URL atau hash tetap sinkron jika diakses langsung.

### 3. Pembaruan Dokumentasi & Verifikasi Akhir
* Perbarui `ARCHITECTURE.md` mencatat Kaldik sebagai *Single Source of Truth* untuk jadwal & presensi.
* Jalankan `compile_applet` dan `npx tsc --noEmit` untuk memastikan build 100% bebas error.
