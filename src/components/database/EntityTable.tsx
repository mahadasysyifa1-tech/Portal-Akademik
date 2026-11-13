import React, { useMemo } from 'react';
import {
  Edit2,
  Trash2,
  Search,
  Plus,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  ShoppingCart
} from 'lucide-react';
import { DatabaseState } from '../../types';
import { DatabaseSubTab, ENTITY_TABS, ROOM_TYPES, checkTimeOverlap } from './entityConfigs';

interface EntityTableProps {
  subTab: DatabaseSubTab;
  db: DatabaseState;
  search: string;
  onSearchChange: (q: string) => void;
  materiBookFilter: string;
  onMateriBookFilterChange: (bookId: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onAddNew: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: string, name: string) => void;
}

export const EntityTable: React.FC<EntityTableProps> = ({
  subTab,
  db,
  search,
  onSearchChange,
  materiBookFilter,
  onMateriBookFilterChange,
  currentPage,
  onPageChange,
  pageSize,
  onPageSizeChange,
  onAddNew,
  onEdit,
  onDelete
}) => {
  // Relational Lookup Maps
  const teacherMap = useMemo(() => new Map((db.teachers || []).map((t) => [t.id, t.panggilan || t.name])), [db.teachers]);
  const roomMap = useMemo(() => new Map((db.rooms || []).map((r) => [r.id, r.name])), [db.rooms]);
  const subjectMap = useMemo(() => new Map((db.subjects || []).map((s) => [s.id, s.name])), [db.subjects]);
  const bookMap = useMemo(() => new Map((db.books || []).map((b) => [b.id, b.title])), [db.books]);

  // Derived student count per class from active enrollments
  const classStudentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    (db.enrollments || []).forEach((e) => {
      if (e.active !== 0 && e.active !== false) {
        map.set(e.classId, (map.get(e.classId) || 0) + 1);
      }
    });
    return map;
  }, [db.enrollments]);

  // Derived materi count per book from syllabusUnits
  const bookMateriCountMap = useMemo(() => {
    const map = new Map<string, number>();
    (db.syllabusUnits || []).forEach((u) => {
      const bId = u.bookId || u.bookCode;
      if (bId) {
        map.set(bId, (map.get(bId) || 0) + 1);
      }
    });
    return map;
  }, [db.syllabusUnits]);

  // Identify sessions with soft time overlaps
  const sessionOverlapMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (subTab !== 'sessions') return map;
    const sessions = db.sessions || [];
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const sA = sessions[i];
        const sB = sessions[j];
        if (checkTimeOverlap(sA.startTime, sA.endTime, sB.startTime, sB.endTime)) {
          const conflictsA = map.get(sA.id) || [];
          conflictsA.push(sB.name);
          map.set(sA.id, conflictsA);

          const conflictsB = map.get(sB.id) || [];
          conflictsB.push(sA.name);
          map.set(sB.id, conflictsB);
        }
      }
    }
    return map;
  }, [subTab, db.sessions]);

  // Current entity raw list
  const rawList = useMemo(() => {
    switch (subTab) {
      case 'classes': return db.classes || [];
      case 'teachers': return db.teachers || [];
      case 'students': return db.students || [];
      case 'rooms': return db.rooms || [];
      case 'subjects': return db.subjects || [];
      case 'books': return db.books || [];
      case 'sessions': return db.sessions || [];
      case 'periods': return db.periods || [];
      case 'materi': {
        const list = db.syllabusUnits || [];
        if (materiBookFilter !== 'all') {
          return list.filter((it) => (it.bookId || it.bookCode) === materiBookFilter);
        }
        return list;
      }
      default: return [];
    }
  }, [subTab, db, materiBookFilter]);

  // Filtered list by search query
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rawList;

    return rawList.filter((item: any) => {
      const matchId = String(item.id || item.code || '').toLowerCase().includes(q);
      const matchName = String(item.name || item.title || '').toLowerCase().includes(q);
      const matchCode = String(item.displayCode || item.display_code || item.code || '').toLowerCase().includes(q);

      if (matchId || matchName || matchCode) return true;

      if (subTab === 'teachers') {
        const matchPanggilan = String(item.panggilan || '').toLowerCase().includes(q);
        const matchDept = String(item.department || '').toLowerCase().includes(q);
        const matchEmail = String(item.email || '').toLowerCase().includes(q);
        return matchPanggilan || matchDept || matchEmail;
      }

      if (subTab === 'students') {
        const matchNisn = String(item.nisn || '').toLowerCase().includes(q);
        const matchPhone = String(item.phone || '').toLowerCase().includes(q);
        const matchEmail = String(item.email || '').toLowerCase().includes(q);
        return matchNisn || matchPhone || matchEmail;
      }

      if (subTab === 'rooms') {
        const matchBuilding = String(item.building || '').toLowerCase().includes(q);
        const matchType = String(item.type || '').toLowerCase().includes(q);
        return matchBuilding || matchType;
      }

      if (subTab === 'subjects') {
        const matchDept = String(item.department || '').toLowerCase().includes(q);
        return matchDept;
      }

      if (subTab === 'books') {
        const matchAuthor = String(item.author || '').toLowerCase().includes(q);
        const matchAlt = String(item.altTitle || item.alt_title || '').toLowerCase().includes(q);
        const matchPub = String(item.publisher || '').toLowerCase().includes(q);
        return matchAuthor || matchAlt || matchPub;
      }

      if (subTab === 'materi') {
        const matchBook = String(bookMap.get(item.bookId || item.bookCode) || '').toLowerCase().includes(q);
        const matchBab = `bab ${item.order}`.includes(q) || String(item.order).includes(q);
        return matchBook || matchBab;
      }

      return false;
    });
  }, [rawList, search, subTab, bookMap]);

  // Pagination calculation
  const totalCount = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const pagedList = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, safePage, pageSize]);

  const currentTabDef = ENTITY_TABS.find((t) => t.id === subTab);

  return (
    <div className="space-y-4">
      {/* Table Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onPageChange(1);
              }}
              placeholder={`Cari data ${currentTabDef?.name.toLowerCase()}...`}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Materi Filter by Book */}
          {subTab === 'materi' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 shrink-0">Kitab:</span>
              <select
                value={materiBookFilter}
                onChange={(e) => {
                  onMateriBookFilterChange(e.target.value);
                  onPageChange(1);
                }}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="all">Semua Kitab</option>
                {(db.books || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Page size picker */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Tampil:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="p-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 cursor-pointer"
            >
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Add Entity Button */}
        <button
          type="button"
          onClick={onAddNew}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors shadow-2xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah {currentTabDef?.singularName}</span>
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-3 py-2.5 w-12 text-center">No</th>
                <th className="px-3 py-2.5">ID Sistem</th>
                <th className="px-3 py-2.5">Kode</th>
                <th className="px-3 py-2.5">
                  {subTab === 'books' ? 'Judul Kitab' : subTab === 'periods' ? 'Nama Periode' : 'Nama / Judul'}
                </th>

                {/* Dynamic Columns per Sub-Tab */}
                {subTab === 'classes' && (
                  <>
                    <th className="px-3 py-2.5 text-center">Tingkat</th>
                    <th className="px-3 py-2.5 text-center">Seksi</th>
                    <th className="px-3 py-2.5 text-center">Santri</th>
                    <th className="px-3 py-2.5">Ruang Default</th>
                    <th className="px-3 py-2.5">Link Daring</th>
                  </>
                )}

                {subTab === 'teachers' && (
                  <>
                    <th className="px-3 py-2.5">Panggilan</th>
                    <th className="px-3 py-2.5">Departemen</th>
                    <th className="px-3 py-2.5">Email</th>
                  </>
                )}

                {subTab === 'students' && (
                  <>
                    <th className="px-3 py-2.5">NISN</th>
                    <th className="px-3 py-2.5 text-center">Gender</th>
                    <th className="px-3 py-2.5">No. Kontak</th>
                    <th className="px-3 py-2.5">Email</th>
                  </>
                )}

                {subTab === 'rooms' && (
                  <>
                    <th className="px-3 py-2.5">Gedung</th>
                    <th className="px-3 py-2.5 text-center">Kapasitas</th>
                    <th className="px-3 py-2.5">Tipe Ruangan</th>
                  </>
                )}

                {subTab === 'subjects' && (
                  <>
                    <th className="px-3 py-2.5">Departemen</th>
                    <th className="px-3 py-2.5">Guru Default</th>
                    <th className="px-3 py-2.5">Kitab Default</th>
                  </>
                )}

                {subTab === 'books' && (
                  <>
                    <th className="px-3 py-2.5">Judul Arab</th>
                    <th className="px-3 py-2.5">Muallif</th>
                    <th className="px-3 py-2.5">Edisi / Cetakan</th>
                    <th className="px-3 py-2.5 text-center">Volume &amp; Hal</th>
                    <th className="px-3 py-2.5">Mapel Default</th>
                    <th className="px-3 py-2.5 text-center">Materi Terkait</th>
                  </>
                )}

                {subTab === 'sessions' && (
                  <>
                    <th className="px-3 py-2.5 text-center">Jam Mulai</th>
                    <th className="px-3 py-2.5 text-center">Jam Selesai</th>
                    <th className="px-3 py-2.5 text-center">Urutan</th>
                    <th className="px-3 py-2.5 text-center">Status Jadwal</th>
                  </>
                )}

                {subTab === 'periods' && (
                  <>
                    <th className="px-3 py-2.5 text-center">Nomor</th>
                    <th className="px-3 py-2.5 text-center">Mulai</th>
                    <th className="px-3 py-2.5 text-center">Selesai</th>
                    <th className="px-3 py-2.5">Keterangan</th>
                  </>
                )}

                {subTab === 'materi' && (
                  <>
                    <th className="px-3 py-2.5">Kitab Acuan</th>
                    <th className="px-3 py-2.5 text-center">Bab Ke-</th>
                    <th className="px-3 py-2.5 text-center">Jilid</th>
                    <th className="px-3 py-2.5 text-center">Rentang Hal</th>
                  </>
                )}

                <th className="px-3 py-2.5 w-20 text-right">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {pagedList.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada data {currentTabDef?.name.toLowerCase()} yang ditemukan.
                  </td>
                </tr>
              ) : (
                pagedList.map((item: any, index: number) => {
                  const rowNumber = (safePage - 1) * pageSize + index + 1;
                  const displayCode = item.displayCode || item.display_code || '';

                  return (
                    <tr key={item.id || index} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2.5 text-center font-mono text-slate-400 text-[11px]">
                        {rowNumber}
                      </td>

                      {/* System ID */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 font-semibold">
                        {item.id || item.code}
                      </td>

                      {/* User Display Code */}
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {displayCode ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-bold text-[11px]">
                            {displayCode}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic text-[11px]">-</span>
                        )}
                      </td>

                      {/* Main Title / Name with optional color swatch */}
                      <td className="px-3 py-2.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          {item.color && (
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                              style={{ backgroundColor: item.color }}
                            />
                          )}
                          <span className="truncate max-w-[200px]" title={item.name || item.title}>
                            {item.name || item.title}
                          </span>
                        </div>
                      </td>

                      {/* Classes Columns */}
                      {subTab === 'classes' && (
                        <>
                          <td className="px-3 py-2.5 text-center text-slate-700 font-medium">Kelas {item.grade}</td>
                          <td className="px-3 py-2.5 text-center text-slate-700">{item.section}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                              {classStudentCountMap.get(item.id) ?? (item.studentCount || item.student_count || 0)} santri
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {roomMap.get(item.defaultRoomId || item.default_room_id) || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 font-mono text-[11px]">
                            {item.onlineClassLink || item.online_class_link ? (
                              <a
                                href={item.onlineClassLink || item.online_class_link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                              >
                                <span>Link KBM</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                        </>
                      )}

                      {/* Teachers Columns */}
                      {subTab === 'teachers' && (
                        <>
                          <td className="px-3 py-2.5 text-slate-700 font-medium">{item.panggilan || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-600">{item.department || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-500 font-mono">{item.email || '-'}</td>
                        </>
                      )}

                      {/* Students Columns */}
                      {subTab === 'students' && (
                        <>
                          <td className="px-3 py-2.5 font-mono text-slate-600">{item.nisn || '-'}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                item.gender === 'P'
                                  ? 'bg-pink-50 text-pink-700 border border-pink-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {item.gender === 'P' ? 'Akhwat' : 'Ikhwan'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-600">{item.phone || '-'}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-600">{item.email || '-'}</td>
                        </>
                      )}

                      {/* Rooms Columns */}
                      {subTab === 'rooms' && (
                        <>
                          <td className="px-3 py-2.5 text-slate-600">{item.building || '-'}</td>
                          <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{item.capacity || 30}</td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {ROOM_TYPES.find((t) => t.value === item.type)?.label || item.type || 'Standard'}
                          </td>
                        </>
                      )}

                      {/* Subjects Columns */}
                      {subTab === 'subjects' && (
                        <>
                          <td className="px-3 py-2.5 text-slate-600">{item.department || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-700 font-medium">
                            {teacherMap.get(item.defaultTeacherId || item.default_teacher_id) || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 font-medium">
                            {bookMap.get(item.defaultBookId || item.default_book || item.default_book_id) || '-'}
                          </td>
                        </>
                      )}

                      {/* Books Columns */}
                      {subTab === 'books' && (
                        <>
                          <td className="px-3 py-2.5 text-slate-700 font-arabic text-sm" dir="auto">
                            {item.altTitle || item.alt_title || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{item.author || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {item.edition ? (
                              <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                {item.edition}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-[11px]">
                            {(() => {
                              const chapters = item.chapters || [];
                              const totalJilid = chapters.length > 0 ? chapters.length : (item.totalChapters || item.total_chapters || 0);
                              const totalHal = chapters.length > 0
                                ? chapters.reduce((sum: number, ch: any) => sum + (Number(ch.pageEnd ?? ch.page_end) || 0), 0)
                                : (item.totalPages || item.total_pages || 0);
                              return `${totalJilid} jilid / ${totalHal} hal`;
                            })()}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {subjectMap.get(item.defaultSubjectId) || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {bookMateriCountMap.get(item.id) || 0} bab
                            </span>
                          </td>
                        </>
                      )}

                      {/* Sessions Columns */}
                      {subTab === 'sessions' && (
                        <>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700">{item.startTime}</td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700">{item.endTime}</td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-500">
                            #{item.order ?? item.sort_order ?? index + 1}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {sessionOverlapMap.has(item.id) ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs"
                                title={`Waktu beririsan dengan: ${sessionOverlapMap.get(item.id)?.join(', ')}`}
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Irisan Waktu</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                Normal
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Periods Columns */}
                      {subTab === 'periods' && (
                        <>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700">
                            #{item.periodNumber ?? item.period_number ?? index + 1}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-600">{item.startDate || item.start_date}</td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-600">{item.endDate || item.end_date}</td>
                          <td className="px-3 py-2.5 text-slate-500">{item.description || '-'}</td>
                        </>
                      )}

                      {/* Materi Columns */}
                      {subTab === 'materi' && (
                        <>
                          <td className="px-3 py-2.5 text-slate-700 font-medium">
                            {bookMap.get(item.bookId || item.bookCode) || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700">
                            Bab {item.order ?? item.order_num ?? item.no ?? index + 1}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-600">
                            {item.part ? `Jilid ${item.part}` : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-600">
                            {item.pageStart && item.pageEnd ? `Hal. ${item.pageStart}–${item.pageEnd}` : '-'}
                          </td>
                        </>
                      )}

                      {/* Action Buttons */}
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(item.id || item.code, item.name || item.title || item.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Menampilkan <span className="font-semibold text-slate-700">{pagedList.length}</span> dari{' '}
            <span className="font-semibold text-slate-700">{totalCount}</span> data
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => onPageChange(safePage - 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold text-slate-700">
              Halaman {safePage} dari {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => onPageChange(safePage + 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
