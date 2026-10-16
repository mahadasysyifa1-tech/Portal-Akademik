import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseState, ScheduleRule } from '../../types';
import {
  CalendarDays,
  CalendarClock,
  Settings,
  ChevronDown,
  ChevronUp,
  BookmarkCheck,
  Check
} from 'lucide-react';
import { RulesDatabaseTab } from '../database/RulesDatabaseTab';
import { KaldikEventsDatabaseTab } from '../database/KaldikEventsDatabaseTab';
import { SyllabusPanel } from './SyllabusPanel';

type PanelId = 'rules' | 'kaldik' | 'syllabus';

interface RuleManagerViewProps {
  db: DatabaseState;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
  onEditRule?: (rule: ScheduleRule) => void;
  onAddRule?: () => void;
  onToggleRuleActive?: (ruleId: string) => void;
  onDeleteRule?: (ruleId: string) => void;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
  onNavigateToJournal?: (subjectId?: string, classId?: string, date?: string) => void;
  onNavigateToSchedule?: () => void;
  initialActivePanels?: PanelId[];
  initialSubjectId?: string;
  initialClassId?: string;
}

export const RuleManagerView: React.FC<RuleManagerViewProps> = ({
  db,
  onUpdateDb,
  onEditRule,
  onAddRule,
  onToggleRuleActive,
  onDeleteRule,
  isAdmin = true,
  onOpenAdminLogin,
  onNavigateToJournal,
  initialActivePanels,
  initialSubjectId,
  initialClassId
}) => {
  // Collapsible header state
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('app_rule_manager_header_collapsed') === 'true';
  });

  // Active panels list: maximum of 2 panels selected simultaneously
  const [activePanels, setActivePanels] = useState<PanelId[]>(() => {
    if (initialActivePanels && initialActivePanels.length > 0) {
      return initialActivePanels;
    }
    try {
      const saved = localStorage.getItem('app_rule_manager_active_panels');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 2) {
          return parsed as PanelId[];
        }
      }
      return ['rules', 'syllabus'];
    } catch {
      return ['rules', 'syllabus'];
    }
  });

  useEffect(() => {
    if (initialActivePanels && initialActivePanels.length > 0) {
      setActivePanels(initialActivePanels);
    }
  }, [initialActivePanels]);

  const toggleHeaderCollapsed = () => {
    setIsHeaderCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('app_rule_manager_header_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleTogglePanel = (panel: PanelId) => {
    setActivePanels((prev) => {
      let next: PanelId[];
      if (prev.includes(panel)) {
        // Deselect this panel
        next = prev.filter((p) => p !== panel);
      } else {
        // Select this panel: if already 2 active, replace the oldest one
        if (prev.length < 2) {
          next = [...prev, panel];
        } else {
          // Drop first, add new so it stays capped at 2
          next = [prev[1], panel];
        }
      }
      try {
        localStorage.setItem('app_rule_manager_active_panels', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const showRules = activePanels.includes('rules');
  const showKaldik = activePanels.includes('kaldik');
  const showSyllabus = activePanels.includes('syllabus');

  // Aggregated stats
  const ruleCount = db.rules?.length || 0;
  const activeRuleCount = (db.rules || []).filter((r) => r.active !== false).length;
  const kaldikCount = db.kaldikEvents?.length || 0;

  const packageCount = useMemo(() => {
    const set = new Set<string>();
    for (const r of db.rules || []) {
      const sId = r.subjectId || (r as any).subject_id;
      const cId = r.classId || (r as any).class_id;
      if (r.active !== false && sId && cId) {
        set.add(`${sId}_${cId}`);
      }
    }
    for (const sc of db.syllabusScopes || []) {
      if (sc.subject_id && sc.class_section_id) {
        set.add(`${sc.subject_id}_${sc.class_section_id}`);
      }
    }
    return set.size;
  }, [db.rules, db.syllabusScopes]);

  return (
    <div className="space-y-5">
      {/* Studio Header & Navigation Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs transition-all">
        {/* Collapsible Header Top Bar */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <Settings className="w-3 h-3 text-indigo-600" />
                Admin Studio
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium truncate">Perencanaan KBM &amp; Kurikulum</span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-1">
              Rule Manager Studio
            </h2>

            {/* Stats Bar Below Header */}
            {!isHeaderCollapsed && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col items-start justify-start gap-y-2 gap-x-5 text-xs text-slate-600">
                <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                  Pusat perencanaan terpadu untuk mengelola aturan jadwal KBM, agenda event kalender akademik (kaldik), serta distribusi silabus materi antar paket kelas.
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>Aturan Jadwal:</span>
                  <span className="font-bold text-slate-900">{ruleCount} aturan</span>
                  <span className="text-slate-400">({activeRuleCount} aktif)</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Event Kaldik:</span>
                  <span className="font-bold text-slate-900">{kaldikCount} agenda event</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Distribusi Silabus:</span>
                  <span className="font-bold text-slate-900">{packageCount} paket KBM silabus</span>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleHeaderCollapsed}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
            title={isHeaderCollapsed ? 'Perluas informasi header' : 'Ciutkan header untuk ruang kerja lebih luas'}
          >
            <span>{isHeaderCollapsed ? 'Perluas Info' : 'Ciutkan Header'}</span>
            {isHeaderCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>

        {/* Panel Toggles Row */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1 select-none">
              Panel (Maks. 2):
            </span>

            {/* Toggle 1: Schedule Rule */}
            <button
              type="button"
              id="toggle-panel-rules"
              onClick={() => handleTogglePanel('rules')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer select-none ${
                showRules
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CalendarClock className="md:w-5 md:h-5 w-3.5 h-3.5 shrink-0" />
              <span className="hidden group-hover:block absolute">Aturan Jadwal</span>
            </button>

            {/* Toggle 2: Kaldik Event */}
            <button
              type="button"
              id="toggle-panel-kaldik"
              onClick={() => handleTogglePanel('kaldik')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer select-none ${
                showKaldik
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="md:w-5 md:h-5 w-3.5 h-3.5 shrink-0" />
              <span className="hidden group-hover:block absolute">Event Kaldik</span>
            </button>

            {/* Toggle 3: Syllabus Manager */}
            <button
              type="button"
              id="toggle-panel-syllabus"
              onClick={() => handleTogglePanel('syllabus')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer select-none ${
                showSyllabus
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BookmarkCheck className="md:w-5 md:h-5 w-3.5 h-3.5 shrink-0" />
              <span className="hidden group-hover:block absolute">Distribusi Silabus</span>
            </button>
          </div>

          {/* Quick preset when less than 2 are active */}
          <div className="flex items-center gap-2">
            {activePanels.length < 2 && (
              <button
                type="button"
                onClick={() => {
                  const next: PanelId[] = ['rules', 'syllabus'];
                  setActivePanels(next);
                  try {
                    localStorage.setItem('app_rule_manager_active_panels', JSON.stringify(next));
                  } catch {
                    // ignore
                  }
                }}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                Tampilkan 2 Panel (Jadwal &amp; Silabus)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Panels: Side-by-side when 2 panels are active */}
      <div
        className={
          activePanels.length === 2
            ? 'grid grid-cols-1 xl:grid-cols-2 gap-5 items-start'
            : 'space-y-6'
        }
      >
        {/* Panel: Aturan Jadwal KBM */}
        {showRules && (
          <div className="min-w-0 w-full">
            <RulesDatabaseTab
              db={db}
              onUpdateDb={onUpdateDb}
              onEditRule={onEditRule}
              onAddRule={onAddRule}
              onToggleRuleActive={onToggleRuleActive}
              onDeleteRule={onDeleteRule}
              isAdmin={isAdmin}
              onOpenAdminLogin={onOpenAdminLogin}
              initialSubView="rules"
              hideSubViewSwitcher={true}
            />
          </div>
        )}

        {/* Panel: Event Kalender Akademik (Kaldik) */}
        {showKaldik && (
          <div className="min-w-0 w-full">
            <KaldikEventsDatabaseTab
              db={db}
              onUpdateDb={onUpdateDb}
              isAdmin={isAdmin}
              onOpenAdminLogin={onOpenAdminLogin}
            />
          </div>
        )}

        {/* Panel: Distribusi Materi ke Silabus */}
        {showSyllabus && (
          <div className="min-w-0 w-full">
            <SyllabusPanel
              db={db}
              onUpdateDb={onUpdateDb}
              isAdmin={isAdmin}
              onOpenAdminLogin={onOpenAdminLogin}
              onNavigateToJournal={onNavigateToJournal}
              initialSubjectId={initialSubjectId}
              initialClassId={initialClassId}
            />
          </div>
        )}

        {/* Empty State when 0 panels are selected */}
        {activePanels.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-2xs w-full col-span-full">
            <Settings className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Semua panel sedang disembunyikan</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Pilih 1 atau 2 panel di atas (Aturan Jadwal, Event Kaldik, atau Distribusi Silabus) untuk menampilkannya berdampingan.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  const next: PanelId[] = ['rules', 'syllabus'];
                  setActivePanels(next);
                  try {
                    localStorage.setItem('app_rule_manager_active_panels', JSON.stringify(next));
                  } catch {
                    // ignore
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                Tampilkan Jadwal &amp; Silabus
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
