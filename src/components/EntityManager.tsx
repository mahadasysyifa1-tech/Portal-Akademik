import React, { useState, useMemo } from 'react';
import {
  DatabaseState,
  Subject,
  ClassEntity,
  Room,
  Teacher,
  Session,
  Period,
  Book,
  ScheduleRule
} from '../types';
import {
  Database,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  GraduationCap,
  DoorOpen,
  Users,
  Clock,
  CalendarClock,
  Layers,
  Search,
  X,
  Check,
  AlertTriangle,
  FileCode2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';

export type DatabaseSubTab =
  | 'classes'
  | 'teachers'
  | 'rooms'
  | 'subjects'
  | 'books'
  | 'sessions'
  | 'periods'
  | 'materi';

export interface EntityManagerProps {
  db: DatabaseState;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
  onExportJson?: () => void;
  onImportJson?: (jsonString: string) => void;
  onEditRule?: (rule: ScheduleRule) => void;
  onAddRule?: () => void;
  onToggleRuleActive?: (ruleId: string) => void;
  onDeleteRule?: (ruleId: string) => void;
  onNavigateToExportImport?: () => void;
  onNavigateToRuleManager?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToKaldik?: () => void;
  onNavigateToJournal?: () => void;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
  initialSubTab?: DatabaseSubTab;
  onSelectSubTab?: (subTab: DatabaseSubTab) => void;
}

function cascadeDeleteEntity(prev: DatabaseState, type: DatabaseSubTab, idToDelete: string): DatabaseState {
  const next: DatabaseState = { ...prev };

  switch (type) {
    case 'classes': {
      next.classes = (prev.classes || []).filter((c) => c.id !== idToDelete);
      next.rules = (prev.rules || []).filter((r) => r.classId !== idToDelete);
      next.syllabusScopes = (prev.syllabusScopes || []).filter((s) => s.class_section_id !== idToDelete);
      break;
    }
    case 'teachers': {
      next.teachers = (prev.teachers || []).filter((t) => t.id !== idToDelete);
      next.rules = (prev.rules || []).filter((r) => r.teacherId !== idToDelete);
      next.subjects = (prev.subjects || []).map((s) =>
        s.defaultTeacherId === idToDelete ? { ...s, defaultTeacherId: undefined, default_teacher_id: null } : s
      );
      next.books = (prev.books || []).map((b) =>
        b.defaultTeacherId === idToDelete ? { ...b, defaultTeacherId: undefined } : b
      );
      break;
    }
    case 'rooms': {
      next.rooms = (prev.rooms || []).filter((r) => r.id !== idToDelete);
      next.classes = (prev.classes || []).map((c) =>
        c.defaultRoomId === idToDelete ? { ...c, defaultRoomId: undefined, default_room_id: null } : c
      );
      next.subjects = (prev.subjects || []).map((s) =>
        s.defaultRoomId === idToDelete ? { ...s, defaultRoomId: undefined, default_room_id: null } : s
      );
      break;
    }
    case 'subjects': {
      next.subjects = (prev.subjects || []).filter((s) => s.id !== idToDelete);
      next.rules = (prev.rules || []).filter((r) => r.subjectId !== idToDelete);
      next.syllabusScopes = (prev.syllabusScopes || []).filter((s) => s.subject_id !== idToDelete);
      next.syllabusUnits = (prev.syllabusUnits || []).map((u) =>
        u.subject_id === idToDelete ? { ...u, subject_id: undefined } : u
      );
      next.books = (prev.books || []).map((b) =>
        b.defaultSubjectId === idToDelete ? { ...b, defaultSubjectId: undefined } : b
      );
      break;
    }
    case 'books': {
      next.books = (prev.books || []).filter((b) => b.id !== idToDelete);
      next.subjects = (prev.subjects || []).map((s) =>
        s.default_book === idToDelete || s.defaultBookId === idToDelete
          ? { ...s, default_book: null, defaultBookId: null }
          : s
      );
      next.syllabusScopes = (prev.syllabusScopes || []).map((s) => ({
        ...s,
        book_id: s.book_id === idToDelete ? undefined : s.book_id,
        book_ids: (s.book_ids || []).filter((bId) => bId !== idToDelete),
        items: (s.items || []).filter((it) => it.bookId !== idToDelete)
      }));
      break;
    }
    case 'sessions': {
      next.sessions = (prev.sessions || []).filter((s) => s.id !== idToDelete);
      next.rules = (prev.rules || []).filter((r) => r.sessionId !== idToDelete);
      break;
    }
    case 'periods': {
      next.periods = (prev.periods || []).filter((p) => p.id !== idToDelete);
      next.rules = (prev.rules || []).map((r) => ({
        ...r,
        periodIds: (r.periodIds || []).filter((pid) => pid !== idToDelete)
      }));
      break;
    }
    case 'materi': {
      next.syllabusUnits = (prev.syllabusUnits || []).filter((u) => u.id !== idToDelete);
      next.syllabusScopes = (prev.syllabusScopes || []).map((s) => ({
        ...s,
        start_unit_id: s.start_unit_id === idToDelete ? '' : s.start_unit_id,
        end_unit_id: s.end_unit_id === idToDelete ? '' : s.end_unit_id,
        items: (s.items || []).filter(
          (it) => it.startMaterialId !== idToDelete && it.endMaterialId !== idToDelete
        )
      }));
      break;
    }
  }

  return next;
}

// ----------------------------------------------------------------------------
// Main Flat Database Browser Component
// ----------------------------------------------------------------------------
export const EntityManager: React.FC<EntityManagerProps> = ({
  db,
  onUpdateDb,
  onExportJson,
  onImportJson,
  initialSubTab = 'classes',
  onSelectSubTab,
  onNavigateToExportImport
}) => {
  const [subTab, setSubTab] = useState<DatabaseSubTab>(initialSubTab);
  const [search, setSearch] = useState('');
  const [materiBookFilter, setMateriBookFilter] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [editingItem, setEditingItem] = useState<{ type: DatabaseSubTab; data: any; isNew: boolean } | null>(null);

  const handleSubTabChange = (t: DatabaseSubTab) => {
    setSubTab(t);
    setSearch('');
    setMateriBookFilter('all');
    setCurrentPage(1);
    if (onSelectSubTab) onSelectSubTab(t);
  };

  const TABLE_DEFS = [
    { id: 'classes' as const, name: 'Kelas', icon: Layers, count: (db.classes || []).length },
    { id: 'teachers' as const, name: 'Guru', icon: Users, count: (db.teachers || []).length },
    { id: 'rooms' as const, name: 'Ruang', icon: DoorOpen, count: (db.rooms || []).length },
    { id: 'subjects' as const, name: 'Mapel', icon: GraduationCap, count: (db.subjects || []).length },
    { id: 'books' as const, name: 'Buku', icon: BookOpen, count: (db.books || []).length },
    { id: 'sessions' as const, name: 'Sesi', icon: Clock, count: (db.sessions || []).length },
    { id: 'periods' as const, name: 'Periode', icon: CalendarClock, count: (db.periods || []).length },
    { id: 'materi' as const, name: 'Materi', icon: Database, count: (db.syllabusUnits || []).length }
  ];

  // Helper maps for displaying relational labels
  const teacherMap = useMemo(() => new Map((db.teachers || []).map((t) => [t.id, t.panggilan || t.name])), [db.teachers]);
  const roomMap = useMemo(() => new Map((db.rooms || []).map((r) => [r.id, r.name])), [db.rooms]);
  const subjectMap = useMemo(() => new Map((db.subjects || []).map((s) => [s.id, s.name])), [db.subjects]);
  const bookMap = useMemo(() => new Map((db.books || []).map((b) => [b.id, b.title])), [db.books]);

  // Filter current table records
  const currentList = useMemo(() => {
    let list: any[] = [];
    switch (subTab) {
      case 'classes': list = db.classes || []; break;
      case 'teachers': list = db.teachers || []; break;
      case 'rooms': list = db.rooms || []; break;
      case 'subjects': list = db.subjects || []; break;
      case 'books': list = db.books || []; break;
      case 'sessions': list = db.sessions || []; break;
      case 'periods': list = db.periods || []; break;
      case 'materi': {
        list = db.syllabusUnits || [];
        if (materiBookFilter !== 'all') {
          list = list.filter((it) => it.bookId === materiBookFilter);
        }
        // sort by book and order
        list = [...list].sort((a, b) => {
          if (a.bookId !== b.bookId) return (a.bookId || '').localeCompare(b.bookId || '');
          return (a.order ?? 0) - (b.order ?? 0);
        });
        break;
      }
      default: list = [];
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((item) => {
      const matchId = String(item.id || '').toLowerCase().includes(q);
      const matchCode = String(item.displayCode || (item as any).display_code || item.code || '').toLowerCase().includes(q);
      const matchName = String(item.name || item.title || '').toLowerCase().includes(q);
      const matchAlt = String(item.altTitle || item.department || item.panggilan || '').toLowerCase().includes(q);
      const matchBook = subTab === 'materi' && String(bookMap.get(item.bookId) || '').toLowerCase().includes(q);
      const matchBab = subTab === 'materi' && (`bab ${item.order}`.includes(q) || String(item.order).includes(q));
      return matchId || matchCode || matchName || matchAlt || matchBook || matchBab;
    });
  }, [subTab, db, search, materiBookFilter, bookMap]);

  // Pagination calculations
  const totalPagesCount = Math.max(1, Math.ceil(currentList.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPagesCount);
  const pagedList = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return currentList.slice(start, start + pageSize);
  }, [currentList, safeCurrentPage, pageSize]);

  // Open creation modal for current table
  const handleOpenCreate = () => {
    let initialData: any = {};
    const autoId = `${subTab.slice(0, 3)}-${Date.now().toString(36).slice(-4)}`;

    switch (subTab) {
      case 'classes':
        initialData = {
          id: autoId,
          display_code: '',
          name: '',
          grade: 10,
          section: 'A',
          studentCount: 30,
          defaultRoomId: (db.rooms && db.rooms[0]) ? db.rooms[0].id : '',
          onlineClassLink: '',
          color: '#3B82F6'
        };
        break;
      case 'teachers':
        initialData = {
          id: autoId,
          display_code: '',
          name: '',
          panggilan: '',
          email: '',
          department: 'Diniyyah',
          maxPeriodsPerWeek: 18,
          color: '#0284C7'
        };
        break;
      case 'rooms':
        initialData = {
          id: autoId,
          display_code: '',
          name: '',
          building: 'Gedung Utama',
          capacity: 30,
          type: 'Standard'
        };
        break;
      case 'subjects':
        initialData = {
          id: autoId,
          display_code: '',
          name: '',
          color: '#3B82F6',
          department: 'Diniyyah',
          defaultTeacherId: (db.teachers && db.teachers[0]) ? db.teachers[0].id : '',
          defaultRoomId: (db.rooms && db.rooms[0]) ? db.rooms[0].id : '',
          defaultBookId: (db.books && db.books[0]) ? db.books[0].id : ''
        };
        break;
      case 'books':
        initialData = {
          id: autoId,
          display_code: '',
          title: '',
          altTitle: '',
          author: '',
          publisher: '',
          edition: 'Jilid 1',
          totalChapters: 10,
          totalPages: 100,
          defaultSubjectId: (db.subjects && db.subjects[0]) ? db.subjects[0].id : '',
          defaultTeacherId: (db.teachers && db.teachers[0]) ? db.teachers[0].id : ''
        };
        break;
      case 'sessions':
        initialData = {
          id: autoId,
          display_code: `S${(db.sessions || []).length + 1}`,
          name: `Sesi ${(db.sessions || []).length + 1}`,
          order: (db.sessions || []).length + 1,
          startTime: '07:30',
          endTime: '09:00'
        };
        break;
      case 'periods':
        initialData = {
          id: autoId,
          name: `Periode ${(db.periods || []).length + 1}`,
          periodNumber: (db.periods || []).length + 1,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date().toISOString().slice(0, 10),
          description: ''
        };
        break;
      case 'materi':
        initialData = {
          id: `mat-${Date.now().toString(36).slice(-4)}`,
          title: '',
          bookId: materiBookFilter !== 'all' ? materiBookFilter : ((db.books && db.books[0]) ? db.books[0].id : ''),
          order: (db.syllabusUnits || []).length + 1,
          page_start: 1,
          page_end: 10,
          part: '1',
          no: (db.syllabusUnits || []).length + 1,
          eno: 10
        };
        break;
    }

    setEditingItem({ type: subTab, data: initialData, isNew: true });
  };

  // Save entity from edit/create modal
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const { type, data, isNew } = editingItem;
    const cleanId = String(data.id || '').trim();
    if (!cleanId) {
      alert('Kode / ID entitas wajib diisi.');
      return;
    }

    const formattedData: any = { ...data, id: cleanId };
    if (type === 'classes') {
      formattedData.grade = Number(data.grade) || 1;
      formattedData.studentCount = Number(data.studentCount ?? data.student_count) || 0;
      formattedData.student_count = formattedData.studentCount;
      formattedData.defaultRoomId = data.defaultRoomId || undefined;
      formattedData.default_room_id = data.defaultRoomId || null;
    } else if (type === 'teachers') {
      formattedData.maxPeriodsPerWeek = Number(data.maxPeriodsPerWeek ?? data.max_periods_per_week) || 18;
      formattedData.max_periods_per_week = formattedData.maxPeriodsPerWeek;
    } else if (type === 'rooms') {
      formattedData.capacity = Number(data.capacity) || 30;
    } else if (type === 'subjects') {
      formattedData.defaultTeacherId = data.defaultTeacherId || undefined;
      formattedData.default_teacher_id = data.defaultTeacherId || null;
      formattedData.defaultRoomId = data.defaultRoomId || undefined;
      formattedData.default_room_id = data.defaultRoomId || null;
      formattedData.default_book = data.defaultBookId || null;
      formattedData.defaultBookId = data.defaultBookId || null;
      formattedData.default_book_id = data.defaultBookId || null;
    } else if (type === 'books') {
      formattedData.totalChapters = Number(data.totalChapters) || 0;
      formattedData.totalPages = Number(data.totalPages) || 0;
      formattedData.defaultSubjectId = data.defaultSubjectId || undefined;
      formattedData.defaultTeacherId = data.defaultTeacherId || undefined;
    } else if (type === 'sessions') {
      formattedData.order = Number(data.order ?? data.sort_order) || 1;
      formattedData.sort_order = formattedData.order;
    } else if (type === 'periods') {
      formattedData.periodNumber = Number(data.periodNumber ?? data.period_number) || 1;
      formattedData.period_number = formattedData.periodNumber;
    } else if (type === 'materi') {
      formattedData.order = Number(data.order) || 1;
      formattedData.no = formattedData.order;
      formattedData.page_start = data.page_start ? Number(data.page_start) : undefined;
      formattedData.page_end = data.page_end ? Number(data.page_end) : undefined;
      formattedData.pageStart = formattedData.page_start;
      formattedData.pageEnd = formattedData.page_end;
    }

    onUpdateDb((prev) => {
      if (isNew) {
        // Prevent duplicate IDs
        const existingList = type === 'materi' ? (prev.syllabusUnits || []) : ((prev as any)[type] || []);
        if (existingList.some((item: any) => item.id === cleanId)) {
          alert(`ID/Kode "${cleanId}" sudah digunakan. Gunakan ID lain.`);
          return prev;
        }
        if (type === 'materi') {
          return {
            ...prev,
            syllabusUnits: [...existingList, formattedData]
          };
        }
        return {
          ...prev,
          [type]: [...existingList, formattedData]
        };
      } else {
        const targetKey = type === 'materi' ? 'syllabusUnits' : type;
        const currentList = (prev as any)[targetKey] || [];
        return {
          ...prev,
          [targetKey]: currentList.map((item: any) =>
            item.id === cleanId ? { ...item, ...formattedData } : item
          )
        };
      }
    });

    setEditingItem(null);
  };

  // Delete entity with cross-table warning & confirmation
  const handleDeleteItem = (id: string, name: string) => {
    if (window.confirm(`Hapus ${name} (${id})?\n\nSemua relasi di tabel lain (jadwal, lingkup silabus, guru default, dll.) akan otomatis disinkronkan.`)) {
      onUpdateDb((prev) => cascadeDeleteEntity(prev, subTab, id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200/70 text-indigo-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Penjelajah Database Induk</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tabel database yang terhubung real-time ke Turso Cloud dengan sinkronisasi relasi otomatis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {onNavigateToExportImport && (
              <button
                type="button"
                onClick={onNavigateToExportImport}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="Buka menu backup dan restore JSON database"
              >
                <FileCode2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>JSON Backup</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah {TABLE_DEFS.find((t) => t.id === subTab)?.name}</span>
            </button>
          </div>
        </div>

        {/* Subtabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto mt-4 pt-3 border-t border-slate-100 pb-1 scrollbar-thin">
          {TABLE_DEFS.map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSubTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Flat Database Table View */}
      <div className="space-y-3">
        {/* Controls Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={
                  subTab === 'materi'
                    ? 'Cari ID materi, judul bab, nomor bab, atau nama kitab...'
                    : `Cari dalam tabel ${TABLE_DEFS.find((t) => t.id === subTab)?.name}...`
                }
                className="w-full text-xs pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Book Filter for Materi */}
            {subTab === 'materi' && (
              <div className="flex items-center gap-1.5 shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={materiBookFilter}
                  onChange={(e) => {
                    setMateriBookFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[200px] truncate"
                >
                  <option value="all">Semua Kitab ({db.books?.length || 0})</option>
                  {(db.books || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium shrink-0 self-end sm:self-auto">
            Ditemukan <strong className="text-slate-800">{currentList.length}</strong> data
          </div>
        </div>

        {/* Flat Database Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <tr>
                  <th className="px-3 py-2.5 w-12 text-center">No</th>
                  <th className="px-3 py-2.5 w-30 whitespace-normal font-mono">ID Sistem</th>
                  <th className="px-3 py-2.5 font-mono">Kode</th>
                  <th className="px-3 py-2.5">Nama / Judul</th>
                  {subTab === 'classes' && (
                    <>
                      <th className="px-3 py-2.5 text-center">Tingkat</th>
                      <th className="px-3 py-2.5 text-center">Bagian</th>
                      <th className="px-3 py-2.5 text-center">Santri</th>
                      <th className="px-3 py-2.5">Ruang Default</th>
                    </>
                  )}
                  {subTab === 'teachers' && (
                    <>
                      <th className="px-3 py-2.5">Panggilan</th>
                      <th className="px-3 py-2.5">Departemen</th>
                      <th className="px-3 py-2.5 text-center">Beban Mgg</th>
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
                      <th className="px-3 py-2.5">Buku Default</th>
                    </>
                  )}
                  {subTab === 'books' && (
                    <>
                      <th className="px-3 py-2.5">Judul Alt</th>
                      <th className="px-3 py-2.5">Pengarang</th>
                      <th className="px-3 py-2.5 text-center">Jilid / Hal</th>
                      <th className="px-3 py-2.5">Mapel Terkait</th>
                    </>
                  )}
                  {subTab === 'sessions' && (
                    <>
                      <th className="px-3 py-2.5 text-center">Urutan</th>
                      <th className="px-3 py-2.5 text-center">Jam Mulai</th>
                      <th className="px-3 py-2.5 text-center">Jam Selesai</th>
                    </>
                  )}
                  {subTab === 'periods' && (
                    <>
                      <th className="px-3 py-2.5 text-center">No Periode</th>
                      <th className="px-3 py-2.5 text-center">Mulai</th>
                      <th className="px-3 py-2.5 text-center">Selesai</th>
                    </>
                  )}
                  {subTab === 'materi' && (
                    <>
                      <th className="px-3 py-2.5">Buku / Kitab Acuan</th>
                      <th className="px-3 py-2.5 text-center">Urutan / Bab</th>
                      <th className="px-3 py-2.5 text-center">Rentang Hal</th>
                      <th className="px-3 py-2.5 text-center">Bobot</th>
                    </>
                  )}
                  <th className="px-3 py-2.5 w-24 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedList.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  pagedList.map((item, index) => {
                    const rowNumber = (safeCurrentPage - 1) * pageSize + index + 1;
                    const codeDisplay = item.displayCode || (item as any).display_code || item.code || item.id;
                    return (
                      <tr key={item.id || index} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3 py-2.5 text-center font-mono text-slate-400 text-[11px]">
                          {rowNumber}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 whitespace-normal font-mono text-[11px] font-semibold">
                          {item.id}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-bold">
                            {codeDisplay}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900">
                          {item.name || item.title}
                        </td>

                        {/* Classes Columns */}
                        {subTab === 'classes' && (
                          <>
                            <td className="px-3 py-2.5 text-center">Kelas {item.grade}</td>
                            <td className="px-3 py-2.5 text-center">{item.section}</td>
                            <td className="px-3 py-2.5 text-center">{item.studentCount || item.student_count || 0}</td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {roomMap.get(item.defaultRoomId || item.default_room_id) || '-'}
                            </td>
                          </>
                        )}

                        {/* Teachers Columns */}
                        {subTab === 'teachers' && (
                          <>
                            <td className="px-3 py-2.5 text-slate-700">{item.panggilan || '-'}</td>
                            <td className="px-3 py-2.5 text-slate-600">{item.department || '-'}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-indigo-700">
                              {item.maxPeriodsPerWeek || item.max_periods_per_week || 18} jam
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 font-mono">{item.email || '-'}</td>
                          </>
                        )}

                        {/* Rooms Columns */}
                        {subTab === 'rooms' && (
                          <>
                            <td className="px-3 py-2.5 text-slate-600">{item.building || '-'}</td>
                            <td className="px-3 py-2.5 text-center">{item.capacity || 30}</td>
                            <td className="px-3 py-2.5 text-slate-600">{item.type || 'Standard'}</td>
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
                              {bookMap.get(item.default_book || item.defaultBookId || item.primary_book_code) || '-'}
                            </td>
                          </>
                        )}

                        {/* Books Columns */}
                        {subTab === 'books' && (
                          <>
                            <td className="px-3 py-2.5 text-slate-600">{item.altTitle || '-'}</td>
                            <td className="px-3 py-2.5 text-slate-600">{item.author || '-'}</td>
                            <td className="px-3 py-2.5 text-center font-mono">
                              {(() => {
                                const chapters = item.chapters || [];
                                const totalJilid = chapters.length > 0 ? chapters.length : (item.totalChapters || 0);
                                const cumulativePages = chapters.length > 0
                                  ? chapters.reduce((sum: number, ch: any) => sum + (Number(ch.pageEnd ?? ch.page_end) || 0), 0)
                                  : (item.totalPages || 0);
                                return `${totalJilid} jilid / ${cumulativePages} hal`;
                              })()}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700">
                              {subjectMap.get(item.defaultSubjectId) || '-'}
                            </td>
                          </>
                        )}

                        {/* Sessions Columns */}
                        {subTab === 'sessions' && (
                          <>
                            <td className="px-3 py-2.5 text-center font-mono">{item.order || item.sort_order || 1}</td>
                            <td className="px-3 py-2.5 text-center font-mono text-emerald-700">{item.startTime || item.start_time}</td>
                            <td className="px-3 py-2.5 text-center font-mono text-rose-700">{item.endTime || item.end_time}</td>
                          </>
                        )}

                        {/* Periods Columns */}
                        {subTab === 'periods' && (
                          <>
                            <td className="px-3 py-2.5 text-center font-mono">{item.periodNumber || item.period_number || 1}</td>
                            <td className="px-3 py-2.5 text-center font-mono">{item.startDate || item.start_date}</td>
                            <td className="px-3 py-2.5 text-center font-mono">{item.endDate || item.end_date}</td>
                          </>
                        )}

                        {/* Materi Columns */}
                        {subTab === 'materi' && (
                          <>
                            <td className="px-3 py-2.5 text-slate-700 font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span>{bookMap.get(item.bookId) || item.bookId || '-'}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono font-semibold text-slate-800">
                              Bab {item.order ?? 1}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-slate-600">
                              {item.page_start
                                ? String(item.page_start) === String(item.page_end)
                                  ? `Hal ${item.page_start}`
                                  : `Hal ${item.page_start}–${item.page_end}`
                                : '-'}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-indigo-700 font-semibold">
                              {typeof item.page_end === 'number' && typeof item.page_start === 'number'
                                ? `${item.page_end - item.page_start + 1} hal`
                                : item.eno
                                ? `${item.eno} hal`
                                : '1 hal'}
                            </td>
                          </>
                        )}

                        {/* Row Actions */}
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingItem({
                                  type: subTab,
                                  data: { ...item, _originalId: item.id },
                                  isNew: false
                                })
                              }
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Entitas"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id, item.name || item.title || item.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Entitas"
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

          {/* Pagination & Row Count Limit Bar */}
          <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                Menampilkan{' '}
                <strong className="text-slate-700">
                  {currentList.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
                </strong>{' '}
                –{' '}
                <strong className="text-slate-700">
                  {Math.min(safeCurrentPage * pageSize, currentList.length)}
                </strong>{' '}
                dari <strong className="text-slate-700">{currentList.length}</strong> entitas
              </span>

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

              <div className="flex items-center gap-1.5 text-slate-500">
                <span>Baris per halaman:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {totalPagesCount > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1 px-2 text-xs font-semibold text-slate-700">
                  <span>Halaman</span>
                  <span className="bg-white px-2 py-0.5 border border-slate-200 rounded text-indigo-700 font-bold shadow-2xs">
                    {safeCurrentPage}
                  </span>
                  <span className="text-slate-400">dari {totalPagesCount}</span>
                </div>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPagesCount}
                  onClick={() => setCurrentPage((p) => Math.min(totalPagesCount, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Halaman Selanjutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Flat Create / Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-3.5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>
                  {editingItem.isNew ? 'Tambah' : 'Edit'}{' '}
                  {TABLE_DEFS.find((t) => t.id === editingItem.type)?.name}
                </span>
                {/* Compact Read-only System ID Pill */}
                <div className="flex items-center justify-between px-3 gap-2 rounded-lg text-slate-600">
                  <span className="text-[11px] font-semibold text-slate-500">ID Entitas:</span>
                  <span className="font-mono text-xs font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded shadow-s">
                    {editingItem.data.id || '(Otomatis)'}
                  </span>
                </div>

              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">

              {/* Display Code (for all except materi and periods) */}
              {editingItem.type !== 'materi' && editingItem.type !== 'periods' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kode Singkatan (Display Code)
                  </label>
                  <input
                    type="text"
                    value={editingItem.data.displayCode || (editingItem.data as any).display_code || editingItem.data.code || editingItem.data.id || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: {
                          ...editingItem.data,
                          displayCode: e.target.value,
                          display_code: e.target.value,
                          code: e.target.value
                        }
                      })
                    }
                    placeholder="Contoh: 10-A / Ust. Ridwan / ARB / R-101 / S1..."
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Label singkatan untuk tampilan tabel, kalender, dan jadwal. Bebas diubah kapan saja.
                  </p>
                </div>
              )}

              {/* Name / Title */}
              {editingItem.type !== 'materi' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {editingItem.type === 'books' ? 'Judul Buku *' : 'Nama / Judul *'}
                  </label>
                  <input
                    type="text"
                    value={editingItem.data.name || editingItem.data.title || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: {
                          ...editingItem.data,
                          name: e.target.value,
                          title: e.target.value
                        }
                      })
                    }
                    required
                    placeholder="Nama entitas..."
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                  />
                </div>
              )}

              {/* 1. Specific fields for Classes */}
              {editingItem.type === 'classes' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tingkat (Grade)</label>
                      <input
                        type="number"
                        min={1}
                        value={editingItem.data.grade ?? 10}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, grade: parseInt(e.target.value) || 1 }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Rombel / Bagian</label>
                      <input
                        type="text"
                        value={editingItem.data.section || 'A'}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, section: e.target.value }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Jumlah Santri</label>
                      <input
                        type="number"
                        min={0}
                        value={editingItem.data.studentCount ?? editingItem.data.student_count ?? 30}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: {
                              ...editingItem.data,
                              studentCount: parseInt(e.target.value) || 0,
                              student_count: parseInt(e.target.value) || 0
                            }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Ruang Default</label>
                      <select
                        value={editingItem.data.defaultRoomId || editingItem.data.default_room_id || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: {
                              ...editingItem.data,
                              defaultRoomId: e.target.value || undefined,
                              default_room_id: e.target.value || null
                            }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="">-- Tanpa Ruang Default --</option>
                        {(db.rooms || []).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} [{r.id}]
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Warna Badge</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={editingItem.data.color || '#3B82F6'}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              data: { ...editingItem.data, color: e.target.value }
                            })
                          }
                          className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-slate-50 shrink-0"
                        />
                        <input
                          type="text"
                          value={editingItem.data.color || '#3B82F6'}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              data: { ...editingItem.data, color: e.target.value }
                            })
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Link Online Class (Meet / Zoom)</label>
                    <input
                      type="url"
                      value={editingItem.data.onlineClassLink || editingItem.data.online_class_link || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: {
                            ...editingItem.data,
                            onlineClassLink: e.target.value,
                            online_class_link: e.target.value
                          }
                        })
                      }
                      placeholder="https://meet.google.com/..."
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* 2. Specific fields for Teachers */}
              {editingItem.type === 'teachers' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Panggilan</label>
                      <input
                        type="text"
                        value={editingItem.data.panggilan || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, panggilan: e.target.value }
                          })
                        }
                        placeholder="Contoh: Ust. Ridwan"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editingItem.data.email || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, email: e.target.value }
                          })
                        }
                        placeholder="guru@sekolah.sch.id"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Departemen</label>
                      <input
                        type="text"
                        value={editingItem.data.department || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, department: e.target.value }
                          })
                        }
                        placeholder="Diniyyah / Umum"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Beban Max Jam/Mgg</label>
                      <input
                        type="number"
                        min={1}
                        value={editingItem.data.maxPeriodsPerWeek || editingItem.data.max_periods_per_week || 18}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: {
                              ...editingItem.data,
                              maxPeriodsPerWeek: parseInt(e.target.value) || 18,
                              max_periods_per_week: parseInt(e.target.value) || 18
                            }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Warna Badge</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={editingItem.data.color || '#0284C7'}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              data: { ...editingItem.data, color: e.target.value }
                            })
                          }
                          className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-slate-50 shrink-0"
                        />
                        <input
                          type="text"
                          value={editingItem.data.color || '#0284C7'}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              data: { ...editingItem.data, color: e.target.value }
                            })
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Specific fields for Rooms */}
              {editingItem.type === 'rooms' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Gedung</label>
                    <input
                      type="text"
                      value={editingItem.data.building || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, building: e.target.value }
                        })
                      }
                      placeholder="Gedung Utama"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kapasitas</label>
                    <input
                      type="number"
                      min={1}
                      value={editingItem.data.capacity ?? 30}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, capacity: parseInt(e.target.value) || 30 }
                        })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tipe Ruangan</label>
                    <select
                      value={editingItem.data.type || 'Standard'}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, type: e.target.value }
                        })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="Standard">Standard</option>
                      <option value="Laboratorium Komputer">Lab Komputer</option>
                      <option value="Laboratorium IPA">Lab IPA</option>
                      <option value="Aula">Aula</option>
                      <option value="Masjid">Masjid</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 4. Specific fields for Subjects */}
              {editingItem.type === 'subjects' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Departemen / Kategori</label>
                      <input
                        type="text"
                        value={editingItem.data.department || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, department: e.target.value }
                          })
                        }
                        placeholder="Diniyyah / Bahasa / Umum"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Warna Badge Mapel</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={editingItem.data.color || '#3B82F6'}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              data: { ...editingItem.data, color: e.target.value }
                            })
                          }
                          className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-slate-50 shrink-0"
                        />
                        <input
                          type="text"
                          value={editingItem.data.color || '#3B82F6'}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              data: { ...editingItem.data, color: e.target.value }
                            })
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Guru Default</label>
                      <select
                        value={editingItem.data.defaultTeacherId || editingItem.data.default_teacher_id || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: {
                              ...editingItem.data,
                              defaultTeacherId: e.target.value || undefined,
                              default_teacher_id: e.target.value || null
                            }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="">-- Tanpa Guru --</option>
                        {(db.teachers || []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.panggilan || t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Ruang Default</label>
                      <select
                        value={editingItem.data.defaultRoomId || editingItem.data.default_room_id || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: {
                              ...editingItem.data,
                              defaultRoomId: e.target.value || undefined,
                              default_room_id: e.target.value || null
                            }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="">-- Tanpa Ruang --</option>
                        {(db.rooms || []).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Kitab Acuan</label>
                      <select
                        value={editingItem.data.defaultBookId || editingItem.data.default_book || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: {
                              ...editingItem.data,
                              defaultBookId: e.target.value || null,
                              default_book: e.target.value || null,
                              default_book_id: e.target.value || null
                            }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="">-- Tanpa Kitab --</option>
                        {(db.books || []).map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Specific fields for Books */}
              {editingItem.type === 'books' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Judul Arab / Alternatif</label>
                      <input
                        type="text"
                        value={editingItem.data.altTitle || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, altTitle: e.target.value }
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
                        value={editingItem.data.author || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, author: e.target.value }
                          })
                        }
                        placeholder="Nama Muallif"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Penerbit</label>
                      <input
                        type="text"
                        value={editingItem.data.publisher || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, publisher: e.target.value }
                          })
                        }
                        placeholder="Darul Kutub / Toha Putra"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Edisi / Jilid</label>
                      <input
                        type="text"
                        value={editingItem.data.edition || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, edition: e.target.value }
                          })
                        }
                        placeholder="Jilid 1 / Cet. 2"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Jumlah Jilid
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={
                          editingItem.data.chapters && editingItem.data.chapters.length > 0
                            ? editingItem.data.chapters.length
                            : (editingItem.data.totalChapters ?? 1)
                        }
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, totalChapters: parseInt(e.target.value) || 0 }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Jumlah Halaman {editingItem.data.chapters && editingItem.data.chapters.length > 0 ? '(Kumulatif)' : ''}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={
                          editingItem.data.chapters && editingItem.data.chapters.length > 0
                            ? editingItem.data.chapters.reduce((sum: number, ch: any) => sum + (Number(ch.pageEnd ?? ch.page_end) || 0), 0)
                            : (editingItem.data.totalPages ?? 0)
                        }
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, totalPages: parseInt(e.target.value) || 0 }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Mapel Terkait</label>
                      <select
                        value={editingItem.data.defaultSubjectId || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, defaultSubjectId: e.target.value || undefined }
                          })
                        }
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
                        value={editingItem.data.defaultTeacherId || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, defaultTeacherId: e.target.value || undefined }
                          })
                        }
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
                </div>
              )}

              {/* 6. Specific fields for Sessions */}
              {editingItem.type === 'sessions' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nomor Urut</label>
                    <input
                      type="number"
                      min={1}
                      value={editingItem.data.order ?? editingItem.data.sort_order ?? 1}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: {
                            ...editingItem.data,
                            order: parseInt(e.target.value) || 1,
                            sort_order: parseInt(e.target.value) || 1
                          }
                        })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Jam Mulai</label>
                    <input
                      type="time"
                      value={editingItem.data.startTime || '07:30'}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, startTime: e.target.value }
                        })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Jam Selesai</label>
                    <input
                      type="time"
                      value={editingItem.data.endTime || '09:00'}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, endTime: e.target.value }
                        })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* 7. Specific fields for Periods */}
              {editingItem.type === 'periods' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nomor Periode</label>
                      <input
                        type="number"
                        min={1}
                        value={editingItem.data.periodNumber ?? editingItem.data.period_number ?? 1}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: {
                              ...editingItem.data,
                              periodNumber: parseInt(e.target.value) || 1,
                              period_number: parseInt(e.target.value) || 1
                            }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tanggal Mulai</label>
                      <input
                        type="date"
                        value={editingItem.data.startDate || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, startDate: e.target.value }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tanggal Selesai</label>
                      <input
                        type="date"
                        value={editingItem.data.endDate || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, endDate: e.target.value }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Keterangan / Deskripsi</label>
                    <input
                      type="text"
                      value={editingItem.data.description || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, description: e.target.value }
                        })
                      }
                      placeholder="Contoh: Siklus 1 - Persiapan KBM Awal Tahun"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              {/* 8. Specific fields for Materi Silabus */}
              {editingItem.type === 'materi' && (
                <div className="space-y-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Buku Acuan *</label>
                    <select
                      value={editingItem.data.bookId || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, bookId: e.target.value }
                        })
                      }
                      required
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="">-- Pilih Buku Acuan --</option>
                      {(db.books || []).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} [{b.id}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Judul Bab / Pokok Bahasan *</label>
                    <input
                      type="text"
                      value={editingItem.data.title || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, title: e.target.value }
                        })
                      }
                      required
                      placeholder="Contoh: Bab 1 - Mukaddimah dan Pembagian Kalam"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Bab / Urut *</label>
                      <input
                        type="number"
                        min={1}
                        value={editingItem.data.order ?? 1}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: {
                              ...editingItem.data,
                              order: parseInt(e.target.value) || 1,
                              no: parseInt(e.target.value) || 1
                            }
                          })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Jilid / Juz</label>
                      <input
                        type="text"
                        value={editingItem.data.part ?? '1'}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, part: e.target.value }
                          })
                        }
                        placeholder="1"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Hal Mulai</label>
                      <input
                        type="number"
                        min={1}
                        value={editingItem.data.page_start ?? ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, page_start: parseInt(e.target.value) || 1 }
                          })
                        }
                        placeholder="1"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Hal Akhir</label>
                      <input
                        type="number"
                        min={1}
                        value={editingItem.data.page_end ?? ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, page_end: parseInt(e.target.value) || 1 }
                          })
                        }
                        placeholder="12"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-2xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
