import React, { useState, useRef } from 'react';
import { DatabaseState, SyllabusUnit } from '../types';
import {
  Database,
  Download,
  Upload,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  FolderDown,
  BookOpen
} from 'lucide-react';
import {
  exportSyllabusToCsv,
  getSampleSyllabusCsv
} from '../utils/syllabusImporter';
import {
  downloadCsvFile,
  escapeCsvValue,
  parseCsvRows,
  UNIVERSAL_TABLE_CONFIGS,
  UniversalTableKey
} from '../utils/csvHelper';
import { SyllabusImporterModal } from './syllabus/SyllabusImporterModal';

interface ExportImportViewProps {
  db: DatabaseState;
  onExportJson: () => void;
  onImportJson: (jsonString: string) => void;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
  onBackToDatabase?: () => void;
  onNavigateToSchedule?: () => void;
}

export const ExportImportView: React.FC<ExportImportViewProps> = ({
  db,
  onExportJson,
  onImportJson,
  onUpdateDb,
  onBackToDatabase
}) => {
  const [isSyllabusImporterOpen, setIsSyllabusImporterOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadSyllabusTemplate = () => {
    const sampleBooks = (db.books && db.books.length > 0) ? db.books : undefined;
    const firstBook = sampleBooks ? sampleBooks[0] : null;
    const defaultCode = firstBook ? (firstBook.displayCode || firstBook.display_code || firstBook.id) : 'BK-ARB';
    const csvContent = sampleBooks ? getSampleSyllabusCsv(sampleBooks) : getSampleSyllabusCsv(defaultCode);
    downloadCsvFile('template_silabus.csv', csvContent);
  };

  const handleImportSyllabusUnits = (newUnits: SyllabusUnit[], mode: 'replace' | 'append') => {
    onUpdateDb((prev) => {
      if (mode === 'replace') {
        return {
          ...prev,
          syllabusUnits: newUnits
        };
      } else {
        const existing = prev.syllabusUnits || [];
        const map = new Map(existing.map((u) => [u.id, u]));
        newUnits.forEach((u) => map.set(u.id, u));
        return {
          ...prev,
          syllabusUnits: Array.from(map.values())
        };
      }
    });
  };

  const processJsonFile = (file: File) => {
    if (!file.name.endsWith('.json')) {
      setImportStatus({
        type: 'error',
        message: 'Berkas harus memiliki ekstensi .json'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      try {
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Format JSON tidak valid.');
        }
        onImportJson(content);
        setImportStatus({
          type: 'success',
          message: `Basis data berhasil dipulihkan dari berkas "${file.name}"!`
        });
      } catch (err: any) {
        setImportStatus({
          type: 'error',
          message: `Gagal memproses JSON: ${err.message || 'Format tidak valid'}`
        });
      }
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processJsonFile(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processJsonFile(file);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 shrink-0">
              <FolderDown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Pusat Cadangan JSON &amp; Impor Silabus
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Data Backup Asli
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Format penyimpanan asli aplikasi adalah JSON. Kelola pencadangan penuh sistem (JSON) untuk migrasi atau cadangan darurat, pulihkan berkas basis data, dan impor/ekspor silabus materi dalam format CSV.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onBackToDatabase && (
              <button
                type="button"
                onClick={onBackToDatabase}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Basis Data</span>
              </button>
            )}
          </div>
        </div>

        {/* Database Inventory Snapshot */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-center">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pelajaran</span>
            <span className="text-sm font-bold text-slate-900">{db.subjects.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Kelas</span>
            <span className="text-sm font-bold text-slate-900">{db.classes.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Guru</span>
            <span className="text-sm font-bold text-slate-900">{db.teachers.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Ruangan</span>
            <span className="text-sm font-bold text-slate-900">{db.rooms.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Kitab / Buku</span>
            <span className="text-sm font-bold text-slate-900">{(db.books || []).length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Jadwal Aturan</span>
            <span className="text-sm font-bold text-indigo-700">{db.rules.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Silabus Materi</span>
            <span className="text-sm font-bold text-amber-700">{(db.syllabusUnits || []).length}</span>
          </div>
        </div>
      </div>

      {/* Notification banner */}
      {importStatus && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            importStatus.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {importStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{importStatus.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportStatus(null)}
            className="text-xs font-bold underline opacity-70 hover:opacity-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Grid: Native JSON Full System Backup & Restore */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Ekspor Cadangan Sistem (JSON) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cadangan Penuh Basis Data (Ekspor JSON)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Menyimpan keseluruhan entitas &amp; konfigurasi dalam satu berkas JSON terstruktur asli.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70 text-xs text-slate-600 space-y-1.5 mt-3">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cakupan Isi Cadangan JSON:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1 text-slate-600">
                <li>Seluruh Mata Pelajaran ({db.subjects.length}) &amp; Guru Pengampu ({db.teachers.length})</li>
                <li>Pustaka Kitab &amp; Buku Ajar ({(db.books || []).length} buku/kitab)</li>
                <li>Rombel Kelas ({db.classes.length}), Ruangan ({db.rooms.length}), dan Sesi ({db.sessions.length})</li>
                <li>Periode Kalender Akademik ({db.periods.length})</li>
                <li>Aturan Jadwal Utama &amp; Pengecualian Tanggal ({db.rules.length} aturan)</li>
                <li>Pangkalan Data Silabus Materi ({(db.syllabusUnits || []).length} unit materi)</li>
              </ul>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              id="btn-export-full-json"
              onClick={onExportJson}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs hover:shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Cadangan Basis Data (.json)</span>
            </button>
          </div>
        </div>

        {/* Card 2: Impor Pemulihan Basis Data (JSON) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Pemulihan Basis Data (Impor JSON)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pulihkan seluruh tabel basis data dari berkas cadangan JSON portal IJMA.
                </p>
              </div>
            </div>

            {/* Drag and drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all mt-3 ${
                isDragging
                  ? 'border-amber-500 bg-amber-50/60'
                  : 'border-slate-200 hover:border-amber-400 bg-slate-50/50 hover:bg-amber-50/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800">
                Klik untuk memilih berkas atau seret berkas JSON ke sini
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Format yang didukung: berkas JSON cadangan portal IJMA
              </p>
            </div>
          </div>

          <div className="text-[11px] text-amber-900 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Perhatian:</strong> Mengimpor berkas JSON akan memperbarui basis data aktif saat ini.
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: Universal Database CSV Import & Export Hub */}
      <UniversalCsvHub
        db={db}
        todayStr={todayStr}
        onUpdateDb={onUpdateDb}
        onOpenSyllabusModal={() => setIsSyllabusImporterOpen(true)}
        onSetStatus={setImportStatus}
      />

      {/* Syllabus Importer Modal */}
      <SyllabusImporterModal
        isOpen={isSyllabusImporterOpen}
        onClose={() => setIsSyllabusImporterOpen(false)}
        db={db}
        onImportUnits={handleImportSyllabusUnits}
      />
    </div>
  );
};

// ----------------------------------------------------------------------------
// Universal Database CSV Hub Component
// ----------------------------------------------------------------------------
interface UniversalCsvHubProps {
  db: DatabaseState;
  todayStr: string;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
  onOpenSyllabusModal: () => void;
  onSetStatus: (status: { type: 'success' | 'error'; message: string }) => void;
}

const UniversalCsvHub: React.FC<UniversalCsvHubProps> = ({
  db,
  todayStr,
  onUpdateDb,
  onOpenSyllabusModal,
  onSetStatus,
}) => {
  const [selectedTable, setSelectedTable] = useState<UniversalTableKey>('students');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  const tableConfig = UNIVERSAL_TABLE_CONFIGS[selectedTable];

  // Helper to get raw data for table
  const getTableRows = (key: UniversalTableKey): string[][] => {
    switch (key) {
      case 'students':
        // Note: Students are maintained in Turso or fallback
        return [];
      case 'enrollments':
        return [];
      case 'classes':
        return (db.classes || []).map((c) => [
          c.id,
          c.name,
          String(c.grade || ''),
          c.section || '',
          c.color || '',
          c.defaultRoomId || '',
        ]);
      case 'teachers':
        return (db.teachers || []).map((t) => [
          t.id,
          t.name,
          t.panggilan || '',
          t.email || '',
          t.department || '',
          t.color || '',
          String(t.maxPeriodsPerWeek || 18),
        ]);
      case 'subjects':
        return (db.subjects || []).map((s) => [
          s.id,
          s.name,
          s.code || '',
          s.category || '',
          s.color || '',
          String(s.weeklyPeriods || 2),
        ]);
      case 'rooms':
        return (db.rooms || []).map((r) => [
          r.id,
          r.name,
          r.building || '',
          String(r.capacity || 30),
          r.type || 'Standard',
        ]);
      case 'books':
        return (db.books || []).map((b) => [
          b.id,
          b.title,
          b.author || '',
          b.publisher || '',
          String(b.volumeCount || 1),
          b.displayCode || (b as any).display_code || '',
        ]);
      case 'sessions':
        return (db.sessions || []).map((ses) => [
          ses.id,
          ses.name,
          ses.startTime || (ses as any).start_time || '',
          ses.endTime || (ses as any).end_time || '',
          String(ses.sortOrder || (ses as any).sort_order || 1),
        ]);
      case 'rules':
        return (db.rules || []).map((r) => [
          r.id,
          r.subjectId || '',
          r.classId || '',
          r.teacherId || '',
          r.roomId || '',
          r.sessionId || '',
          Array.isArray(r.daysOfWeek) ? r.daysOfWeek.join(';') : String(r.dayOfWeek || ''),
          r.active ? '1' : '0',
        ]);
      case 'syllabus':
        return (db.syllabusUnits || []).map((u) => [
          u.id,
          u.subjectId,
          u.bookId,
          u.title,
          String(u.chapter || 1),
          String(u.pageStart || 1),
          String(u.pageEnd || 10),
        ]);
      default:
        return [];
    }
  };

  // Download Existing Table Data CSV
  const handleExportTable = async () => {
    if (selectedTable === 'syllabus') {
      const csv = exportSyllabusToCsv(db.syllabusUnits || [], db);
      downloadCsvFile(`silabus_units_${todayStr}.csv`, csv);
      return;
    }

    if (selectedTable === 'students' || selectedTable === 'enrollments') {
      try {
        const res = await fetch('/api/enrollment/overview');
        if (res.ok) {
          const data = await res.json();
          if (selectedTable === 'students') {
            const rows = (data.students || []).map((s: any) => [
              escapeCsvValue(s.id),
              escapeCsvValue(s.nisn),
              escapeCsvValue(s.name),
              escapeCsvValue(s.gender),
              escapeCsvValue(s.phone || ''),
            ]);
            const csv = [tableConfig.headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\r\n');
            downloadCsvFile(`santri_${todayStr}.csv`, csv);
            return;
          } else {
            const rows = (data.enrollments || []).map((e: any) => [
              escapeCsvValue(e.classId),
              escapeCsvValue(e.studentId),
              escapeCsvValue(e.academicYear),
              escapeCsvValue(e.active),
            ]);
            const csv = [tableConfig.headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\r\n');
            downloadCsvFile(`enrollment_${todayStr}.csv`, csv);
            return;
          }
        }
      } catch (e) {
        console.warn('Backend fetch failed, fallback', e);
      }
    }

    const rows = getTableRows(selectedTable);
    const csvContent = [
      tableConfig.headers.join(','),
      ...rows.map((row) => row.map(escapeCsvValue).join(',')),
    ].join('\r\n');
    downloadCsvFile(`${selectedTable}_${todayStr}.csv`, csvContent);
  };

  // Download Sample Template CSV
  const handleDownloadTemplate = () => {
    const csvContent = [
      tableConfig.headers.join(','),
      tableConfig.sampleRow.map(escapeCsvValue).join(','),
    ].join('\r\n');
    downloadCsvFile(`template_${selectedTable}.csv`, csvContent);
  };

  // Read CSV for preview
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const rows = parseCsvRows(text);
      if (rows.length > 0) {
        setCsvPreview({
          headers: rows[0],
          rows: rows.slice(1, 6),
        });
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  // Execute CSV Import
  const handleExecuteImport = async () => {
    if (!previewFile) return;

    if (selectedTable === 'syllabus') {
      onOpenSyllabusModal();
      setCsvPreview(null);
      setPreviewFile(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const parsed = parseCsvRows(text);
      if (parsed.length < 2) {
        onSetStatus({ type: 'error', message: 'Berkas CSV tidak memiliki baris data.' });
        return;
      }

      const rows = parsed.slice(1);

      if (selectedTable === 'students') {
        let successCount = 0;
        for (const row of rows) {
          const [id, nisn, name, gender, phone] = row;
          if (!name) continue;
          try {
            await fetch('/api/enrollment/students', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                student: { id: id || `std-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nisn, name, gender: gender === 'P' ? 'P' : 'L', phone },
              }),
            });
            successCount++;
          } catch {}
        }
        onSetStatus({ type: 'success', message: `Berhasil mengimpor ${successCount} data santri ke basis data.` });
        setCsvPreview(null);
        setPreviewFile(null);
        return;
      }

      // Local State Entities Importer
      onUpdateDb((prev) => {
        const next = { ...prev };
        if (selectedTable === 'classes') {
          const newClasses = rows.map((r) => ({
            id: r[0] || `cls-${Date.now()}`,
            name: r[1] || 'Kelas Baru',
            grade: r[2] ? Number(r[2]) : undefined,
            section: r[3] || undefined,
            color: r[4] || '#E2E8F0',
            defaultRoomId: r[5] || undefined,
          }));
          next.classes = importMode === 'replace' ? newClasses : [...next.classes, ...newClasses];
        } else if (selectedTable === 'teachers') {
          const newTeachers = rows.map((r) => ({
            id: r[0] || `tch-${Date.now()}`,
            name: r[1] || 'Ustadz Baru',
            panggilan: r[2] || undefined,
            email: r[3] || undefined,
            department: r[4] || undefined,
            color: r[5] || '#0284C7',
            maxPeriodsPerWeek: r[6] ? Number(r[6]) : 18,
          }));
          next.teachers = importMode === 'replace' ? newTeachers : [...next.teachers, ...newTeachers];
        } else if (selectedTable === 'subjects') {
          const newSubjects = rows.map((r) => ({
            id: r[0] || `sub-${Date.now()}`,
            name: r[1] || 'Pelajaran Baru',
            code: r[2] || undefined,
            category: r[3] || undefined,
            color: r[4] || '#3B82F6',
            weeklyPeriods: r[5] ? Number(r[5]) : 2,
          }));
          next.subjects = importMode === 'replace' ? newSubjects : [...next.subjects, ...newSubjects];
        } else if (selectedTable === 'rooms') {
          const newRooms = rows.map((r) => ({
            id: r[0] || `rm-${Date.now()}`,
            name: r[1] || 'Ruangan Baru',
            building: r[2] || undefined,
            capacity: r[3] ? Number(r[3]) : 30,
            type: (r[4] as any) || 'Standard',
          }));
          next.rooms = importMode === 'replace' ? newRooms : [...next.rooms, ...newRooms];
        } else if (selectedTable === 'books') {
          const newBooks = rows.map((r) => ({
            id: r[0] || `bk-${Date.now()}`,
            title: r[1] || 'Kitab Baru',
            author: r[2] || undefined,
            publisher: r[3] || undefined,
            volumeCount: r[4] ? Number(r[4]) : 1,
            displayCode: r[5] || undefined,
          }));
          next.books = importMode === 'replace' ? newBooks : [...(next.books || []), ...newBooks];
        }
        return next;
      });

      onSetStatus({ type: 'success', message: `Berhasil mengimpor ${rows.length} baris data ke tabel ${tableConfig.label}.` });
      setCsvPreview(null);
      setPreviewFile(null);
    };
    reader.readAsText(previewFile);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
      <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Pusat Ekspor &amp; Impor Universal CSV (Pilih Basis Data)
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Semua Tabel Tersedia
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pilih tabel entitas di bawah untuk mengunduh template spreadsheet, ekspor CSV, atau mengunggah data massal.
          </p>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Tanggal: {todayStr}
        </span>
      </div>

      {/* Table Selector Dropdown & Tabs */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700">
          Pilih Tabel Basis Data:
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(UNIVERSAL_TABLE_CONFIGS) as UniversalTableKey[]).map((key) => {
            const isSelected = selectedTable === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedTable(key);
                  setCsvPreview(null);
                  setPreviewFile(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {UNIVERSAL_TABLE_CONFIGS[key].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Table Card & Operations */}
      <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
          <div>
            <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-2">
              <span>Tabel Terpilih: {tableConfig.label}</span>
              <span className="font-mono text-[10px] bg-indigo-200/60 text-indigo-900 px-1.5 py-0.5 rounded">
                [{tableConfig.key}]
              </span>
            </h4>
            <p className="text-[11px] text-indigo-700 mt-0.5">
              {tableConfig.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
              title="Unduh file format CSV kosong dengan kolom yang valid"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Template CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportTable}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Data CSV</span>
            </button>
          </div>
        </div>

        {/* Upload File Section for this table */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800">
              Impor Berkas CSV ke Tabel {tableConfig.label}:
            </span>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">Mode Impor:</span>
              <label className="inline-flex items-center gap-1 text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="append"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="text-indigo-600"
                />
                <span>Tambahkan (Append)</span>
              </label>
              <label className="inline-flex items-center gap-1 text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="text-indigo-600"
                />
                <span>Gantikan Semua (Replace)</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => csvFileInputRef.current?.click()}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Pilih Berkas CSV ({tableConfig.label})</span>
            </button>
            {previewFile && (
              <span className="text-xs font-medium text-slate-600 truncate max-w-xs">
                Berkas: {previewFile.name} ({(previewFile.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>

          {/* CSV Preview Table */}
          {csvPreview && (
            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Pratinjau Data CSV (5 Baris Pertama):</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {csvPreview.headers.length} Kolom
                </span>
              </div>
              <div className="overflow-x-auto max-h-40 border border-slate-100 rounded-lg">
                <table className="min-w-full text-[11px] text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {csvPreview.headers.map((h, i) => (
                        <th key={i} className="px-2.5 py-1.5 font-bold text-slate-700">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvPreview.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/50">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-2.5 py-1 text-slate-600 truncate max-w-[150px]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setCsvPreview(null);
                    setPreviewFile(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  Mulai Impor ke Tabel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
