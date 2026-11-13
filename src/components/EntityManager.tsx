import React, { useState, useMemo } from 'react';
import {
  Database,
  Calendar,
  Layers,
  ArrowRight,
  Database as DatabaseIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { DatabaseState, ScheduleRule } from '../types';
import { DatabaseSubTab, ENTITY_TABS } from './database/entityConfigs';
import { EntityTable } from './database/EntityTable';
import { EntityModal } from './database/EntityModal';
import { DeleteConfirmModal } from './database/DeleteConfirmModal';
import { RoleRequestsView } from './admin/RoleRequestsView';

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

// Cross-table cascade deletion handler
function cascadeDeleteEntity(prev: DatabaseState, type: DatabaseSubTab, idToDelete: string): DatabaseState {
  const next: DatabaseState = { ...prev };

  switch (type) {
    case 'classes': {
      next.classes = (prev.classes || []).filter((c) => c.id !== idToDelete);
      next.rules = (prev.rules || []).filter((r) => r.classId !== idToDelete);
      next.syllabusScopes = (prev.syllabusScopes || []).filter((s) => s.class_section_id !== idToDelete);
      next.enrollments = (prev.enrollments || []).filter((e) => e.classId !== idToDelete);
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
    case 'students': {
      next.students = (prev.students || []).filter((s) => s.id !== idToDelete);
      next.enrollments = (prev.enrollments || []).filter((e) => e.studentId !== idToDelete);
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
      next.syllabusUnits = (prev.syllabusUnits || []).filter((u) => (u.bookId || u.bookCode) !== idToDelete);
      break;
    }
    case 'sessions': {
      next.sessions = (prev.sessions || []).filter((s) => s.id !== idToDelete);
      next.rules = (prev.rules || []).filter((r) => r.sessionId !== idToDelete);
      // Re-sort remaining sessions chronologically
      next.sessions = next.sessions
        .slice()
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
        .map((s, idx) => ({ ...s, order: idx + 1, sort_order: idx + 1 }));
      break;
    }
    case 'periods': {
      next.periods = (prev.periods || []).filter((p) => p.id !== idToDelete);
      next.rules = (prev.rules || []).map((r) => ({
        ...r,
        periodIds: (r.periodIds || []).filter((pid) => pid !== idToDelete)
      }));
      // Re-sort remaining periods chronologically
      next.periods = next.periods
        .slice()
        .sort((a, b) => (a.startDate || a.start_date || '').localeCompare(b.startDate || b.start_date || ''))
        .map((p, idx) => ({ ...p, periodNumber: idx + 1, period_number: idx + 1 }));
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

export const EntityManager: React.FC<EntityManagerProps> = ({
  db,
  onUpdateDb,
  onNavigateToExportImport,
  onNavigateToRuleManager,
  initialSubTab = 'classes',
  onSelectSubTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<DatabaseSubTab>(initialSubTab);
  const [search, setSearch] = useState('');
  const [materiBookFilter, setMateriBookFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

  // Modal states
  const [editingItem, setEditingItem] = useState<{
    type: DatabaseSubTab;
    data: any;
    isNew: boolean;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    type: DatabaseSubTab;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSubTabChange = (tab: DatabaseSubTab) => {
    setActiveSubTab(tab);
    setSearch('');
    setCurrentPage(1);
    onSelectSubTab?.(tab);
  };

  // Open Create Modal with clean defaults
  const handleOpenAdd = () => {
    const autoSuffix = Date.now().toString(36).slice(-4);
    let initialData: any = {};

    switch (activeSubTab) {
      case 'classes':
        initialData = {
          id: `cls-${autoSuffix}`,
          displayCode: '',
          name: '',
          grade: 1,
          section: 'A',
          color: '#3B82F6',
          defaultRoomId: db.rooms?.[0]?.id || undefined,
          onlineClassLink: ''
        };
        break;
      case 'teachers':
        initialData = {
          id: `tch-${autoSuffix}`,
          displayCode: '',
          name: '',
          panggilan: '',
          email: '',
          department: 'Diniyah',
          color: '#4F46E5'
        };
        break;
      case 'students':
        initialData = {
          id: `stu-${autoSuffix}`,
          displayCode: '',
          name: '',
          nisn: '',
          gender: 'L',
          phone: '',
          email: ''
        };
        break;
      case 'rooms':
        initialData = {
          id: `rm-${autoSuffix}`,
          displayCode: '',
          name: '',
          building: 'Gedung Utama',
          capacity: 30,
          type: 'Standard'
        };
        break;
      case 'subjects':
        initialData = {
          id: `sub-${autoSuffix}`,
          displayCode: '',
          name: '',
          color: '#3B82F6',
          department: 'Diniyah',
          defaultTeacherId: db.teachers?.[0]?.id || undefined,
          defaultRoomId: db.rooms?.[0]?.id || undefined,
          defaultBookId: db.books?.[0]?.id || null
        };
        break;
      case 'books':
        initialData = {
          id: `bk-${autoSuffix}`,
          displayCode: '',
          title: '',
          altTitle: '',
          author: '',
          publisher: '',
          edition: 'Cetakan ke-1',
          totalChapters: 1,
          totalPages: 100,
          defaultSubjectId: db.subjects?.[0]?.id || undefined,
          defaultTeacherId: db.teachers?.[0]?.id || undefined,
          chapters: [],
          links: []
        };
        break;
      case 'sessions':
        initialData = {
          id: `ses-${autoSuffix}`,
          displayCode: `S-${(db.sessions || []).length + 1}`,
          name: `Sesi ${(db.sessions || []).length + 1}`,
          startTime: '07:30',
          endTime: '09:00'
        };
        break;
      case 'periods':
        initialData = {
          id: `per-${autoSuffix}`,
          name: `Periode ${(db.periods || []).length + 1}`,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
          description: ''
        };
        break;
      case 'materi':
        initialData = {
          id: `mat-${autoSuffix}`,
          bookId: materiBookFilter !== 'all' ? materiBookFilter : db.books?.[0]?.id || '',
          order: (db.syllabusUnits || []).length + 1,
          part: 1,
          title: '',
          pageStart: 1,
          pageEnd: 15
        };
        break;
    }

    setEditingItem({ type: activeSubTab, data: initialData, isNew: true });
  };

  // Open Edit Modal
  const handleOpenEdit = (item: any) => {
    setEditingItem({
      type: activeSubTab,
      data: { ...item },
      isNew: false
    });
  };

  // Save entity from Modal
  const handleSaveItem = (data: any) => {
    if (!editingItem) return;
    const { type, isNew } = editingItem;
    const cleanId = String(data.id || '').trim();

    if (!cleanId) {
      showToast('ID Entitas tidak boleh kosong.', true);
      return;
    }

    const formatted: any = { ...data, id: cleanId };

    // Format displayCode without forced fallback to ID
    if (formatted.displayCode !== undefined) {
      formatted.display_code = formatted.displayCode;
    }

    onUpdateDb((prev) => {
      // Validate uniqueness on create
      if (isNew) {
        const targetList =
          type === 'materi'
            ? prev.syllabusUnits || []
            : (prev as any)[type] || [];
        if (targetList.some((it: any) => it.id === cleanId)) {
          showToast(`ID "${cleanId}" sudah digunakan. Gunakan ID lain.`, true);
          return prev;
        }
      }

      const next = { ...prev };

      // 1. Sessions: Automatic Chronological Sorting
      if (type === 'sessions') {
        const existing = (prev.sessions || []).filter((s) => s.id !== cleanId);
        const allSessions = [...existing, formatted];
        allSessions.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        next.sessions = allSessions.map((s, idx) => ({
          ...s,
          order: idx + 1,
          sort_order: idx + 1
        }));
        return next;
      }

      // 2. Periods: Automatic Chronological Sorting
      if (type === 'periods') {
        const existing = (prev.periods || []).filter((p) => p.id !== cleanId);
        const allPeriods = [...existing, formatted];
        allPeriods.sort((a, b) =>
          (a.startDate || a.start_date || '').localeCompare(b.startDate || b.start_date || '')
        );
        next.periods = allPeriods.map((p, idx) => ({
          ...p,
          periodNumber: idx + 1,
          period_number: idx + 1
        }));
        return next;
      }

      // 3. Students: Update student record WITHOUT touching enrollments
      if (type === 'students') {
        const existingStudents = prev.students || [];
        if (isNew) {
          next.students = [...existingStudents, formatted];
        } else {
          next.students = existingStudents.map((s) => (s.id === cleanId ? { ...s, ...formatted } : s));
        }
        return next;
      }

      // 4. Books: Update book with chapters and links
      if (type === 'books') {
        const existingBooks = prev.books || [];
        if (isNew) {
          next.books = [...existingBooks, formatted];
        } else {
          next.books = existingBooks.map((b) => (b.id === cleanId ? { ...b, ...formatted } : b));
        }
        return next;
      }

      // 5. Materi: Target syllabusUnits
      if (type === 'materi') {
        const existingUnits = prev.syllabusUnits || [];
        if (isNew) {
          next.syllabusUnits = [...existingUnits, formatted];
        } else {
          next.syllabusUnits = existingUnits.map((u) => (u.id === cleanId ? { ...u, ...formatted } : u));
        }
        return next;
      }

      // 6. Generic Entities (classes, teachers, rooms, subjects)
      const currentList = (prev as any)[type] || [];
      if (isNew) {
        next[type as keyof DatabaseState] = [...currentList, formatted] as any;
      } else {
        next[type as keyof DatabaseState] = currentList.map((item: any) =>
          item.id === cleanId ? { ...item, ...formatted } : item
        ) as any;
      }

      return next;
    });

    setEditingItem(null);
    showToast(isNew ? 'Data berhasil ditambahkan.' : 'Perubahan data berhasil disimpan.');
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const { id, type } = deleteTarget;
    onUpdateDb((prev) => cascadeDeleteEntity(prev, type, id));
    showToast('Data berhasil dihapus beserta sinkronisasi relasinya.');
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {toastMessage.isError ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner & Quick Hub Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
              <DatabaseIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Pusat Basis Data Master</h2>
              <p className="text-xs text-slate-500">
                Penyelarasan tabel referensi akademik, kitab ajar, ruang, pengajar, dan sesi KBM.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigateToRuleManager && (
              <button
                type="button"
                onClick={onNavigateToRuleManager}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <Layers className="w-3.5 h-3.5 text-amber-700" />
                <span>Aturan Jadwal</span>
                <ArrowRight className="w-3 h-3 text-amber-700" />
              </button>
            )}

            {onNavigateToExportImport && (
              <button
                type="button"
                onClick={onNavigateToExportImport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <span>Ekspor &amp; Impor</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation Segmented Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {ENTITY_TABS.map((tab) => {
            const count = tab.id === 'requests' ? pendingRequestsCount : tab.getCount(db);
            const isActive = activeSubTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSubTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.name}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      {activeSubTab === 'requests' ? (
        <RoleRequestsView onRefreshCount={setPendingRequestsCount} />
      ) : (
        <EntityTable
          subTab={activeSubTab}
          db={db}
          search={search}
          onSearchChange={setSearch}
          materiBookFilter={materiBookFilter}
          onMateriBookFilterChange={setMateriBookFilter}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onAddNew={handleOpenAdd}
          onEdit={handleOpenEdit}
          onDelete={(id, name) => setDeleteTarget({ id, name, type: activeSubTab })}
        />
      )}

      {/* Entity Modal (Centered Create / Edit Form) */}
      <EntityModal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveItem}
        subTab={editingItem?.type || activeSubTab}
        initialData={editingItem?.data || {}}
        isNew={editingItem?.isNew ?? false}
        db={db}
      />

      {/* In-App Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={`Hapus Data ${ENTITY_TABS.find((t) => t.id === deleteTarget?.type)?.singularName}`}
        itemName={deleteTarget?.name || deleteTarget?.id || ''}
        itemId={deleteTarget?.id || ''}
      />
    </div>
  );
};
