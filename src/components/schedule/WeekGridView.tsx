import React, { useMemo } from 'react';
import {
  DatabaseState,
  ResolvedSlot,
  DayOfWeek,
  ScheduleRule
} from '../../types';
import { SingleEntryCell, SingleEntryCellConfig, EntryFullData, getClassColor } from './SingleEntryCell';
import { computeResolvedSlots } from '../../utils/scheduleEngine';
import { doesIntersectRange } from '../../utils/dateNormalizer';
import { Clock } from 'lucide-react';
import { ClassIcon } from '../ClassIcon';

interface WeekGridViewProps {
  db: DatabaseState;
  config: SingleEntryCellConfig;
  selectedEntityId: string;
  onSelectEntityId: (id: string) => void;
  selectedPeriodId: string;
  onEntryClick: (data: EntryFullData) => void;
  onEditRule?: (rule: ScheduleRule) => void;
  entityType: 'student_class' | 'teacher';
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_LABELS: Record<DayOfWeek, string> = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
  Saturday: 'Sabtu',
  Sunday: 'Ahad'
};

export const WeekGridView: React.FC<WeekGridViewProps> = ({
  db,
  config,
  selectedEntityId,
  onSelectEntityId,
  selectedPeriodId,
  onEntryClick,
  entityType
}) => {
  // Sorted sessions strictly by order
  const sortedSessions = useMemo(() => {
    return [...db.sessions].sort((a, b) => a.order - b.order);
  }, [db.sessions]);

  // Lookup maps
  const subjectMap = useMemo(() => new Map(db.subjects.map((s) => [s.id, s])), [db.subjects]);
  const teacherMap = useMemo(() => new Map(db.teachers.map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map(db.rooms.map((r) => [r.id, r])), [db.rooms]);
  const classMap = useMemo(() => new Map(db.classes.map((c) => [c.id, c])), [db.classes]);
  const periodMap = useMemo(() => new Map(db.periods.map((p) => [p.id, p])), [db.periods]);

  // All resolved slots
  const allResolvedSlots = useMemo(() => {
    return computeResolvedSlots(db.rules, db.periods);
  }, [db.rules, db.periods]);

  // Filter slots for the selected single entity (either a specific class or a specific teacher)
  const entitySlots = useMemo(() => {
    if (!selectedEntityId) return [];

    return allResolvedSlots.filter((slot) => {
      // Period filter: if a specific period is selected, match by date range or id
      if (selectedPeriodId && selectedPeriodId !== 'all') {
        const targetP = periodMap.get(selectedPeriodId);
        if (targetP && targetP.startDate && targetP.endDate) {
          if (!doesIntersectRange(slot.dateRanges || [], targetP.startDate, targetP.endDate)) {
            return false;
          }
        } else if (slot.periodId !== selectedPeriodId) {
          return false;
        }
      }

      if (entityType === 'student_class') {
        return slot.classId === selectedEntityId;
      } else {
        return slot.teacherId === selectedEntityId;
      }
    });
  }, [allResolvedSlots, selectedEntityId, selectedPeriodId, entityType, periodMap]);

  // Map slots into (day, sessionId) -> EntryFullData
  const slotGrid = useMemo(() => {
    const grid = new Map<string, EntryFullData>();

    entitySlots.forEach((slot) => {
      const key = `${slot.day}_${slot.sessionId}`;
      if (!grid.has(key)) {
        const sub = slot.subjectId ? subjectMap.get(slot.subjectId) : undefined;
        const tch = slot.teacherId ? teacherMap.get(slot.teacherId) : undefined;
        const rm = slot.roomId ? roomMap.get(slot.roomId) : undefined;
        const cls = slot.classId ? classMap.get(slot.classId) : undefined;
        const ses = sortedSessions.find((s) => s.id === slot.sessionId);
        const prd = slot.periodId ? periodMap.get(slot.periodId) : undefined;

        grid.set(key, {
          slot,
          subject: sub,
          teacher: tch,
          room: rm,
          classEntity: cls,
          day: slot.day,
          sessionName: ses?.name || 'Sesi',
          sessionTime: ses ? `${ses.startTime} – ${ses.endTime}` : '',
          periodName: prd?.name || 'Semester'
        });
      }
    });

    return grid;
  }, [entitySlots, subjectMap, teacherMap, roomMap, classMap, sortedSessions, periodMap]);

  // Legend items
  const legendItems = useMemo(() => {
    if (config.colorKey === 'subject') {
      return db.subjects.map((s) => ({
        id: s.id,
        label: s.name || s.code,
        color: s.color || '#4F46E5',
        icon: undefined
      }));
    } else {
      return db.classes.map((c, i) => ({
        id: c.id,
        label: c.name,
        color: c.color || getClassColor(c.id, i),
        icon: c.icon
      }));
    }
  }, [config.colorKey, db.subjects, db.classes]);

  return (
    <div className="space-y-4">
      {/* Grid: rows = sessions, columns = days */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-20 px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sesi Waktu</span>
                  </div>
                </th>
                {DAYS.map((day) => (
                  <th
                    key={day}
                    className="px-3 py-3 text-xs font-bold text-slate-800 text-center border-r border-slate-200 last:border-r-0 min-w-[70px]"
                  >
                    {DAY_LABELS[day] || day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedSessions.map((session, idx) => (
                <tr
                  key={session.id}
                  className={`hover:bg-slate-50/50 transition-colors ${
                    idx === sortedSessions.length - 1 ? 'border-b border-slate-200' : ''
                  }`}
                >
                  {/* Session Header Cell */}
                  <td className="px-3 py-2.5 bg-slate-50/80 border-r border-slate-200 text-xs sticky left-0 z-10">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{session.name}</span>
                      <span className="text-[10px] text-amber-700 font-mono font-bold">
                        #{session.order}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      {session.startTime} – {session.endTime}
                    </div>
                  </td>

                  {/* Day Cells */}
                  {DAYS.map((day) => {
                    const key = `${day}_${session.id}`;
                    const entry = slotGrid.get(key);

                    return (
                      <td
                        key={day}
                        className="p-1.5 align-middle border-r border-slate-200 last:border-r-0"
                      >
                        <SingleEntryCell
                          entry={entry}
                          config={config}
                          onEntryClick={onEntryClick}
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

      {/* Horizontal Legend Strip at the Bottom */}
      <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            {config.colorKey === 'subject' ? 'Keterangan Warna Mata Pelajaran:' : 'Keterangan Warna Kelas:'}
          </span>
          <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
            {entitySlots.length} sesi terjadwal
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {legendItems.map((item) => (
            <div
              key={item.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200/90 shadow-2xs"
              style={{
                backgroundColor: config.colorKey === 'class' ? item.color : '#F8FAFC'
              }}
            >
              {config.colorKey === 'class' ? (
                <ClassIcon
                  name={item.icon || 'GraduationCap'}
                  className="w-3 h-3 text-slate-700 shrink-0"
                />
              ) : (
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0 shadow-2xs"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span className="text-slate-800 text-[11px] font-bold">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
