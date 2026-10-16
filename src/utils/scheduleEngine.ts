import {
  DatabaseState,
  ScheduleRule,
  ScheduleConflict,
  ScheduleCell,
  DayOfWeek,
  Period,
  Session,
  ResolvedSlot
} from '../types';
import {
  getNormalizedDateRangesForRule,
  checkDateRangesOverlap,
  doesIntersectRange
} from './dateNormalizer';

export type { ResolvedSlot };

/**
 * Resolves active schedule rules into individual slots.
 * Each slot contains normalized date ranges computed from presets/ranges.
 */
export function computeResolvedSlots(rules: ScheduleRule[], periods: Period[] = []): ResolvedSlot[] {
  const slots: ResolvedSlot[] = [];
  if (!Array.isArray(rules)) return slots;

  for (const rule of rules) {
    if (!rule || !rule.active) continue;

    // Resolve days safely
    const rawDays = rule.daysOfWeek || (rule as any).days_of_week;
    const daysToSchedule: DayOfWeek[] = (Array.isArray(rawDays) && rawDays.length > 0)
      ? (rawDays as DayOfWeek[])
      : [(rule.dayOfWeek || (rule as any).day_of_week || 'Monday') as DayOfWeek];

    // Compute normalized date ranges for this rule
    const dateRanges = getNormalizedDateRangesForRule(rule, periods);
    if (dateRanges.length === 0) continue;

    const ruleSubjectId = rule.subjectId || (rule as any).subject_id || '';
    const ruleClassId = rule.classId || (rule as any).class_id || '';
    const ruleTeacherId = rule.teacherId || (rule as any).teacher_id || '';
    const ruleRoomId = rule.roomId || (rule as any).room_id || '';
    const ruleSessionId = rule.sessionId || (rule as any).session_id || '';
    const primaryPeriodId = (rule.periodIds && rule.periodIds[0]) || (rule as any).period_ids?.[0] || 'all';

    for (const day of daysToSchedule) {
      slots.push({
        ruleId: rule.id,
        subjectId: ruleSubjectId,
        classId: ruleClassId,
        teacherId: ruleTeacherId,
        roomId: ruleRoomId,
        sessionId: ruleSessionId,
        day,
        periodId: primaryPeriodId,
        dateRanges,
        hasException: false,
        exceptionDetail: undefined
      });
    }
  }

  return slots;
}

/**
 * Detects scheduling conflicts based on date range overlaps, day, and session.
 * Does NOT rely on rigid period IDs; overlapping date spans are computed automatically.
 */
export function detectConflicts(db: DatabaseState): ScheduleConflict[] {
  if (!db || !Array.isArray(db.rules)) return [];
  const periods = Array.isArray(db.periods) ? db.periods : [];
  const slots = computeResolvedSlots(db.rules, periods);
  const conflicts: ScheduleConflict[] = [];

  const sessions = Array.isArray(db.sessions) ? db.sessions : [];
  const classes = Array.isArray(db.classes) ? db.classes : [];
  const teachers = Array.isArray(db.teachers) ? db.teachers : [];
  const rooms = Array.isArray(db.rooms) ? db.rooms : [];
  const subjects = Array.isArray(db.subjects) ? db.subjects : [];

  // Group slots by Day and Session (time bucket)
  const daySessionMap = new Map<string, ResolvedSlot[]>();
  for (const slot of slots) {
    const key = `${slot.day}_${slot.sessionId}`;
    if (!daySessionMap.has(key)) {
      daySessionMap.set(key, []);
    }
    daySessionMap.get(key)!.push(slot);
  }

  const recordedConflictKeys = new Set<string>();

  daySessionMap.forEach((sessionSlots, daySessionKey) => {
    const [dayStr, sessionId] = daySessionKey.split('_');
    const day = dayStr as DayOfWeek;
    const sessionObj = sessions.find((s) => s.id === sessionId);
    const sessionLabel = sessionObj
      ? `${sessionObj.name} (${sessionObj.startTime || (sessionObj as any).start_time || '08:00'}-${sessionObj.endTime || (sessionObj as any).end_time || '10:00'})`
      : sessionId;

    // Compare pairs of slots to verify whether active date ranges overlap
    for (let i = 0; i < sessionSlots.length; i++) {
      for (let j = i + 1; j < sessionSlots.length; j++) {
        const slotA = sessionSlots[i];
        const slotB = sessionSlots[j];

        if (slotA.ruleId === slotB.ruleId) continue;

        const { overlap, overlapRange } = checkDateRangesOverlap(
          slotA.dateRanges || [],
          slotB.dateRanges || []
        );

        if (!overlap || !overlapRange) continue;

        const dateRangeLabel = `${overlapRange.startDate} s/d ${overlapRange.endDate}`;

        // 1. Teacher Conflict: Same teacher double-booked
        if (slotA.teacherId && slotA.teacherId === slotB.teacherId) {
          const teacher = teachers.find((t) => t.id === slotA.teacherId);
          const teacherName = teacher?.name || 'Guru';
          const classA = classes.find((c) => c.id === slotA.classId)?.name || 'Kelas A';
          const classB = classes.find((c) => c.id === slotB.classId)?.name || 'Kelas B';
          const conflictKey = `tch_${slotA.teacherId}_${day}_${sessionId}_${[slotA.ruleId, slotB.ruleId].sort().join('_')}`;

          if (!recordedConflictKeys.has(conflictKey)) {
            recordedConflictKeys.add(conflictKey);
            conflicts.push({
              id: `conflict-tch-${slotA.teacherId}-${day}-${sessionId}-${slotA.ruleId.slice(0, 5)}`,
              type: 'teacher',
              title: `Tabrakan Jadwal Guru: ${teacherName}`,
              description: `${teacherName} dijadwalkan mengajar di 2 kelas (${classA} dan ${classB}) bersamaan pada ${day}, ${sessionLabel} (Rentang tumpukan: ${dateRangeLabel}).`,
              day,
              periodId: slotA.periodId || 'all',
              sessionId,
              involvedRuleIds: [slotA.ruleId, slotB.ruleId],
              severity: 'critical'
            });
          }
        }

        // 2. Class Conflict: Same class assigned to multiple subjects
        if (slotA.classId && slotA.classId === slotB.classId) {
          const cls = classes.find((c) => c.id === slotA.classId);
          const className = cls?.name || 'Kelas';
          const subA = subjects.find((s) => s.id === slotA.subjectId)?.name || 'Mapel A';
          const subB = subjects.find((s) => s.id === slotB.subjectId)?.name || 'Mapel B';
          const conflictKey = `cls_${slotA.classId}_${day}_${sessionId}_${[slotA.ruleId, slotB.ruleId].sort().join('_')}`;

          if (!recordedConflictKeys.has(conflictKey)) {
            recordedConflictKeys.add(conflictKey);
            conflicts.push({
              id: `conflict-cls-${slotA.classId}-${day}-${sessionId}-${slotA.ruleId.slice(0, 5)}`,
              type: 'class',
              title: `Tabrakan Jadwal Kelas: ${className}`,
              description: `${className} dijadwalkan menerima 2 mata pelajaran (${subA} dan ${subB}) bersamaan pada ${day}, ${sessionLabel} (Rentang tumpukan: ${dateRangeLabel}).`,
              day,
              periodId: slotA.periodId || 'all',
              sessionId,
              involvedRuleIds: [slotA.ruleId, slotB.ruleId],
              severity: 'critical'
            });
          }
        }

        // 3. Room Conflict: Same room booked for multiple classes
        if (slotA.roomId && slotA.roomId === slotB.roomId) {
          const rm = rooms.find((r) => r.id === slotA.roomId);
          const roomName = rm?.name || 'Ruangan';
          const classA = classes.find((c) => c.id === slotA.classId)?.name || 'Kelas A';
          const classB = classes.find((c) => c.id === slotB.classId)?.name || 'Kelas B';
          const conflictKey = `rm_${slotA.roomId}_${day}_${sessionId}_${[slotA.ruleId, slotB.ruleId].sort().join('_')}`;

          if (!recordedConflictKeys.has(conflictKey)) {
            recordedConflictKeys.add(conflictKey);
            conflicts.push({
              id: `conflict-rm-${slotA.roomId}-${day}-${sessionId}-${slotA.ruleId.slice(0, 5)}`,
              type: 'room',
              title: `Tabrakan Pemakaian Ruangan: ${roomName}`,
              description: `${roomName} digunakan bersamaan oleh ${classA} dan ${classB} pada ${day}, ${sessionLabel} (Rentang tumpukan: ${dateRangeLabel}).`,
              day,
              periodId: slotA.periodId || 'all',
              sessionId,
              involvedRuleIds: [slotA.ruleId, slotB.ruleId],
              severity: 'critical'
            });
          }
        }
      }
    }
  });

  return conflicts;
}

export function buildScheduleMatrix(
  db: DatabaseState,
  filterType: 'all' | 'class' | 'teacher' | 'room',
  filterId: string,
  allConflicts: ScheduleConflict[],
  selectedPeriodId?: string
): {
  days: DayOfWeek[];
  sortedSessions: Session[];
  periods: Period[];
  matrix: Map<string, ScheduleCell>;
} {
  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const rawSessions = Array.isArray(db?.sessions) ? db.sessions : [];
  const rawPeriods = Array.isArray(db?.periods) ? db.periods : [];
  const rawRules = Array.isArray(db?.rules) ? db.rules : [];

  const sortedSessions = [...rawSessions].sort(
    (a, b) => (a.order ?? (a as any).sort_order ?? 0) - (b.order ?? (b as any).sort_order ?? 0)
  );
  const periods = [...rawPeriods].sort(
    (a, b) => (a.periodNumber ?? (a as any).period_number ?? 0) - (b.periodNumber ?? (b as any).period_number ?? 0)
  );

  const resolvedSlots = computeResolvedSlots(rawRules, rawPeriods);

  const targetPreset = selectedPeriodId && selectedPeriodId !== 'all'
    ? rawPeriods.find((p) => p.id === selectedPeriodId)
    : null;

  // Filter slots if a filter is active
  const filteredSlots = resolvedSlots.filter((slot) => {
    if (targetPreset && targetPreset.startDate && targetPreset.endDate) {
      if (!doesIntersectRange(slot.dateRanges || [], targetPreset.startDate, targetPreset.endDate)) {
        return false;
      }
    } else if (selectedPeriodId && selectedPeriodId !== 'all') {
      if (slot.periodId !== selectedPeriodId && (!slot.dateRanges || slot.dateRanges.length === 0)) {
        return false;
      }
    }
    if (filterType === 'class' && filterId && filterId !== 'all') return slot.classId === filterId;
    if (filterType === 'teacher' && filterId && filterId !== 'all') return slot.teacherId === filterId;
    if (filterType === 'room' && filterId && filterId !== 'all') return slot.roomId === filterId;
    return true;
  });

  const matrix = new Map<string, ScheduleCell>();

  // Initialize every day + session cell
  for (const day of days) {
    for (const session of sortedSessions) {
      const cellKey = `${day}_${session.id}`;

      // Find slots matching this cell
      const matchingSlots = filteredSlots.filter(
        (s) => s.day === day && s.sessionId === session.id
      );

      // Find conflicts for this day and session
      const matchingConflicts = allConflicts.filter(
        (c) =>
          c.day === day &&
          c.sessionId === session.id &&
          (!targetPreset || !c.periodId || c.periodId === 'all' || c.periodId === targetPreset.id)
      );

      if (matchingSlots.length > 0) {
        const primarySlot = matchingSlots[0];
        matrix.set(cellKey, {
          day,
          periodId: primarySlot.periodId,
          sessionId: session.id,
          isFilled: true,
          ruleId: primarySlot.ruleId,
          subjectId: primarySlot.subjectId,
          classId: primarySlot.classId,
          teacherId: primarySlot.teacherId,
          roomId: primarySlot.roomId,
          hasException: false,
          conflicts: matchingConflicts,
          slots: matchingSlots
        });
      } else {
        matrix.set(cellKey, {
          day,
          periodId: selectedPeriodId && selectedPeriodId !== 'all' ? selectedPeriodId : (periods[0]?.id || 'prd-1'),
          sessionId: session.id,
          isFilled: false,
          conflicts: matchingConflicts,
          slots: []
        });
      }
    }
  }

  return { days, sortedSessions, periods, matrix };
}
