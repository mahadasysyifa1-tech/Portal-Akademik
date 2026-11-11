# Stashed Plan: Fitur Cetak Dokumen Akademik (Printability)

Rencana menyeluruh untuk menghadirkan fitur **Cetak Dokumen (Printability)** di Portal Akademik IJMA: menyediakan dialog pratinjau cetak interaktif (*PrintPreviewModal*) berstandar cetak presisi (A4/F4/Letter, Landscape/Portrait) untuk 4 jenis dokumen utama (**Jadwal KBM**, **Kalender Pendidikan/Kaldik**, **Jurnal & Rekap Presensi**, dan **Linimasa Silabus**), dengan tata letak dokumen bersih, proporsional, ramah tinta, dan tanpa elemen kop/tanda tangan sesuai arahan pengguna.

---

## 1. Overview & Core Concept

Fitur cetak dirancang untuk menjembatani sistem digital dengan kebutuhan operasional fisik sekolah/pesantren:
1. **Jadwal Pelajaran**:
   * *Jadwal per Kelas* (Landscape/Portrait) untuk ditempel di mading kelas santri.
   * *Jadwal Mengajar per Guru* (Portrait) untuk pegangan asatidzah.
   * *Matriks Master Jadwal Seluruh Sekolah* (Landscape) untuk papan kendali kurikulum.
2. **Kalender Pendidikan (Kaldik)**:
   * *Kaldik Bulanan* (Landscape) lengkap dengan balok acara merentang, hari aktif KBM, dan agenda bulanan.
   * *Kaldik Semesteran* (Landscape/Portrait) ringkasan semester untuk kalender tahunan.
3. **Jurnal & Rekap Presensi**:
   * *Rekap Presensi Bulanan Santri* (Landscape) berisi tabel kehadiran santri per tanggal, total Hadir/Izin/Sakit/Terlambat/Alpa, dan persentase kehadiran.
   * *Jurnal Pembelajaran Harian* (Portrait) daftar sesi harian, materi/bab yang diajarkan, dan santri yang berhalangan hadir.
4. **Linimasa Silabus & Pacing**:
   * *Daftar Target Kurikulum & Capaian* (Portrait/Landscape) daftar urut pertemuan, tanggal target vs aktual, nama materi/kitab, rentang halaman, dan status ketuntasan.

---

## 2. User Experience & Visual Design

### A. Titik Akses Tombol Cetak
1. **Header Utama (`Header.tsx`)**: Tombol ikon printer `"Cetak Dokumen"` di bilah aksi atas yang membuka *PrintPreviewModal* dengan dokumen terpilih sesuai tab yang sedang aktif.
2. **Bilah Alat Kontekstual**:
   * `KaldikToolbar.tsx`: Tombol cetak langsung untuk Kalender Pendidikan atau Jurnal Presensi.
   * `SyllabusView.tsx`: Tombol cetak langsung untuk Linimasa Silabus.
   * `WeekGridView.tsx` / `RulesManager.tsx`: Tombol cetak langsung untuk Jadwal KBM.

### B. Dialog Pratinjau Cetak (*PrintPreviewModal*)
Modal layar penuh/lebar dengan pembagian 2 zona:
* **Zona Kiri (Pengaturan Cetak)**:
  * Pemilih jenis dokumen dan filter kontekstual dinamis.
  * Pemilih orientasi (Landscape vs Portrait).
  * Pemilih ukuran kertas (A4, F4/Folio, Letter).
  * Pemilih skala (*zoom/fit*).
* **Zona Kanan (Simulasi Lembar Kertas Realistis)**:
  * Lembar kanvas putih (`bg-white shadow-xl`) dengan rasio proporsional kertas (A4/F4).
  * Menggunakan tipografi tajam, garis tabel hairline berkontras tinggi (`border-slate-800`), font monospace tabular (`font-mono tabular-nums`) untuk jam dan nomor, serta ramah tinta printer (*ink-saving*).
  * Mengabaikan latar belakang warna-warni layar agar tidak menghabiskan tinta saat dicetak.

---

## 3. Desain Format 4 Dokumen Cetak

### 1. Jadwal KBM Mingguan
* **Format Per Kelas**:
  * Judul: "JADWAL PELAJARAN KBM - KELAS [NAMA KELAS]"
  * Sub-header: Semester / Periode aktif, Tahun Ajaran, Wali Kelas / Santri count.
  * Tabel: Baris Sesi Waktu (Jam Mulai - Selesai) x Kolom Hari (Senin s/d Ahad yang aktif).
  * Isi Sel: Nama Mata Pelajaran (tebal), Guru Pengampu, dan Ruangan.
* **Format Per Guru**:
  * Judul: "JADWAL MENGAJAR GURU - [NAMA GURU]"
  * Tabel: Baris Sesi Waktu x Kolom Hari.
  * Isi Sel: Nama Mata Pelajaran & Kelas yang diampu.
* **Format Matriks Lengkap**:
  * Tampilan tabel padat seluruh kelas sekaligus dalam orientasi Landscape.

### 2. Kalender Pendidikan (Kaldik)
* **Format Bulanan**:
  * Judul: "KALENDER PENDIDIKAN - [NAMA BULAN & TAHUN]"
  * Grid 7 Kolom (Senin s/d Ahad) dengan nomor hari jelas.
  * Balok acara merentang (*spanning bars*) monokromatis/greyscale berpola halus atau bergaris tepi tegas yang terbaca jelas di printer hitam-putih.
  * Bagian Bawah: Daftar Ringkasan Agenda & Rekap Hari Efektif KBM bulan tersebut.

### 3. Jurnal & Rekap Presensi
* **Format Rekap Presensi Santri Bulanan**:
  * Judul: "REKAPITULASI PRESENSI SANTRI - KELAS [KELAS] - BULAN [BULAN]"
  * Tabel: Nomor, NISN, Nama Santri, Kolom Tanggal 1 s/d 31 (atau per nomor pertemuan), Kolom Rekap (H, I, S, T, A), dan Persentase Kehadiran.
* **Format Jurnal Harian KBM**:
  * Judul: "JURNAL PEMBELAJARAN HARIAN - TANGGAL [TANGGAL]"
  * Tabel: Sesi, Kelas, Mata Pelajaran, Guru Pengampu, Materi/Kitab & Halaman yang dibahas, Ringkasan Kehadiran Santri, dan Catatan Pertemuan.

### 4. Linimasa Silabus & Pacing
* **Format Linimasa Silabus**:
  * Judul: "RENCANA & REALISASI SILABUS - [MATA PELAJARAN] - [KELAS]"
  * Tabel: No Pertemuan, Tanggal Target, Tanggal Aktual, Materi / Bab Kitab, Rentang Halaman Target vs Realisasi, Selisih Halaman, dan Status (Tuntas / Belum).

---

## 4. Arsitektur Teknis & Strategi CSS Print

### Isolasi Cetak Murni (`@media print`)
1. Komponen cetak dirender ke dalam kontainer khusus `#print-document-container`.
2. Pada stylesheet cetak (`@media print`):
   * Sembunyikan elemen layar (`body * { visibility: hidden; }`).
   * Tampilkan kontainer cetak (`#print-document-container, #print-document-container * { visibility: visible; }`).
3. Aturan `@page` dinamis disuntikkan sesuai pilihan orientasi (`size: A4 landscape;` atau `size: A4 portrait;`).
4. Page break protection: Menerapkan `break-inside: avoid` pada setiap baris tabel santri/jadwal agar tidak terpotong di tengah halaman.
