import React, { useMemo } from 'react';
import { DatabaseState, DayOfWeek, ScheduleRule } from '../../types';
import { FixedBlockSubGrid } from './FixedBlockSubGrid';
import { computeResolvedSlots } from '../../utils/scheduleEngine';
import { doesIntersectRange } from '../../utils/dateNormalizer';
import { GraduationCap, Edit3, PlusCircle } from 'lucide-react';

interface AdminEditGridProps {
  db: DatabaseState;
  selectedPeriodId: string;
  onOpenNewRuleForSlot: (day: DayOfWeek, periodId: string, sessionId: string, classId?: string) => void;
  onEditRule: (rule: ScheduleRule) => void;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AdminEditGrid: React.FC<AdminEditGridProps> = ({
  db,
  selectedPeriodId,
  onOpenNewRuleForSlot,
  onEditRule
}) => {
  // Sorted sessions strictly by order
  const sortedSessions = useMemo(() => {
    return [...db.sessions].sort((a, b) => a.order - b.order);
  }, [db.sessions]);

  // Stably sorted classes
  const sortedClasses = useMemo(() => {
    return [...db.classes].sort((a, b) => (a.grade || 0) - (b.grade || 0) || a.name.localeCompare(b.name));
  }, [db.classes]);

  // Lookup maps
  const subjectMap = useMemo(() => new Map(db.subjects.map((s) => [s.id, s])), [db.subjects]);
  const teacherMap = useMemo(() => new Map(db.teachers.map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map(db.rooms.map((r) => [r.id, r])), [db.rooms]);
  const ruleMap = useMemo(() => new Map(db.rules.map((r) => [r.id, r])), [db.rules]);

  // Resolved slots
  const allResolvedSlots = useMemo(() => {
    return computeResolvedSlots(db.rules, db.periods);
  }, [db.rules, db.periods]);

  // Filter slots by selected period
  const activeSlots = useMemo(() => {
    if (selectedPeriodId && selectedPeriodId !== 'all') {
      const targetP = db.periods.find((p) => p.id === selectedPeriodId);
      if (targetP && targetP.startDate && targetP.endDate) {
        return allResolvedSlots.filter((s) =>
          doesIntersectRange(s.dateRanges || [], targetP.startDate, targetP.endDate)
        );
      }
      return allResolvedSlots.filter((s) => s.periodId === selectedPeriodId);
    }
    return allResolvedSlots;
  }, [allResolvedSlots, selectedPeriodId, db.periods]);

  // Pre-index slots by `${day}_${classId}_${sessionId}`
  const slotIndex = useMemo(() => {
    const map = new Map<string, typeof activeSlots[0]>();
    activeSlots.forEach((slot) => {
      const key = `${slot.day}_${slot.classId}_${slot.sessionId}`;
      map.set(key, slot);
    });
    return map;
  }, [activeSlots]);

  // Legend subjects
  const legendSubjects = useMemo(() => {
    return db.subjects.map((s) => ({
      id: s.id,
      label: s.name || s.code,
      color: s.color || '#4F46E5'
    }));
  }, [db.subjects]);

  const effectivePeriodId = useMemo(() => {
    if (selectedPeriodId && selectedPeriodId !== 'all') {
      return selectedPeriodId;
    }
    return db.periods[0]?.id || 'prd-1';
  }, [selectedPeriodId, db.periods]);

  return (
    <div className="space-y-4">
      {/* Persistent Horizontal Legend Strip & Instructions */}
      <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Admin Interactive Edit Grid
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-medium">
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Click any hollow block to schedule • Click solid block to edit rule</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Swatch for Free / Hollow */}
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-white border-1.5 border-dashed border-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-slate-400 bg-white shrink-0" />
            <span className="text-slate-600 text-[11px] font-semibold">Free (Click to Assign)</span>
          </div>

          {/* Swatches for each subject */}
          {legendSubjects.map((s) => (
            <div
              key={s.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-slate-50 border border-slate-200"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-slate-700 text-[11px]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: rows = class-sections, columns = days */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-44 px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    <span>Class Section</span>
                  </div>
                </th>
                {DAYS.map((day) => (
                  <th
                    key={day}
                    className="px-3 py-3 text-xs font-bold text-slate-800 text-center border-r border-slate-200 last:border-r-0 min-w-[170px]"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedClasses.map((cls, cIdx) => (
                <tr
                  key={cls.id}
                  className={`hover:bg-slate-50/40 transition-colors ${
                    cIdx === sortedClasses.length - 1 ? 'border-b border-slate-200' : ''
                  }`}
                >
                  {/* Class Header */}
                  <td className="px-3 py-3 bg-slate-50/80 border-r border-slate-200 text-xs sticky left-0 z-10">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{cls.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Gr.{cls.grade}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {cls.studentCount} students • Sec {cls.section}
                    </div>
                  </td>

                  {/* Day Cells: Embedded sessions sorted by session order */}
                  {DAYS.map((day) => {
                    return (
                      <td
                        key={day}
                        className="p-1.5 align-middle border-r border-slate-200 last:border-r-0"
                      >
                        <FixedBlockSubGrid
                          count={sortedSessions.length}
                          interactive={true}
                          getStateFn={(sessionIndex) => {
                            const session = sortedSessions[sessionIndex];
                            const key = `${day}_${cls.id}_${session.id}`;
                            const slot = slotIndex.get(key);

                            const shortLabel = `S${session.order}`;

                            if (slot) {
                              const sub = slot.subjectId ? subjectMap.get(slot.subjectId) : undefined;
                              const tch = slot.teacherId ? teacherMap.get(slot.teacherId) : undefined;
                              const rm = slot.roomId ? roomMap.get(slot.roomId) : undefined;

                              return {
                                id: session.id,
                                label: shortLabel,
                                isFilled: true,
                                color: sub?.color || '#4F46E5',
                                tooltip: `[ASSIGNED] ${session.name} (${session.startTime} - ${session.endTime})
Class: ${cls.name} (Grade ${cls.grade})
Subject: ${sub?.name || 'Subject'} (${sub?.code || ''})
Teacher: ${tch?.name || 'Teacher'}
Room: ${rm?.name || 'Unassigned'}
Click to edit or modify assignment`,
                                subjectName: sub?.name,
                                teacherName: tch?.panggilan || tch?.name,
                                roomName: rm?.name,
                                hasException: slot.hasException
                              };
                            }

                            return {
                              id: session.id,
                              label: shortLabel,
                              isFilled: false,
                              tooltip: `[UNSCHEDULED GAP] ${session.name} (${session.startTime} - ${session.endTime})
Class: ${cls.name} on ${day}
Click to assign subject and teacher`
                            };
                          }}
                          onBlockClick={(sessionIndex, state) => {
                            const session = sortedSessions[sessionIndex];
                            const key = `${day}_${cls.id}_${session.id}`;
                            const slot = slotIndex.get(key);

                            if (slot && slot.ruleId) {
                              const existingRule = ruleMap.get(slot.ruleId);
                              if (existingRule) {
                                onEditRule(existingRule);
                                return;
                              }
                            }

                            // Otherwise open new rule assignment dialog for this slot
                            onOpenNewRuleForSlot(day, effectivePeriodId, session.id, cls.id);
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
