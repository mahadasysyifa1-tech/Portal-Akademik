import React, { useState, useMemo, useEffect } from 'react';
import {
  DatabaseState,
  ScheduleConflict,
  ScheduleRule,
  DayOfWeek
} from '../types';
import { CalendarView, ScheduleViewMode } from './CalendarView';
import { RuleForm } from './RuleForm';
import { ViewerRole } from './JournalView';

interface UnifiedStudioProps {
  db: DatabaseState;
  onUpdateDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  conflicts: ScheduleConflict[];
  showRules: boolean;
  onToggleRules: (show: boolean) => void;
  onOpenNewRule: (prefillSubjectId?: string) => void;
  onOpenNewRuleForSlot: (day: DayOfWeek, periodId: string, sessionId: string, classId?: string) => void;
  onEditRule: (rule: ScheduleRule) => void;
  onDuplicateRule: (rule: ScheduleRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onToggleRuleActive: (ruleId: string, active: boolean) => void;
  onToggleSubjectRulesActive: (subjectId: string, active: boolean) => void;
  onViewConflict: (conflict: ScheduleConflict) => void;
  isAdmin: boolean;
  onOpenAdminLogin: () => void;
  viewerRole?: ViewerRole;
  viewerId?: string;
  onViewerChange?: (role: ViewerRole, id: string) => void;
  activeViewMode?: ScheduleViewMode;
  onViewModeChange?: (mode: ScheduleViewMode) => void;
  selectedClassId?: string;
  onSelectClassId?: (id: string) => void;
  selectedTeacherId?: string;
  onSelectTeacherId?: (id: string) => void;
  selectedPeriodId?: string;
  onSelectPeriodId?: (id: string) => void;
  editingRule?: ScheduleRule | null;
  prefill?: {
    day?: DayOfWeek;
    periodId?: string;
    sessionId?: string;
    classId?: string;
    subjectId?: string;
  };
  onSaveRule?: (rule: ScheduleRule) => void;
}

export const UnifiedStudio: React.FC<UnifiedStudioProps> = ({
  db,
  onUpdateDb,
  conflicts,
  showRules,
  onToggleRules,
  onOpenNewRule,
  onOpenNewRuleForSlot,
  onEditRule,
  onDuplicateRule,
  onDeleteRule,
  onToggleRuleActive,
  onToggleSubjectRulesActive,
  onViewConflict,
  isAdmin,
  onOpenAdminLogin,
  viewerRole = 'student',
  viewerId,
  onViewerChange,
  activeViewMode: propActiveViewMode,
  onViewModeChange,
  selectedClassId: propSelectedClassId,
  onSelectClassId,
  selectedTeacherId: propSelectedTeacherId,
  onSelectTeacherId,
  selectedPeriodId: propSelectedPeriodId,
  onSelectPeriodId,
  editingRule,
  prefill,
  onSaveRule
}) => {
  // Retain view mode persistently across rule edits, panel toggles, and page reloads
  const [internalCalendarView, setInternalCalendarView] = useState<ScheduleViewMode>(() => {
    try {
      const savedMode = localStorage.getItem('ijma_studio_view_mode') as ScheduleViewMode;
      if (savedMode && Object.values(ScheduleViewMode).includes(savedMode)) {
        return savedMode;
      }
    } catch {}
    return viewerRole === 'teacher' ? ScheduleViewMode.TEACHER_WEEK : ScheduleViewMode.STUDENT_WEEK;
  });
  const activeCalendarView = propActiveViewMode ?? internalCalendarView;
  const setActiveCalendarView = (mode: ScheduleViewMode) => {
    setInternalCalendarView(mode);
    try {
      localStorage.setItem('ijma_studio_view_mode', mode);
    } catch {}
    onViewModeChange?.(mode);
  };

  const [internalClassId, setInternalClassId] = useState<string>(() => {
    try {
      const savedClass = localStorage.getItem('ijma_studio_selected_class');
      if (savedClass && db.classes.some((c) => c.id === savedClass)) return savedClass;
    } catch {}
    return (viewerRole === 'student' && viewerId) ? viewerId : (db.classes.length > 0 ? db.classes[0].id : '');
  });
  const selectedClassId = propSelectedClassId || internalClassId || (db.classes[0]?.id || '');
  const setSelectedClassId = (id: string) => {
    setInternalClassId(id);
    try {
      localStorage.setItem('ijma_studio_selected_class', id);
    } catch {}
    onSelectClassId?.(id);
    onViewerChange?.('student', id);
  };

  const [internalTeacherId, setInternalTeacherId] = useState<string>(() => {
    try {
      const savedTeacher = localStorage.getItem('ijma_studio_selected_teacher');
      if (savedTeacher && db.teachers.some((t) => t.id === savedTeacher)) return savedTeacher;
    } catch {}
    return (viewerRole === 'teacher' && viewerId) ? viewerId : (db.teachers.length > 0 ? db.teachers[0].id : '');
  });
  const selectedTeacherId = propSelectedTeacherId || internalTeacherId || (db.teachers[0]?.id || '');
  const setSelectedTeacherId = (id: string) => {
    setInternalTeacherId(id);
    try {
      localStorage.setItem('ijma_studio_selected_teacher', id);
    } catch {}
    onSelectTeacherId?.(id);
    onViewerChange?.('teacher', id);
  };

  const sortedPeriods = useMemo(
    () => [...db.periods].sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0)),
    [db.periods]
  );
  const [internalPeriodId, setInternalPeriodId] = useState<string>(() => {
    try {
      const savedPeriod = localStorage.getItem('ijma_studio_selected_period');
      if (savedPeriod) return savedPeriod;
    } catch {}
    return sortedPeriods.length > 0 ? sortedPeriods[0].id : 'prd-1';
  });
  const selectedPeriodId = propSelectedPeriodId || internalPeriodId || (sortedPeriods[0]?.id || 'prd-1');
  const setSelectedPeriodId = (id: string) => {
    setInternalPeriodId(id);
    try {
      localStorage.setItem('ijma_studio_selected_period', id);
    } catch {}
    onSelectPeriodId?.(id);
  };

  const lastSyncedRoleRef = React.useRef(viewerRole);
  const lastSyncedIdRef = React.useRef(viewerId);

  // Synchronize ONLY when viewerRole or viewerId genuine changed from outside navigation
  // (Do NOT reset view mode or selected entity when db updates or rule edits occur)
  useEffect(() => {
    const roleChanged = viewerRole !== lastSyncedRoleRef.current;
    const idChanged = viewerId !== lastSyncedIdRef.current;

    lastSyncedRoleRef.current = viewerRole;
    lastSyncedIdRef.current = viewerId;

    if (!roleChanged && !idChanged) {
      // Editing rules or updating db leaves the active view intact!
      return;
    }

    if (viewerRole === 'student') {
      setActiveCalendarView(ScheduleViewMode.STUDENT_WEEK);
      if (viewerId && db.classes.some((c) => c.id === viewerId)) {
        setSelectedClassId(viewerId);
      }
    } else if (viewerRole === 'teacher') {
      setActiveCalendarView(ScheduleViewMode.TEACHER_WEEK);
      if (viewerId && db.teachers.some((t) => t.id === viewerId)) {
        setSelectedTeacherId(viewerId);
      }
    }
  }, [viewerRole, viewerId, db.classes, db.teachers]);

  const handleSelectClass = (clsId: string) => {
    setSelectedClassId(clsId);
  };

  const handleSelectTeacher = (tchId: string) => {
    setSelectedTeacherId(tchId);
  };

  const handleSelectPeriod = (prdId: string) => {
    setSelectedPeriodId(prdId);
  };

  const handleViewModeChange = (mode: ScheduleViewMode) => {
    setActiveCalendarView(mode);
    if (mode === ScheduleViewMode.STUDENT_WEEK) {
      const clsId = selectedClassId || (db.classes[0]?.id || '');
      onViewerChange?.('student', clsId);
    } else if (mode === ScheduleViewMode.TEACHER_WEEK) {
      const tchId = selectedTeacherId || (db.teachers[0]?.id || '');
      onViewerChange?.('teacher', tchId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Content: Single persistent CalendarView container to prevent remounting and state reset */}
      <div className={showRules ? 'grid grid-cols-1 xl:grid-cols-12 gap-5 items-start' : 'w-full'}>
        {/* Calendar View (Full width or 7 cols when rules open) */}
        <div className={showRules ? 'xl:col-span-7 space-y-4' : 'w-full space-y-4'}>
          <CalendarView
            db={db}
            onUpdateDb={onUpdateDb}
            conflicts={conflicts}
            activeViewMode={activeCalendarView}
            onViewModeChange={handleViewModeChange}
            selectedClassId={selectedClassId}
            onSelectClassId={handleSelectClass}
            selectedTeacherId={selectedTeacherId}
            onSelectTeacherId={handleSelectTeacher}
            selectedPeriodId={selectedPeriodId}
            onSelectPeriodId={handleSelectPeriod}
            onOpenNewRuleForSlot={(day, periodId, sessionId, classId) => {
              if (!isAdmin) {
                onOpenAdminLogin();
                return;
              }
              onOpenNewRuleForSlot(day, periodId, sessionId, classId);
            }}
            onEditRule={(rule) => {
              if (!isAdmin) {
                onOpenAdminLogin();
                return;
              }
              onEditRule(rule);
            }}
            onViewConflict={onViewConflict}
            compact={showRules}
            isAdmin={isAdmin}
            onOpenAdminLogin={onOpenAdminLogin}
            showRules={showRules}
            onToggleRules={onToggleRules}
          />
        </div>

        {/* Rule Edit Form Panel (5 cols, only rendered when showRules is true) */}
        {showRules && (
          <div className="xl:col-span-5 space-y-4 animate-in fade-in duration-200">
            <RuleForm
              db={db}
              editingRule={editingRule}
              prefill={prefill}
              onSave={(rule) => {
                if (onSaveRule) {
                  onSaveRule(rule);
                } else if (onUpdateDb) {
                  const exists = db.rules.some((r) => r.id === rule.id);
                  const updatedRules = exists
                    ? db.rules.map((r) => (r.id === rule.id ? rule : r))
                    : [rule, ...db.rules];
                  onUpdateDb((prev) => ({ ...prev, rules: updatedRules }));
                }
              }}
              onDelete={(ruleId) => {
                if (!isAdmin) {
                  onOpenAdminLogin();
                  return;
                }
                onDeleteRule(ruleId);
              }}
              onClose={() => onToggleRules(false)}
              onNewRule={() => {
                if (!isAdmin) {
                  onOpenAdminLogin();
                  return;
                }
                onOpenNewRule();
              }}
              inline={true}
              className="sticky top-20"
            />
          </div>
        )}
      </div>
    </div>
  );
};
