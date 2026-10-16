import React, { useState, useMemo } from 'react';
import {
  DatabaseState,
  ScheduleConflict,
  DayOfWeek,
  ScheduleRule
} from '../types';
import { SingleEntryCellConfig, EntryFullData } from './schedule/SingleEntryCell';
import { WeekGridView } from './schedule/WeekGridView';
import { AdminAuditGrid } from './schedule/AdminAuditGrid';
import {
  GraduationCap,
  Users,
  Grid3X3,
  Calendar as CalendarIcon,
  CalendarDays,
  X,
  Clock,
  DoorOpen,
  Zap,
  Lock,
  Edit2,
  Layers,
  Video
} from 'lucide-react';
import { ClassIcon } from './ClassIcon';

export enum ScheduleViewMode {
  STUDENT_WEEK = 'STUDENT_WEEK',
  TEACHER_WEEK = 'TEACHER_WEEK',
  ADMIN_AUDIT = 'ADMIN_AUDIT'
}

interface CalendarViewProps {
  db: DatabaseState;
  onUpdateDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  conflicts: ScheduleConflict[];
  onOpenNewRuleForSlot: (day: DayOfWeek, periodId: string, sessionId: string, classId?: string) => void;
  onEditRule: (rule: ScheduleRule) => void;
  onViewConflict: (conflict: ScheduleConflict) => void;
  compact?: boolean;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
  activeViewMode?: ScheduleViewMode;
  onViewModeChange?: (mode: ScheduleViewMode) => void;
  selectedClassId?: string;
  onSelectClassId?: (id: string) => void;
  selectedTeacherId?: string;
  onSelectTeacherId?: (id: string) => void;
  selectedPeriodId?: string;
  onSelectPeriodId?: (id: string) => void;
  showRules?: boolean;
  onToggleRules?: (show: boolean) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  db,
  onUpdateDb,
  conflicts,
  onOpenNewRuleForSlot,
  onEditRule,
  onViewConflict,
  compact = false,
  isAdmin = false,
  onOpenAdminLogin,
  activeViewMode: propActiveViewMode,
  onViewModeChange,
  selectedClassId: propSelectedClassId,
  onSelectClassId,
  selectedTeacherId: propSelectedTeacherId,
  onSelectTeacherId,
  selectedPeriodId: propSelectedPeriodId,
  onSelectPeriodId,
  showRules,
  onToggleRules
}) => {
  // Mode switcher between the 3 views: Murid, Guru, Semua
  const [internalViewMode, setInternalViewMode] = useState<ScheduleViewMode>(ScheduleViewMode.STUDENT_WEEK);
  const viewMode = propActiveViewMode ?? internalViewMode;
  const setViewMode = (mode: ScheduleViewMode) => {
    setInternalViewMode(mode);
    onViewModeChange?.(mode);
  };

  // Selected student / class section for View 1
  const [internalClassId, setInternalClassId] = useState<string>(
    db.classes.length > 0 ? db.classes[0].id : ''
  );
  const selectedClassId = propSelectedClassId ?? internalClassId;
  const setSelectedClassId = (id: string) => {
    setInternalClassId(id);
    onSelectClassId?.(id);
  };

  // Selected teacher for View 2
  const [internalTeacherId, setInternalTeacherId] = useState<string>(
    db.teachers.length > 0 ? db.teachers[0].id : ''
  );
  const selectedTeacherId = propSelectedTeacherId ?? internalTeacherId;
  const setSelectedTeacherId = (id: string) => {
    setInternalTeacherId(id);
    onSelectTeacherId?.(id);
  };

  // Academic period filter (shared across all views)
  const sortedPeriods = useMemo(
    () => [...db.periods].sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0)),
    [db.periods]
  );
  const [internalPeriodId, setInternalPeriodId] = useState<string>(
    sortedPeriods.length > 0 ? sortedPeriods[0].id : 'prd-1'
  );
  const selectedPeriodId = propSelectedPeriodId ?? internalPeriodId;
  const setSelectedPeriodId = (id: string) => {
    setInternalPeriodId(id);
    onSelectPeriodId?.(id);
  };

  // Detail panel state for clicked single-entry cell (Views 1 & 2)
  const [selectedEntryData, setSelectedEntryData] = useState<EntryFullData | null>(null);

  // Rule lookup map
  const ruleMap = useMemo(() => new Map(db.rules.map((r) => [r.id, r])), [db.rules]);

  // Config for View 1 (Murid)
  const studentConfig: SingleEntryCellConfig = useMemo(
    () => ({
      colorKey: 'subject',
      primaryField: 'subject',
      secondaryField: 'teacher'
    }),
    []
  );

  // Config for View 2 (Guru)
  const teacherConfig: SingleEntryCellConfig = useMemo(
    () => ({
      colorKey: 'class',
      primaryField: 'class',
      secondaryField: 'subject'
    }),
    []
  );

  return (
    <div className="space-y-4">
      {/* View Mode Bar & Compact Controls: Single Unified Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        {/* Mode Switcher Tabs: Murid, Guru, Semua */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/80 shrink-0">
          <button
            id="view-tab-student-week"
            type="button"
            onClick={() => {
              setViewMode(ScheduleViewMode.STUDENT_WEEK);
              setSelectedEntryData(null);
            }}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === ScheduleViewMode.STUDENT_WEEK
                ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Murid</span>
          </button>

          <button
            id="view-tab-teacher-week"
            type="button"
            onClick={() => {
              setViewMode(ScheduleViewMode.TEACHER_WEEK);
              setSelectedEntryData(null);
            }}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === ScheduleViewMode.TEACHER_WEEK
                ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Guru</span>
          </button>

          <button
            id="view-tab-admin-audit"
            type="button"
            onClick={() => {
              setViewMode(ScheduleViewMode.ADMIN_AUDIT);
              setSelectedEntryData(null);
            }}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === ScheduleViewMode.ADMIN_AUDIT
                ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Semua</span>
          </button>
        </div>

        {/* Compact Dynamic Selectors (Kelas / Guru & Periode) */}
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === ScheduleViewMode.STUDENT_WEEK && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 hidden sm:inline">Kelas:</span>
              <select
                id="header-class-select"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {db.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {viewMode === ScheduleViewMode.TEACHER_WEEK && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 hidden sm:inline">Guru:</span>
              <select
                id="header-teacher-select"
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {db.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.panggilan}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Period Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 hidden sm:inline">Periode:</span>
            <select
              id="calendar-period-select"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Periode</option>
              {sortedPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Render Active View */}
      {viewMode === ScheduleViewMode.STUDENT_WEEK && (
        <WeekGridView
          db={db}
          config={studentConfig}
          selectedEntityId={selectedClassId}
          onSelectEntityId={setSelectedClassId}
          selectedPeriodId={selectedPeriodId}
          onEntryClick={(data) => setSelectedEntryData(data)}
          onEditRule={(rule) => {
            if (!isAdmin && onOpenAdminLogin) {
              onOpenAdminLogin();
              return;
            }
            onEditRule(rule);
          }}
          entityType="student_class"
        />
      )}

      {viewMode === ScheduleViewMode.TEACHER_WEEK && (
        <WeekGridView
          db={db}
          config={teacherConfig}
          selectedEntityId={selectedTeacherId}
          onSelectEntityId={setSelectedTeacherId}
          selectedPeriodId={selectedPeriodId}
          onEntryClick={(data) => setSelectedEntryData(data)}
          onEditRule={(rule) => {
            if (!isAdmin && onOpenAdminLogin) {
              onOpenAdminLogin();
              return;
            }
            onEditRule(rule);
          }}
          entityType="teacher"
        />
      )}

      {viewMode === ScheduleViewMode.ADMIN_AUDIT && (
        <AdminAuditGrid
          db={db}
          selectedPeriodId={selectedPeriodId}
          onEntryClick={(data) => setSelectedEntryData(data)}
          onEditRule={(rule) => {
            if (!isAdmin && onOpenAdminLogin) {
              onOpenAdminLogin();
              return;
            }
            onEditRule(rule);
          }}
        />
      )}

      {/* Rules Form Toggle Button placed under legend */}
      {onToggleRules && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            id="schedule-rules-toggle-btn"
            onClick={() => {
              if (!isAdmin && !showRules && onOpenAdminLogin) {
                onOpenAdminLogin();
                return;
              }
              onToggleRules(!showRules);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none shadow-2xs ${
              showRules
                ? 'bg-indigo-50 text-indigo-900 border-indigo-300 ring-1 ring-indigo-200'
                : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-slate-200'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 shrink-0 ${showRules ? 'text-indigo-600' : 'text-slate-500'}`} />
            <span>{showRules ? 'Sembunyikan Form Aturan' : 'Form Edit Aturan'}</span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                showRules ? 'bg-emerald-500 ring-2 ring-emerald-200 animate-pulse' : 'bg-slate-300'
              }`}
            />
          </button>
          <span className="text-[11px] text-slate-400">
            {db.rules.length} Aturan KBM
          </span>
        </div>
      )}

      {/* Detail Panel for clicked slot */}
      {selectedEntryData && (
        <div
          id="entry-detail-panel"
          className="fixed bottom-4 right-4 z-40 max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-4 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-start justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-md"
                style={{
                  backgroundColor:
                    viewMode === ScheduleViewMode.TEACHER_WEEK
                      ? selectedEntryData.classEntity?.color || '#E0E7FF'
                      : selectedEntryData.subject?.color || '#4F46E5'
                }}
              />
              <h3 className="font-bold text-sm text-slate-900">
                {selectedEntryData.subject?.name || 'Jadwal Mata Pelajaran'}
              </h3>
              <span className="text-[10px] font-mono font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                {selectedEntryData.subject?.code}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedEntryData(null)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-3 space-y-2 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1">
                <ClassIcon name={selectedEntryData.classEntity?.icon || 'GraduationCap'} className="w-3.5 h-3.5" /> Kelas:
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-bold border border-slate-200"
                  style={{ backgroundColor: selectedEntryData.classEntity?.color || '#E0E7FF' }}
                >
                  {selectedEntryData.classEntity?.name} (Tingkat {selectedEntryData.classEntity?.grade})
                </span>
                {selectedEntryData.classEntity?.onlineClassLink && (
                  <a
                    href={selectedEntryData.classEntity.onlineClassLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    title="Buka Kelas Online"
                  >
                    <Video className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Guru Pengampu:
              </span>
              <span className="font-semibold text-slate-900">
                {selectedEntryData.teacher?.name} ({selectedEntryData.teacher?.department || 'Pengajar'})
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1">
                <DoorOpen className="w-3.5 h-3.5" /> Ruangan:
              </span>
              <span className="font-semibold text-slate-900">
                {selectedEntryData.room?.name || 'Belum Ditentukan'} ({selectedEntryData.room?.type || 'Standar'})
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Waktu Sesi:
              </span>
              <span className="font-mono text-slate-800 font-semibold">
                {selectedEntryData.day} • {selectedEntryData.sessionName} ({selectedEntryData.sessionTime})
              </span>
            </div>

            {selectedEntryData.slot.hasException && (
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-1.5 mt-2">
                <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Pengecualian Khusus:</span>{' '}
                  {selectedEntryData.slot.exceptionDetail || 'Penyesuaian khusus berlaku pada slot ini'}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedEntryData(null)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Tutup
            </button>
            {isAdmin && selectedEntryData.slot.ruleId && (
              <button
                type="button"
                onClick={() => {
                  const rule = ruleMap.get(selectedEntryData.slot.ruleId);
                  if (rule) {
                    onEditRule(rule);
                    setSelectedEntryData(null);
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Ubah Aturan Jadwal</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
