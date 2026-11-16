import React from 'react';
import { Search } from 'lucide-react';

export interface DirectoryEmptyState {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

export interface DirectoryShellProps {
  search: string;
  onSearchChange: (nextSearch: string) => void;
  searchPlaceholder: string;
  focusRingClass?: string;
  filterSlot?: React.ReactNode;
  summarySlot?: React.ReactNode;
  isEmpty: boolean;
  emptyState: DirectoryEmptyState;
  children: React.ReactNode;
}

export const DirectoryShell: React.FC<DirectoryShellProps> = ({
  search,
  onSearchChange,
  searchPlaceholder,
  focusRingClass = 'focus-visible:ring-indigo-500',
  filterSlot,
  summarySlot,
  isEmpty,
  emptyState,
  children
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Unified Search, Filter & Counter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-[220px]">
          <div className="relative flex-1 min-w-[210px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={`w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus-visible:ring-2 ${focusRingClass}`}
            />
          </div>
          {filterSlot}
        </div>

        {summarySlot && (
          <div className="text-xs text-slate-500 font-medium shrink-0 tabular-nums">
            {summarySlot}
          </div>
        )}
      </div>

      {/* Empty State vs 3-Column Responsive Grid */}
      {isEmpty ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 space-y-2 shadow-2xs">
          {emptyState.icon}
          <p className="text-sm font-semibold text-slate-600">{emptyState.title}</p>
          {emptyState.description && (
            <p className="text-xs text-slate-400">{emptyState.description}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {children}
        </div>
      )}
    </div>
  );
};
