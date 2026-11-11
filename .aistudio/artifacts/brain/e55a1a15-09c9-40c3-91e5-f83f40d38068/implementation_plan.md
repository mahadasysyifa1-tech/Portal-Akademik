# Implementation Plan: Penataan Grid Beranda & Seleksi Peran Terikat di JadwalView

Penyesuaian tata letak kartu Beranda menjadi grid multi-kolom pada layar lebar, perbaikan akurasi data kartu profil, dan penyesuaian seleksi jadwal di JadwalView agar selalu terikat (*sticky-default*) ke peran pengguna aktif tanpa menyembunyikan pemilih jadwal.

## User Review & Critical Decisions

> [!IMPORTANT]
> Penyesuaian berdasarkan arahan terbaru:
> 1. **Tata Letak Grid Beranda (`HomeTab.tsx`)**: Pada layar lebar (*wide screen*), kartu-kartu di Beranda (kartu profil, kartu kelas berlangsung, kelas berikutnya, dan pintasan) ditata dalam grid 2 atau 3 kolom yang fleksibel dan responsif.
> 2. **Akurasi & Interaktivitas Kartu Profil**: Statistik beban mengajar dihitung riil dari `db.rules`, kelas terdaftar santri digabung dari `enrolledClassIds` dan `db.enrollments`. Tombol riwayat kehadiran membuka `AttendanceHistoryModal` dan tombol jadwal mengarahkan ke tab Jadwal.
> 3. **Seleksi Peran di `JadwalView.tsx`**: Pemilih jadwal (*selector*) **tidak disembunyikan**, melainkan otomatis terikat (*sticky-default*) ke peranan dan identitas pengguna yang sedang login (Ustadz $\to$ otomatis terpilih jadwal mengajarnya; Santri $\to$ otomatis terpilih kelasnya; Tamu $\to$ bebas memilih kelas).
> 4. **Modal Aksi Permintaan Akun (`RoleRequestsView.tsx`)**: Dilewati (*skipped*) sesuai instruksi.

---

## 1. Overview & Core Concept

1. **Tata Letak Grid Multi-Kolom di Beranda (`HomeTab.tsx`)**:
   - Menghilangkan pembungkus sempit statis (`max-w-xl`).
   - Menerapkan sistem grid responsif: 1 kolom di layar ponsel, 2 kolom di tablet/laptop sedang, dan 3 kolom di layar desktop lebar (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5`).
   - Kartu profil Ustadz (`<TeacherCard />`) dan Santri (`<StudentCard />`) menyatu secara proporsional ke dalam grid bersama kartu agenda sesi belajar/mengajar.

2. **Perilaku Seleksi Jadwal Terikat (*Sticky Role Selection*) di `JadwalView.tsx` & `App.tsx`**:
   - Selektor jadwal tetap terlihat dan dapat diakses, menghindari kesan janggal di mana tamu melihat lebih banyak kontrol daripada guru atau santri.
   - Namun, sistem secara cerdas mengikat (*sticky*) pilihan awal pengguna:
     - Jika masuk sebagai **Ustadz**: Mode langsung mengunci ke tampilan Guru (`TEACHER_WEEK`) dengan ID Ustadz bersangkutan sebagai nilai terpilih.
     - Jika masuk sebagai **Santri**: Mode langsung mengunci ke tampilan Murid (`STUDENT_WEEK`) dengan ID kelas santri sebagai nilai terpilih.
     - Jika masuk sebagai **Tamu** / **Admin**: Bebas menavigasi kelas maupun guru.

---

## 2. User Experience & Visual Design

### Alur Tampilan & Interaksi

1. **Tampilan Beranda di Layar Lebar (`HomeTab.tsx`)**:
   - **Bar Status Atas**: Tetap *sticky floating* melayang di bawah navbar utama dengan latar blur halus.
   - **Grid Konten Utama (`lg:grid-cols-3`)**:
     - *Kolom 1*: Kartu Profil Anda (Ustadz / Santri) dengan metrik kehadiran dan beban mengajar/kelas yang akurat. Bar kehadiran dapat diklik untuk membuka modal riwayat presensi (`AttendanceHistoryModal`), dan tombol "Lihat Jadwal Guru/Santri" langsung membawa ke jadwal terkait.
     - *Kolom 2*: Kartu Sesi Berlangsung (jika ada kelas aktif saat ini) dengan indikator waktu sisa dan aksi presensi.
     - *Kolom 3*: Kartu Sesi Berikutnya dengan hitung mundur waktu mulai.
     - Jika tidak ada kelas berlangsung saat ini, kartu profil dan kelas berikutnya mengisi ruang grid secara seimbang (`md:grid-cols-2 lg:grid-cols-2` atau span kolom).
   - **Pintasan Cepat**: Grid 2 kolom di bawah agenda untuk menuju ke Jadwal Lengkap dan Jurnal Pembelajaran.

2. **Tampilan Bilah Jadwal (`JadwalView.tsx`)**:
   - Toolbar tetap melayang (*sticky floating*).
   - Dropdown seleksi tetap hadir sehingga pengguna tidak merasa dibatasi secara artifisial.
   - Pilihan otomatis (*default*) terisi dan terikat sesuai peranan login pengguna dari profil Turso.

---

## 3. Technical Architecture & Component Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│                              App.tsx                                   │
│  - Set sticky initial view mode & selected ID based on auth.role       │
│  - Teacher -> TEACHER_WEEK & teacherId                                 │
│  - Student -> STUDENT_WEEK & classId                                   │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
       ┌────────────────────────┐       ┌─────────────────────────┐
       │      HomeTab.tsx       │       │    UnifiedStudio.tsx    │
       │ - Responsive 2/3 col   │       │     & JadwalView.tsx    │
       │   grid on wide screens │       │ - Selector NOT hidden   │
       │ - db.rules stats calc  │       │ - Sticky default to     │
       │ - AttendanceHistory    │       │   user's own role & ID  │
       │   modal & link working │       │ - Full browsing allowed │
       └────────────────────────┘       └─────────────────────────┘
```

### Rincian Perubahan Berkas

1. **`src/components/HomeTab.tsx`**:
   - Memperbaiki perhitungan statistik `teacherStats`:
     Mengiterasi `(db.rules || [])`, jika `r.active && r.teacherId === myTeacher.id`, tambahkan `stats.sessions += r.daysOfWeek?.length || 1` dan `stats.subjects.add(r.subjectId)`.
   - Memperbaiki `studentEnrolledClasses`:
     Menggabungkan `myStudent.enrolledClassIds` dengan `db.enrollments`.
   - Menambahkan state `activeHistoryTeacher` dan `activeHistoryStudent` untuk merender `<AttendanceHistoryModal />` saat bar kehadiran diklik pada kartu profil di Beranda.
   - Menghubungkan `onSelectSchedule` pada kartu profil agar memanggil `onNavigateToSchedule()` dengan ID dan mode yang sesuai.
   - Mengubah struktur penempatan kartu dari stack vertikal sempit menjadi grid responsif:
     `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">` untuk menyajikan kartu profil dan agenda secara berdampingan di layar lebar.

2. **`src/components/JadwalView.tsx` & `src/components/UnifiedStudio.tsx` & `src/App.tsx`**:
   - Di `App.tsx`:
     Sinkronisasi peranan: Saat pengguna terverifikasi sebagai Guru, setel `studioViewMode` ke `ScheduleViewMode.TEACHER_WEEK` dan setel `selectedTeacherId` ke `auth.teacherId`. Saat Santri, setel ke `ScheduleViewMode.STUDENT_WEEK` dan `selectedClassId` ke `auth.classId`.
   - Di `JadwalView.tsx`:
     Jangan sembunyikan dropdown seleksi (`Kelas:` dan `Guru:`). Biarkan selector tetap dapat diakses oleh semua pengguna (termasuk guru, santri, dan tamu), dengan nilai default yang otomatis terkunci pada identitas pengguna yang sedang masuk.

---

## 4. Verification Plan

1. **Verifikasi Responsivitas Grid di Beranda**:
   - Buka Beranda pada resolusi layar lebar (> 1024px) $\to$ verifikasi kartu profil, sesi berjalan, dan sesi berikutnya tertata dalam grid 2-3 kolom rapi tanpa terpotong.
   - Buka pada resolusi ponsel (< 640px) $\to$ verifikasi kartu otomatis stack 1 kolom dengan padding yang nyaman.
2. **Verifikasi Akurasi Data & Tombol Kartu**:
   - Login Ustadz $\to$ cek jumlah sesi per pekan dan mata pelajaran sesuai jadwal aktif di database.
   - Klik persentase kehadiran $\to$ modal riwayat kehadiran muncul dan menampilkan sesi yang sesuai.
   - Klik "Lihat Jadwal Guru $\to$" $\to$ navigasi berpindah ke tab Jadwal menampilkan jadwal guru tersebut.
3. **Verifikasi JadwalView**:
   - Login Ustadz $\to$ tab Jadwal otomatis membuka jadwal mengajar Ustadz, dan dropdown seleksi tetap ada dan dapat digunakan.
   - Login Santri $\to$ tab Jadwal otomatis membuka jadwal kelas santri.
   - Tamu $\to$ tab Jadwal dapat memilih kelas yang ingin dilihat.
4. **Verifikasi Kompilasi & Build**:
   - Jalankan `compile_applet` dan `lint_applet` bersamaan untuk memastikan 0 error TypeScript.
