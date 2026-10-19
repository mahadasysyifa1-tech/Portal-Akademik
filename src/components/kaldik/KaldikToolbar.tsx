import React from 'react';
import { ChevronLeft, ChevronRight, Plus, Filter, Layers } from 'lucide-react';
import type { Period } from '../../types';
import { INDONESIAN_MONTHS } from '../../utils/kaldikCalendar';
import type { KaldikMode } from './KaldikModeSwitch';

export interface KaldikToolbarProps {
  currentYear: number;
  currentMonth: number; // 0-11
  mode: KaldikMode;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  selectedPeriodFilter: string;
  onPeriodFilterChange: (value: string) => void;
  eventTypeFilter: string;
  onEventTypeFilterChange: (value: string) => void;
  onResetFilters: () => void;
  periods: Period[];
  showAddEvent: boolean;
  onAddEvent: () => void;
}

export const KaldikToolbar: React.FC<KaldikToolbarProps> = ({
  currentYear,
  currentMonth,
  mode,
  onPrevMonth,
  onNextMonth,
  onToday,
  onMonthChange,
  onYearChange,
  showFilters,
  onToggleFilters,
  selectedPeriodFilter,
  onPeriodFilterChange,
  eventTypeFilter,
  onEventTypeFilterChange,
  onResetFilters,
  periods,
  showAddEvent,
  onAddEvent
}) => {
  const hasActiveFilter = selectedPeriodFilter !== 'all' || eventTypeFilter !== 'all';
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Month navigation */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto flex-nowrap whitespace-nowrap">
          <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={onPrevMonth}
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition-colors cursor-pointer"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center text-xs font-bold text-slate-800">
              <select
                value={currentMonth}
                onChange={(e) => onMonthChange(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-800 px-1.5 py-1 cursor-pointer focus:outline-none hover:text-slate-900 appearance-none"
              >
                {INDONESIAN_MONTHS.map((mName, idx) => (
                  <option key={mName} value={idx}>
                    {mName}
                  </option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={(e) => onYearChange(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-800 pr-1.5 py-1 cursor-pointer focus:outline-none hover:text-slate-900 appearance-none"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onNextMonth}
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition-colors cursor-pointer"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onToday}
            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            Hari Ini
          </button>
        </div>

        {/* Collapsible filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedPeriodFilter}
                  onChange={(e) => onPeriodFilterChange(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all">Semua Periode</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={eventTypeFilter}
                  onChange={(e) => onEventTypeFilterChange(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="kbm">Hanya KBM</option>
                  <option value="holiday">Hanya Libur</option>
                  <option value="exam">Hanya Ujian</option>
                  <option value="activity">Hanya Agenda</option>
                </select>
              </div>

              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="text-xs text-amber-700 hover:text-amber-800 underline font-medium cursor-pointer ml-1"
                >
                  Reset Filter
                </button>
              )}
            </div>

            {showAddEvent && (
              <button
                type="button"
                id="kaldik-add-event-btn"
                onClick={onAddEvent}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Event Baru</span>
              </button>
            )}
          </div>
        )}

        {/* Filter toggle */}
        <span>
          <button
            type="button"
            onClick={onToggleFilters}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shadow-2xs ${
              showFilters || hasActiveFilter
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            title="Filter Event & Agenda"
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filter</span>
            {hasActiveFilter && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
          </button>
        </span>
      </div>
    </div>
  );
};
