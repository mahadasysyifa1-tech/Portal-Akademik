import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  CalendarDays,
  Clock,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  GraduationCap,
  Sparkles,
  BookOpen,
  Coffee,
  Sun,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { DatabaseState, KaldikEvent, KaldikEventType, Period } from '../../types';
import { KaldikEventModal } from '../kaldik/KaldikEventModal';

interface KaldikEventsDatabaseTabProps {
  db: DatabaseState;
  onUpdateDb?: React.Dispatch<React.SetStateAction<DatabaseState>> | ((updater: (prev: DatabaseState) => DatabaseState) => void);
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
}

const TYPE_CONFIG: Record<KaldikEventType, { label: string; badgeClass: string; icon: React.FC<{ className?: string }> }> = {
  kbm: {
    label: 'KBM Resmi',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    icon: BookOpen
  },
  holiday: {
    label: 'Hari Libur',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    icon: Coffee
  },
  exam: {
    label: 'Asesmen / Ujian',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: GraduationCap
  },
  activity: {
    label: 'Kegiatan Santri',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: Sun
  },
  general: {
    label: 'Umum / Akademik',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: Calendar
  }
};

const INDONESIAN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2];
  const monthName = INDONESIAN_MONTHS[monthIdx] || parts[1];
  return `${day} ${monthName} ${year}`;
}

function calculateDaysSpan(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 1;
  const d1 = new Date(startStr);
  const d2 = new Date(endStr);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays || 1;
}

export const KaldikEventsDatabaseTab: React.FC<KaldikEventsDatabaseTabProps> = ({
  db,
  onUpdateDb,
  isAdmin = true,
  onOpenAdminLogin
}) => {
  const events = useMemo(() => db.kaldikEvents || [], [db.kaldikEvents]);
  const periods = useMemo(
    () => [...(db.periods || [])].sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0)),
    [db.periods]
  );
  const periodMap = useMemo(() => new Map<string, Period>(periods.map(p => [p.id, p])), [periods]);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterRecurrence, setFilterRecurrence] = useState<string>('all');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<KaldikEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<KaldikEvent | null>(null);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      if (filterType !== 'all') {
        if (filterType === 'kbm' && !(evt.isKbm || evt.type === 'kbm')) return false;
        if (filterType !== 'kbm' && evt.type !== filterType) return false;
      }

      if (filterPeriod !== 'all' && evt.periodId !== filterPeriod) {
        return false;
      }

      if (filterRecurrence === 'recurring' && !evt.isRecurring) return false;
      if (filterRecurrence === 'once' && evt.isRecurring) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const titleMatch = (evt.title || '').toLowerCase().includes(q);
        const descMatch = (evt.description || '').toLowerCase().includes(q);
        const idMatch = (evt.id || '').toLowerCase().includes(q);
        const pName = evt.periodId ? (periodMap.get(evt.periodId)?.name || '').toLowerCase() : '';
        const periodMatch = pName.includes(q);
        if (!titleMatch && !descMatch && !idMatch && !periodMatch) return false;
      }

      return true;
    });
  }, [events, filterType, filterPeriod, filterRecurrence, search, periodMap]);

  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType, filterPeriod, filterRecurrence]);

  const totalPagesCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPagesCount);
  const pagedEvents = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, safeCurrentPage, pageSize]);

  // Summary counts
  const stats = useMemo(() => {
    let kbmCount = 0;
    let holidayCount = 0;
    let examCount = 0;
    let activityCount = 0;
    let recurringCount = 0;

    events.forEach(e => {
      if (e.isKbm || e.type === 'kbm') kbmCount++;
      else if (e.type === 'holiday') holidayCount++;
      else if (e.type === 'exam') examCount++;
      else if (e.type === 'activity') activityCount++;
      if (e.isRecurring) recurringCount++;
    });

    return {
      total: events.length,
      kbmCount,
      holidayCount,
      examCount,
      activityCount,
      recurringCount
    };
  }, [events]);

  const handleOpenAdd = () => {
    if (!isAdmin && onOpenAdminLogin) {
      onOpenAdminLogin();
      return;
    }
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (evt: KaldikEvent) => {
    if (!isAdmin && onOpenAdminLogin) {
      onOpenAdminLogin();
      return;
    }
    setEditingEvent(evt);
    setIsModalOpen(true);
  };

  const handleSaveEvent = (savedEvt: KaldikEvent) => {
    if (!onUpdateDb) return;
    onUpdateDb(prev => {
      const existingEvents = prev.kaldikEvents || [];
      const exists = existingEvents.some(e => e.id === savedEvt.id);
      let updated: KaldikEvent[];
      if (exists) {
        updated = existingEvents.map(e => e.id === savedEvt.id ? savedEvt : e);
      } else {
        updated = [savedEvt, ...existingEvents];
      }
      return {
        ...prev,
        kaldikEvents: updated
      };
    });
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingEvent || !onUpdateDb) return;
    onUpdateDb(prev => ({
      ...prev,
      kaldikEvents: (prev.kaldikEvents || []).filter(e => e.id !== deletingEvent.id)
    }));
    setDeletingEvent(null);
  };

  return (
    <div className="space-y-4">
      {/* Header & Inline Stats Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                Event Kalender Akademik
              </h2>
              <p className="hidden text-[11px] text-slate-500">
                Rekam data rentang KBM, jadwal event/acara, libur, dan kegiatan santri.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Inline stats pills */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg">
              <span className="text-slate-500 font-medium">Total:</span>
              <span className="font-bold text-slate-800">{stats.total}</span>
              <span className="text-[10px] text-slate-400">event</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/70 border border-amber-200/70 rounded-lg text-amber-900">
              <span className="text-amber-700 font-medium">KBM:</span>
              <span className="font-bold">{stats.kbmCount}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50/70 border border-rose-200/70 rounded-lg text-rose-900">
              <span className="text-rose-700 font-medium">Libur:</span>
              <span className="font-bold">{stats.holidayCount}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50/70 border border-purple-200/70 rounded-lg text-purple-900">
              <span className="text-purple-700 font-medium">Ujian:</span>
              <span className="font-bold">{stats.examCount}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/70 border border-emerald-200/70 rounded-lg text-emerald-900">
              <span className="text-emerald-700 font-medium">Kegiatan:</span>
              <span className="font-bold">{stats.activityCount}</span>
            </div>

            {/* Add Button */}
            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-2xs transition-colors cursor-pointer ml-auto sm:ml-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Event</span>
            </button>
          </div>
        </div>

        {/* Streamlined Filter Toolbar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari judul event, deskripsi, atau periode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-colors placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Hapus pencarian"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Selects */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Kategori / Tipe */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="all">Semua Tipe Agenda</option>
              <option value="kbm">KBM Resmi ({stats.kbmCount})</option>
              <option value="holiday">Hari Libur ({stats.holidayCount})</option>
              <option value="exam">Asesmen / Ujian ({stats.examCount})</option>
              <option value="activity">Kegiatan Santri ({stats.activityCount})</option>
              <option value="general">Umum / Akademik</option>
            </select>

            {/* Terkait Periode */}
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer max-w-[200px] truncate"
            >
              <option value="all">Semua Periode ({periods.length})</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Pengulangan */}
            <select
              value={filterRecurrence}
              onChange={(e) => setFilterRecurrence(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="all">Semua Pengulangan</option>
              <option value="once">Sekali Jalan</option>
              <option value="recurring">Rutin ({stats.recurringCount})</option>
            </select>

            {/* Reset Button */}
            {(filterType !== 'all' || filterPeriod !== 'all' || filterRecurrence !== 'all' || search) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterType('all');
                  setFilterPeriod('all');
                  setFilterRecurrence('all');
                }}
                className="inline-flex items-center gap-1 text-xs py-1.5 px-2.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                title="Reset filter"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2.5 w-[100px] border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] border-b">
                  Agenda
                </th>
                <th className="px-3 py-2.5 border-b border-slate-200">Kategori</th>
                <th className="px-3 py-2.5 border-b border-slate-200">Rentang Tanggal</th>
                <th className="px-3 py-2.5 border-b border-slate-200">Waktu / Jam</th>
                <th className="px-3 py-2.5 border-b border-slate-200">Pengulangan</th>
                <th className="px-3 py-2.5 border-b border-slate-200">Fase Terkait</th>
                <th className="px-3 py-2.5 text-right w-24 border-b border-slate-200">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <CalendarDays className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600 text-sm">Tidak ada event kaldik yang sesuai filter</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {search || filterType !== 'all' || filterPeriod !== 'all' || filterRecurrence !== 'all'
                        ? 'Coba atur ulang filter pencarian Anda di atas.'
                        : 'Belum ada agenda kalender akademik yang tercatat.'}
                    </p>
                  </td>
                </tr>
              ) : (
                pagedEvents.map((evt) => {
                  const typeCfg = TYPE_CONFIG[evt.type] || TYPE_CONFIG.general;
                  const TypeIcon = typeCfg.icon;
                  const daysSpan = calculateDaysSpan(evt.startDate, evt.endDate);
                  const periodObj = evt.periodId ? periodMap.get(evt.periodId) : null;

                  return (
                    <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Judul & Deskripsi (Sticky First Column with Color Dot) */}
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors px-3 py-2.5 min-w-[200px] border-r border-b border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                        <div className="flex items-start gap-2.5">
                          <div
                            className="w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 shadow-2xs border border-white"
                            style={{ backgroundColor: evt.color || '#6366F1' }}
                            title={`Warna: ${evt.color || '#6366F1'}`}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{evt.title}</span>
                              {evt.isKbm && (
                                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-amber-500 text-white rounded">
                                  KBM
                                </span>
                              )}
                            </div>
                            {evt.description && (
                              <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {evt.description}
                              </div>
                            )}
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                              ID: {evt.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kategori Badge */}
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeCfg.badgeClass}`}>
                          <TypeIcon className="w-3 h-3 shrink-0" />
                          <span>{typeCfg.label}</span>
                        </span>
                      </td>

                      {/* Rentang Tanggal */}
                      <td className="px-3 py-2.5 whitespace-nowrap border-b border-slate-100">
                        <div className="font-medium text-slate-800">
                          {formatDateDisplay(evt.startDate)}
                          {evt.startDate !== evt.endDate && (
                            <span> s.d. {formatDateDisplay(evt.endDate)}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Durasi: <span className="font-semibold text-slate-700">{daysSpan} Hari</span>
                        </div>
                      </td>

                      {/* Waktu / Jam */}
                      <td className="px-3 py-2.5 whitespace-nowrap border-b border-slate-100">
                        {evt.isAllDay ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Seharian Penuh</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            <Clock className="w-3 h-3 text-indigo-500" />
                            <span>{evt.startTime || '08:00'} - {evt.endTime || '10:00'}</span>
                          </span>
                        )}
                      </td>

                      {/* Pengulangan */}
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        {evt.isRecurring ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                              <RefreshCw className="w-2.5 h-2.5" />
                              <span>{evt.repeatDetail || 'Mingguan'}</span>
                            </span>
                            {evt.daysOfWeek && evt.daysOfWeek.length > 0 && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Hari: {evt.daysOfWeek.join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sekali jalan</span>
                        )}
                      </td>

                      {/* Terkait Periode */}
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        {periodObj ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-medium" title={`${periodObj.name} (${periodObj.startDate} - ${periodObj.endDate})`}>
                            {periodObj.name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="px-3 py-2.5 text-right border-b border-slate-100">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(evt)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Event Kaldik"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingEvent(evt)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Event Kaldik"
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
                {filteredEvents.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
              </strong>{' '}
              –{' '}
              <strong className="text-slate-700">
                {Math.min(safeCurrentPage * pageSize, filteredEvents.length)}
              </strong>{' '}
              dari <strong className="text-slate-700">{filteredEvents.length}</strong> agenda
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

      {/* Kaldik Event Modal for Add/Edit */}
      {isModalOpen && (
        <KaldikEventModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEvent(null);
          }}
          onSave={handleSaveEvent}
          onDelete={(id) => {
            if (onUpdateDb) {
              onUpdateDb(prev => ({
                ...prev,
                kaldikEvents: (prev.kaldikEvents || []).filter(e => e.id !== id)
              }));
            }
            setIsModalOpen(false);
            setEditingEvent(null);
          }}
          initialEvent={editingEvent}
          periods={periods}
        />
      )}

      {/* In-UI Confirmation Modal for Delete (No window.confirm!) */}
      {deletingEvent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Hapus Event Kalender Akademik?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Anda akan menghapus agenda <span className="font-semibold text-slate-800">"{deletingEvent.title}"</span> ({formatDateDisplay(deletingEvent.startDate)}). Data event ini akan dihapus dari database.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeletingEvent(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Ya, Hapus Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
