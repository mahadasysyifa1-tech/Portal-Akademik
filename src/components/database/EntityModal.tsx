import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertTriangle,
  BookmarkCheck,
  FileText,
  ShoppingCart,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { DatabaseState, BookChapter, BookLink } from '../../types';
import {
  DatabaseSubTab,
  ENTITY_TABS,
  ROOM_TYPES,
  DEFAULT_PALETTE_COLORS,
  checkTimeOverlap
} from './entityConfigs';

interface EntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  subTab: DatabaseSubTab;
  initialData: any;
  isNew: boolean;
  db: DatabaseState;
}

export const EntityModal: React.FC<EntityModalProps> = ({
  isOpen,
  onClose,
  onSave,
  subTab,
  initialData,
  isNew,
  db
}) => {
  const [formData, setFormData] = useState<any>({});

  // Sync formData when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({});
    }
  }, [initialData]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Soft overlap check for sessions
  const conflictingSessions = useMemo(() => {
    if (subTab !== 'sessions') return [];
    const start = formData.startTime || '';
    const end = formData.endTime || '';
    if (!start || !end) return [];

    const otherSessions = (db.sessions || []).filter((s) => s.id !== formData.id);
    return otherSessions.filter((s) => checkTimeOverlap(start, end, s.startTime, s.endTime));
  }, [subTab, formData.id, formData.startTime, formData.endTime, db.sessions]);

  // Derived materi count for book
  const linkedMateriCount = useMemo(() => {
    if (subTab !== 'books' || !formData.id) return 0;
    return (db.syllabusUnits || []).filter(
      (u) => u.bookId === formData.id || u.bookCode === formData.id
    ).length;
  }, [subTab, formData.id, db.syllabusUnits]);

  // Derived volumes/chapters and totals for books
  const currentVolumes: BookChapter[] = useMemo(() => {
    return Array.isArray(formData.chapters)
      ? formData.chapters
      : Array.isArray(formData.volumes)
      ? formData.volumes
      : [];
  }, [formData.chapters, formData.volumes]);

  const autoTotalChapters = currentVolumes.length;
  const autoTotalPages = useMemo(() => {
    if (currentVolumes.length === 0) return 0;
    return currentVolumes.reduce((sum, ch) => {
      const pStart = Number(ch.pageStart ?? (ch as any).page_start) || 1;
      const pEnd = Number(ch.pageEnd ?? (ch as any).page_end) || pStart;
      return sum + Math.max(1, pEnd - pStart + 1);
    }, 0);
  }, [currentVolumes]);

  if (!isOpen) return null;

  const currentTabDef = ENTITY_TABS.find((t) => t.id === subTab);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Final book totals calculation if volumes exist
    const finalData = { ...formData };
    if (subTab === 'books') {
      if (currentVolumes.length > 0) {
        finalData.totalChapters = autoTotalChapters;
        finalData.totalPages = autoTotalPages;
        finalData.total_chapters = autoTotalChapters;
        finalData.total_pages = autoTotalPages;
      }
    }

    onSave(finalData);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              {currentTabDef?.icon && <currentTabDef.icon className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isNew ? 'Tambah' : 'Edit'} {currentTabDef?.singularName}
              </h3>
              <div className="text-[11px] font-mono text-slate-500">
                ID: <span className="font-semibold text-slate-700">{formData.id || '(Otomatis)'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Display Code Field (User-editable display badge, can be freely emptied) */}
          {subTab !== 'materi' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Kode Singkatan (Display Code)
              </label>
              <input
                type="text"
                value={formData.displayCode ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    displayCode: e.target.value,
                    display_code: e.target.value
                  })
                }
                placeholder="Contoh: 10-A / Ust. Ridwan / ARB / R-101 / S-1..."
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Label singkat untuk tampilan tabel dan jadwal. Bebas dikosongkan atau diubah kapan saja.
              </p>
            </div>
          )}

          {/* Main Name / Title */}
          {subTab !== 'materi' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {subTab === 'books'
                  ? 'Judul Kitab *'
                  : subTab === 'periods'
                  ? 'Nama Periode *'
                  : 'Nama / Judul *'}
              </label>
              <input
                type="text"
                required
                value={formData.name || formData.title || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value,
                    title: e.target.value
                  })
                }
                placeholder={
                  subTab === 'books'
                    ? 'Contoh: Matan Al-Jurumiyyah'
                    : subTab === 'teachers'
                    ? 'Contoh: Ust. Ahmad Fauzi, Lc.'
                    : 'Masukkan nama...'
                }
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-xs text-slate-800"
              />
            </div>
          )}

          {/* Specific Fields: Classes */}
          {subTab === 'classes' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tingkat / Jenjang</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={formData.grade ?? 1}
                    onChange={(e) => setFormData({ ...formData, grade: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Seksi / Rombel</label>
                  <input
                    type="text"
                    value={formData.section || ''}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="Contoh: A / B / Putra / Putri"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ruang Default</label>
                <select
                  value={formData.defaultRoomId || formData.default_room_id || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultRoomId: e.target.value || undefined,
                      default_room_id: e.target.value || null
                    })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">-- Tanpa Ruang Default --</option>
                  {(db.rooms || []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.building})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Link KBM Daring (Meet / Zoom)</label>
                <input
                  type="url"
                  value={formData.onlineClassLink || formData.online_class_link || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      onlineClassLink: e.target.value,
                      online_class_link: e.target.value
                    })
                  }
                  placeholder="https://meet.google.com/..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Warna Tema Kelas</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DEFAULT_PALETTE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c })}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                          formData.color === c ? 'scale-110 border-slate-900 ring-2 ring-indigo-400' : 'border-white'
                        }`}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={formData.color || '#3B82F6'}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Specific Fields: Teachers */}
          {subTab === 'teachers' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Panggilan / Sapaan</label>
                  <input
                    type="text"
                    value={formData.panggilan || ''}
                    onChange={(e) => setFormData({ ...formData, panggilan: e.target.value })}
                    placeholder="Contoh: Ust. Ridwan"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Departemen / Kategori</label>
                  <input
                    type="text"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Contoh: Diniyah / Bahasa / Umum"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Pengajar</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="pengajar@pesantren.id"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Warna Pengajar</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DEFAULT_PALETTE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c })}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                          formData.color === c ? 'scale-110 border-slate-900 ring-2 ring-indigo-400' : 'border-white'
                        }`}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={formData.color || '#4F46E5'}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Specific Fields: Students */}
          {subTab === 'students' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NISN</label>
                  <input
                    type="text"
                    value={formData.nisn || ''}
                    onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                    placeholder="Contoh: 0081234567"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={formData.gender || 'L'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="L">Ikhwan (Laki-laki)</option>
                    <option value="P">Akhwat (Perempuan)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. Kontak / WhatsApp</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="081234567890"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Santri</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="santri@pesantren.id"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Specific Fields: Rooms */}
          {subTab === 'rooms' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gedung / Kampus</label>
                  <input
                    type="text"
                    value={formData.building || ''}
                    onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                    placeholder="Contoh: Gedung Utama"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kapasitas (Santri)</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.capacity ?? 30}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 30 })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipe Ruangan</label>
                <select
                  value={formData.type || 'Standard'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  {ROOM_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Specific Fields: Subjects */}
          {subTab === 'subjects' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Departemen / Kategori</label>
                  <input
                    type="text"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Contoh: Diniyah / Bahasa"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Guru Default</label>
                  <select
                    value={formData.defaultTeacherId || formData.default_teacher_id || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defaultTeacherId: e.target.value || undefined,
                        default_teacher_id: e.target.value || null
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="">-- Tanpa Guru Default --</option>
                    {(db.teachers || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.panggilan || t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ruang Default</label>
                  <select
                    value={formData.defaultRoomId || formData.default_room_id || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defaultRoomId: e.target.value || undefined,
                        default_room_id: e.target.value || null
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="">-- Tanpa Ruang Default --</option>
                    {(db.rooms || []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kitab Default</label>
                  <select
                    value={formData.defaultBookId || formData.default_book || formData.default_book_id || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defaultBookId: e.target.value || null,
                        default_book: e.target.value || null,
                        default_book_id: e.target.value || null
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="">-- Tanpa Kitab Default --</option>
                    {(db.books || []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Warna Mapel</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DEFAULT_PALETTE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c })}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                          formData.color === c ? 'scale-110 border-slate-900 ring-2 ring-indigo-400' : 'border-white'
                        }`}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={formData.color || '#3B82F6'}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Specific Fields: Books */}
          {subTab === 'books' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Judul Arab / Alternatif</label>
                  <input
                    type="text"
                    value={formData.altTitle || formData.alt_title || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        altTitle: e.target.value,
                        alt_title: e.target.value
                      })
                    }
                    placeholder="Contoh: متن الآجرومية"
                    dir="auto"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pengarang / Muallif</label>
                  <input
                    type="text"
                    value={formData.author || ''}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    placeholder="Contoh: Ibnu Ajurrum"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Penerbit</label>
                  <input
                    type="text"
                    value={formData.publisher || ''}
                    onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                    placeholder="Darul Kutub / Toha Putra"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Edisi / Cetakan</label>
                  <input
                    type="text"
                    value={formData.edition || ''}
                    onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                    placeholder="Cetakan ke-2 / Edisi Revisi"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mapel Terkait</label>
                  <select
                    value={formData.defaultSubjectId || ''}
                    onChange={(e) => setFormData({ ...formData, defaultSubjectId: e.target.value || undefined })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="">-- Pilih Mapel --</option>
                    {(db.subjects || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pengampu Default</label>
                  <select
                    value={formData.defaultTeacherId || ''}
                    onChange={(e) => setFormData({ ...formData, defaultTeacherId: e.target.value || undefined })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="">-- Pilih Guru --</option>
                    {(db.teachers || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.panggilan || t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sub-Editor: Volume/Jilid List FIRST (per user comment) */}
              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-slate-800 text-xs">
                      Daftar Jilid / Volume Kitab
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Rincian fisik jilid kitab, judul, dan rentang halaman.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextNum = currentVolumes.length + 1;
                      const newVol: BookChapter = {
                        id: `vol-${formData.id || 'book'}-${nextNum}`,
                        bookId: formData.id || '',
                        volumeNumber: nextNum,
                        chapterNumber: nextNum,
                        title: `Jilid ${nextNum}`,
                        pageStart: 1,
                        pageEnd: 100
                      };
                      const updated = [...currentVolumes, newVol];
                      setFormData({
                        ...formData,
                        chapters: updated,
                        volumes: updated
                      });
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Jilid</span>
                  </button>
                </div>

                {currentVolumes.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-[11px] text-slate-400">
                    Belum ada rincian jilid. Klik tombol "Tambah Jilid" jika kitab memiliki beberapa volume fisik.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {currentVolumes.map((vol, idx) => (
                      <div
                        key={vol.id || idx}
                        className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <span className="font-mono text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded shrink-0">
                          Jilid {vol.volumeNumber ?? vol.chapterNumber ?? idx + 1}
                        </span>
                        <input
                          type="text"
                          value={vol.title || ''}
                          onChange={(e) => {
                            const updated = currentVolumes.map((v, i) =>
                              i === idx ? { ...v, title: e.target.value } : v
                            );
                            setFormData({ ...formData, chapters: updated, volumes: updated });
                          }}
                          placeholder="Judul Jilid (opsional)"
                          className="flex-1 p-1 bg-white border border-slate-200 rounded text-xs min-w-0"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-slate-400">Hal:</span>
                          <input
                            type="number"
                            min={1}
                            value={vol.pageStart ?? 1}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              const updated = currentVolumes.map((v, i) =>
                                i === idx ? { ...v, pageStart: val } : v
                              );
                              setFormData({ ...formData, chapters: updated, volumes: updated });
                            }}
                            className="w-14 p-1 bg-white border border-slate-200 rounded text-xs font-mono text-center"
                          />
                          <span className="text-slate-400">-</span>
                          <input
                            type="number"
                            min={1}
                            value={vol.pageEnd ?? 100}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 100;
                              const updated = currentVolumes.map((v, i) =>
                                i === idx ? { ...v, pageEnd: val } : v
                              );
                              setFormData({ ...formData, chapters: updated, volumes: updated });
                            }}
                            className="w-14 p-1 bg-white border border-slate-200 rounded text-xs font-mono text-center"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = currentVolumes
                              .filter((_, i) => i !== idx)
                              .map((v, i) => ({ ...v, volumeNumber: i + 1, chapterNumber: i + 1 }));
                            setFormData({ ...formData, chapters: updated, volumes: updated });
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer shrink-0"
                          title="Hapus Jilid"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals Section: Placed below Volume List */}
              <div className="grid grid-cols-2 gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jumlah Jilid {currentVolumes.length > 0 ? '(Otomatis)' : ''}
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={currentVolumes.length > 0}
                    value={currentVolumes.length > 0 ? autoTotalChapters : formData.totalChapters ?? 1}
                    onChange={(e) => setFormData({ ...formData, totalChapters: parseInt(e.target.value) || 0 })}
                    className={`w-full p-1.5 border rounded-lg text-xs font-mono ${
                      currentVolumes.length > 0
                        ? 'bg-slate-100 border-slate-200 text-slate-600'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Total Halaman {currentVolumes.length > 0 ? '(Kumulatif)' : ''}
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={currentVolumes.length > 0}
                    value={currentVolumes.length > 0 ? autoTotalPages : formData.totalPages ?? 0}
                    onChange={(e) => setFormData({ ...formData, totalPages: parseInt(e.target.value) || 0 })}
                    className={`w-full p-1.5 border rounded-lg text-xs font-mono ${
                      currentVolumes.length > 0
                        ? 'bg-slate-100 border-slate-200 text-slate-600'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Sub-Editor: Tautan Kitab (book_links) */}
              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-slate-800 text-xs">
                      Tautan Referensi Dokumen &amp; Toko
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Tautkan PDF Google Drive, tautan baca, atau marketplace buku.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentLinks: BookLink[] = Array.isArray(formData.links) ? formData.links : [];
                      const newLink: BookLink = {
                        id: `link-${Date.now()}`,
                        bookId: formData.id || '',
                        type: 'pdf',
                        label: 'PDF Kitab',
                        url: ''
                      };
                      setFormData({ ...formData, links: [...currentLinks, newLink] });
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Tautan</span>
                  </button>
                </div>

                {(!formData.links || formData.links.length === 0) ? (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-[11px] text-slate-400">
                    Belum ada tautan dokumen atau toko. Klik "Tambah Tautan" untuk menambahkan.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {formData.links.map((link: BookLink, lIdx: number) => (
                      <div
                        key={link.id || lIdx}
                        className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <select
                          value={link.type || 'pdf'}
                          onChange={(e) => {
                            const updated = formData.links.map((l: any, i: number) =>
                              i === lIdx ? { ...l, type: e.target.value } : l
                            );
                            setFormData({ ...formData, links: updated });
                          }}
                          className="w-24 p-1 bg-white border border-slate-200 rounded text-xs shrink-0"
                        >
                          <option value="pdf">PDF</option>
                          <option value="drive">Drive</option>
                          <option value="shopping">Toko</option>
                          <option value="web">Web</option>
                        </select>
                        <input
                          type="text"
                          value={link.label || ''}
                          onChange={(e) => {
                            const updated = formData.links.map((l: any, i: number) =>
                              i === lIdx ? { ...l, label: e.target.value } : l
                            );
                            setFormData({ ...formData, links: updated });
                          }}
                          placeholder="Label Tautan (misal: PDF Lengkap)"
                          className="w-28 p-1 bg-white border border-slate-200 rounded text-xs shrink-0"
                        />
                        <input
                          type="url"
                          value={link.url || ''}
                          onChange={(e) => {
                            const updated = formData.links.map((l: any, i: number) =>
                              i === lIdx ? { ...l, url: e.target.value } : l
                            );
                            setFormData({ ...formData, links: updated });
                          }}
                          placeholder="https://..."
                          className="flex-1 p-1 bg-white border border-slate-200 rounded text-xs font-mono min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.links.filter((_: any, i: number) => i !== lIdx);
                            setFormData({ ...formData, links: updated });
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informational Materi Terkait */}
              <div className="flex items-center justify-between p-2 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900">
                <span className="flex items-center gap-1.5 font-semibold">
                  <BookmarkCheck className="w-4 h-4 text-amber-700" />
                  <span>Silabus Materi Terkait:</span>
                </span>
                <span className="font-bold">{linkedMateriCount} bab terdaftar di silabus</span>
              </div>
            </div>
          )}

          {/* Specific Fields: Sessions */}
          {subTab === 'sessions' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Mulai (HH:MM)</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime || '07:00'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        startTime: e.target.value,
                        start_time: e.target.value
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Selesai (HH:MM)</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime || '08:30'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        endTime: e.target.value,
                        end_time: e.target.value
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Soft overlap warning */}
              {conflictingSessions.length > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Perhatian: Waktu Beririsan</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Jam sesi ini bertabrakan dengan:{' '}
                    <span className="font-semibold">
                      {conflictingSessions.map((s) => `${s.name} (${s.startTime}–${s.endTime})`).join(', ')}
                    </span>
                    . Anda tetap dapat menyimpan jika ini disengaja.
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-400 italic">
                * Nomor urut sesi (#1, #2, dst.) akan otomatis disusun secara kronologis berdasarkan jam mulai saat disimpan.
              </p>
            </div>
          )}

          {/* Specific Fields: Periods */}
          {subTab === 'periods' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate || formData.start_date || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        startDate: e.target.value,
                        start_date: e.target.value
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate || formData.end_date || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        endDate: e.target.value,
                        end_date: e.target.value
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan / Catatan</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Keterangan kalender akademik..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <p className="text-[11px] text-slate-400 italic">
                * Nomor urut periode (#1, #2, dst.) akan otomatis disusun secara kronologis berdasarkan tanggal mulai saat disimpan.
              </p>
            </div>
          )}

          {/* Specific Fields: Materi */}
          {subTab === 'materi' && (
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kitab Acuan *</label>
                <select
                  required
                  value={formData.bookId || formData.bookCode || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bookId: e.target.value,
                      bookCode: e.target.value
                    })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">-- Pilih Kitab Acuan --</option>
                  {(db.books || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} {b.altTitle ? `(${b.altTitle})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Urut Bab *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.order ?? formData.order_num ?? formData.no ?? 1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        order: parseInt(e.target.value) || 1,
                        order_num: parseInt(e.target.value) || 1,
                        no: parseInt(e.target.value) || 1
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jilid / Bagian Fisik</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.part ?? 1}
                    onChange={(e) => setFormData({ ...formData, part: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Bab / Topik Materi *</label>
                <input
                  type="text"
                  required
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: Bab Kalam dan Pembagian Kalimat"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Halaman Mulai</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.pageStart ?? formData.page_start ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pageStart: e.target.value ? parseInt(e.target.value) : undefined,
                        page_start: e.target.value ? parseInt(e.target.value) : undefined
                      })
                    }
                    placeholder="Contoh: 1"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Halaman Selesai</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.pageEnd ?? formData.page_end ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pageEnd: e.target.value ? parseInt(e.target.value) : undefined,
                        page_end: e.target.value ? parseInt(e.target.value) : undefined
                      })
                    }
                    placeholder="Contoh: 15"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              {isNew ? 'Tambah Data' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
