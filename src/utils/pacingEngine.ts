import {
  DatabaseState,
  SyllabusUnit,
  SyllabusScope,
  ScheduledSessionOccurrence,
  DayOfWeek
} from '../types';
import { getNormalizedDateRangesForRule } from './dateNormalizer';

const JS_DOW_TO_DAYOFWEEK: Record<number, DayOfWeek> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

/**
 * Unit weight calculation:
 * Calculated dynamically from real page span: (page_end - page_start + 1).
 * Falls back to 1 if pages are unspecified.
 */
export function getUnitWeight(unit: SyllabusUnit): number {
  const pStart = typeof unit.page_start === 'number' ? unit.page_start : parseInt(String(unit.page_start), 10);
  const pEnd = typeof unit.page_end === 'number' ? unit.page_end : parseInt(String(unit.page_end), 10);
  if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
    return Math.max(1, pEnd - pStart + 1);
  }
  return 1;
}

/**
 * Display helper per specification:
 * Rendered as "{part}/{page_start}: {title}"
 * When starting or ending mid-range, minimal indicator '…' is included.
 */
export function formatUnitDisplay(unit: SyllabusUnit): string {
  const part = unit.part !== undefined && unit.part !== null ? String(unit.part).trim() : '';
  const pageStart = unit.page_start !== undefined && unit.page_start !== null ? String(unit.page_start).trim() : '';
  const title = unit.title || 'Untitled Material';
  
  if (part) {
    return `${part}/${pageStart}: ${title}`;
  }
  return `${pageStart}: ${title}`;
}

/**
 * Retrieves the scoped syllabus units for a given (subject, class-section).
 * - Full syllabus ordered by order.
 * - Sliced by SyllabusScope if present; no row = default to full syllabus.
 */
/**
 * Which books feed a subject's syllabus.
 * Order: scope.book_ids -> scope.book_id -> subject.default_book -> `bk-${subjectId}`
 */
function resolveBookIds(
  db: DatabaseState,
  subject_id: string,
  scope?: SyllabusScope
): string[] {
  if (scope?.book_ids && scope.book_ids.length > 0) return scope.book_ids;
  if (scope?.book_id) return [scope.book_id];

  const subject = (db.subjects || []).find((s) => s.id === subject_id);
  const defaultBook = subject?.default_book || subject?.defaultBookId || subject?.primary_book_code;
  if (defaultBook) return [defaultBook];

  return [`bk-${subject_id}`];
}

/**
 * All syllabus units of a subject, resolved through books (not through unit.subject_id).
 * - Units with a bookId are matched against the resolved book list.
 * - Legacy units without a bookId are matched by subject_id.
 * - Ordered by book order (as listed in the scope), then by unit.order.
 */
export function getUnitsForSubject(
  db: DatabaseState,
  subject_id: string,
  scope?: SyllabusScope
): SyllabusUnit[] {
  const allUnits = Array.isArray(db.syllabusUnits) ? db.syllabusUnits : [];
  const bookIds = resolveBookIds(db, subject_id, scope);
  const bookRank = new Map<string, number>(bookIds.map((b, i) => [b, i]));

  return allUnits
    .filter((u) => {
      if (u.bookId) return bookRank.has(u.bookId);
      return u.subject_id === subject_id;
    })
    .slice()
    .sort((a, b) => {
      const ra = a.bookId ? (bookRank.get(a.bookId) ?? 999) : 0;
      const rb = b.bookId ? (bookRank.get(b.bookId) ?? 999) : 0;
      if (ra !== rb) return ra - rb;
      return (a.order ?? 0) - (b.order ?? 0);
    });
}
/** bookId -> subjectId, from subject.default_book first, then book.defaultSubjectId */
export function buildBookSubjectMap(db: DatabaseState): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of db.subjects || []) {
    const b = s.default_book || s.defaultBookId || s.primary_book_code;
    if (b && !map.has(b)) map.set(b, s.id);
  }
  for (const b of db.books || []) {
    if (b.defaultSubjectId && !map.has(b.id)) map.set(b.id, b.defaultSubjectId);
  }
  return map;
}
/**
 * Retrieves the scoped syllabus units for a given (subject, class-section).
 * - Full list comes from getUnitsForSubject (book-aware).
 * - A scope with start/end slices that combined list; no scope = full list.
 * - A scope with 2+ items is treated as genuine multi-range (per-book start/end).
 */
export function getScopedUnits(
  db: DatabaseState,
  subject_id: string,
  class_section_id: string
): SyllabusUnit[] {
  const scopes = Array.isArray(db.syllabusScopes) ? db.syllabusScopes : [];
  const targetSubject = (db.subjects || []).find((s) => s.id === subject_id || s.code === subject_id);
  const scope = scopes.find(
    (s) =>
      (s.subject_id === subject_id || (targetSubject && (s.subject_id === targetSubject.id || s.subject_id === targetSubject.code))) &&
      (s.class_section_id === class_section_id || (s as any).class_code === class_section_id || (s as any).classId === class_section_id)
  );

  const subjectUnits = getUnitsForSubject(db, subject_id, scope);
  if (!scope) return subjectUnits;

  // Genuine multi-range scope: one or more book items
  if (scope.items && scope.items.length > 0) {
    const allUnits = Array.isArray(db.syllabusUnits) ? db.syllabusUnits : [];
    const resultUnits: SyllabusUnit[] = [];
    const seenUnitIds = new Set<string>();
    const sortedItems = [...scope.items].sort((a, b) => (a.sortOrder || 1) - (b.sortOrder || 1));

    for (const item of sortedItems) {
      const candidates = (item.bookId
        ? allUnits.filter((u) => u.bookId === item.bookId)
        : subjectUnits
      )
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      if (candidates.length === 0) continue;

      let sIdx = 0;
      let eIdx = candidates.length - 1;
      if (item.startMaterialId) {
        const found = candidates.findIndex((u) => u.id === item.startMaterialId);
        if (found !== -1) sIdx = found;
      }
      if (item.endMaterialId) {
        const found = candidates.findIndex((u) => u.id === item.endMaterialId);
        if (found !== -1) eIdx = found;
      }
      if (sIdx > eIdx) [sIdx, eIdx] = [eIdx, sIdx];

      for (const u of candidates.slice(sIdx, eIdx + 1)) {
        if (!seenUnitIds.has(u.id)) {
          seenUnitIds.add(u.id);
          resultUnits.push(u);
        }
      }
    }

    if (resultUnits.length > 0) return resultUnits;
  }

  // Simple scope: start/end slice the combined, ordered list
  if (!scope.start_unit_id && !scope.end_unit_id) return subjectUnits;

  let startIndex = 0;
  let endIndex = subjectUnits.length - 1;

  if (scope.start_unit_id) {
    const sIdx = subjectUnits.findIndex((u) => u.id === scope.start_unit_id);
    if (sIdx !== -1) startIndex = sIdx;
  }
  if (scope.end_unit_id) {
    const eIdx = subjectUnits.findIndex((u) => u.id === scope.end_unit_id);
    if (eIdx !== -1) endIndex = eIdx;
  }
  if (startIndex > endIndex) [startIndex, endIndex] = [endIndex, startIndex];

  return subjectUnits.slice(startIndex, endIndex + 1);
}
/**
 * Live query of scheduled sessions for that subject+class-section within the Rule's period dates.
 * Always computed live — never cached, so schedule changes reflect immediately.
 */
export function getScheduledSessionsForSubjectClass(
  db: DatabaseState,
  subject_id: string,
  class_section_id: string
): ScheduledSessionOccurrence[] {
  const sessionMap = new Map((db.sessions || []).map((s) => [s.id, s]));

  // Check if real meeting records exist in db.meetings
  if (db.meetings && db.meetings.length > 0) {
    const targetSubject = (db.subjects || []).find(
      (s) => s.id === subject_id || s.code === subject_id || s.display_code === subject_id || s.displayCode === subject_id
    );
    const targetClass = (db.classes || []).find(
      (c) => c.id === class_section_id || (c as any).code === class_section_id || c.display_code === class_section_id || c.displayCode === class_section_id
    );

    const norm = (val?: string) => (val ? String(val).trim().toLowerCase() : '');
    const sNorm = norm(subject_id);
    const cNorm = norm(class_section_id);

    const matchesSubject = (mSub: string) => {
      const msNorm = norm(mSub);
      if (msNorm === sNorm) return true;
      if (targetSubject) {
        return (
          msNorm === norm(targetSubject.id) ||
          msNorm === norm(targetSubject.code) ||
          msNorm === norm(targetSubject.display_code) ||
          msNorm === norm(targetSubject.displayCode)
        );
      }
      return false;
    };

    const matchesClass = (mCls: string) => {
      const mcNorm = norm(mCls);
      if (mcNorm === cNorm) return true;
      if (targetClass) {
        return (
          mcNorm === norm(targetClass.id) ||
          mcNorm === norm((targetClass as any).code) ||
          mcNorm === norm(targetClass.display_code) ||
          mcNorm === norm(targetClass.displayCode)
        );
      }
      return false;
    };

    const matchedMeetings = db.meetings.filter(
      (m) => matchesSubject(m.subject_id) && matchesClass(m.class_id)
    );

    if (matchedMeetings.length > 0) {
      // Sort chronologically by date, then session start time
      const sorted = [...matchedMeetings].sort((a, b) => {
        const dComp = a.meeting_date.localeCompare(b.meeting_date);
        if (dComp !== 0) return dComp;
        const sa = sessionMap.get(a.session_id || '');
        const sb = sessionMap.get(b.session_id || '');
        const ta = sa?.startTime || (sa as any)?.start_time || '08:00';
        const tb = sb?.startTime || (sb as any)?.start_time || '08:00';
        return ta.localeCompare(tb);
      });

      let activeSeq = 1;
      return sorted.map((m) => {
        const isCancelled = m.status === 'cancelled' || String(m.status).toLowerCase().includes('cancel') || String(m.status).toLowerCase().includes('batal');
        const sessionObj = sessionMap.get(m.session_id || '');
        const startTime = sessionObj?.startTime || (sessionObj as any)?.start_time || '08:00';
        const endTime = sessionObj?.endTime || (sessionObj as any)?.end_time || '10:00';

        const parts = m.meeting_date.split('-');
        let dow: DayOfWeek = 'Monday';
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          dow = JS_DOW_TO_DAYOFWEEK[d.getDay()] || 'Monday';
        }

        const meetingIndex = isCancelled ? 0 : activeSeq++;

        const matchingPeriod = (db.periods || []).find(
          (p) => (p.startDate || (p as any).start_date || '') <= m.meeting_date && m.meeting_date <= (p.endDate || (p as any).end_date || '')
        );

        return {
          id: m.id,
          date: m.meeting_date,
          day: dow,
          sessionId: m.session_id || '',
          sessionName: sessionObj?.name || m.session_id || 'Sesi',
          startTime,
          endTime,
          ruleId: m.rule_code || '',
          subjectId: subject_id,
          classId: class_section_id,
          teacherId: m.teacher_id || '',
          roomId: m.room_id || '',
          periodId: matchingPeriod?.id || '',
          meetingIndex,
          status: m.status,
          isCancelled,
          actual_materi_id: m.actual_materi_id,
          actual_page: m.actual_page,
          meetingNotes: m.notes
        };
      });
    }
  }

  // Fallback to rules-based calculation if db.meetings is empty or not matching
  const occurrences: ScheduledSessionOccurrence[] = [];

  const activeRules = (db.rules || []).filter(
    (r) =>
      r.active !== false &&
      (r.subjectId === subject_id || (r as any).subject_id === subject_id) &&
      (r.classId === class_section_id || (r as any).class_id === class_section_id)
  );

  const seenOccurrenceKeys = new Set<string>();

  for (const rule of activeRules) {
    // Resolve scheduled days
    const rawDays = rule.daysOfWeek || (rule as any).days_of_week;
    const ruleDays: DayOfWeek[] =
      Array.isArray(rawDays) && rawDays.length > 0
        ? (rawDays as DayOfWeek[])
        : [(rule.dayOfWeek || (rule as any).day_of_week || 'Monday') as DayOfWeek];

    // Compute normalized date ranges for rule (merges overlapping presets)
    const normalizedRanges = getNormalizedDateRangesForRule(rule, db.periods || []);
    const ruleSessionId = rule.sessionId || (rule as any).session_id || '';
    const sessionObj = sessionMap.get(ruleSessionId);
    const ruleTeacherId = rule.teacherId || (rule as any).teacher_id || '';
    const ruleRoomId = rule.roomId || (rule as any).room_id || '';

    for (const range of normalizedRanges) {
      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) continue;

      const curr = new Date(start);
      while (curr <= end) {
        const jsDay = curr.getDay(); // 0 = Sun, 1 = Mon, ...
        const dow = JS_DOW_TO_DAYOFWEEK[jsDay];

        if (dow && ruleDays.includes(dow)) {
          const year = curr.getFullYear();
          const month = String(curr.getMonth() + 1).padStart(2, '0');
          const day = String(curr.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          const occurrenceKey = `${dateStr}_${ruleSessionId}_${rule.id}`;
          if (!seenOccurrenceKeys.has(occurrenceKey)) {
            seenOccurrenceKeys.add(occurrenceKey);

            // Optional informational matching period
            const matchingPeriod = (db.periods || []).find(
              (p) => (p.startDate || (p as any).start_date || '') <= dateStr && dateStr <= (p.endDate || (p as any).end_date || '')
            );

            occurrences.push({
              id: occurrenceKey,
              date: dateStr,
              day: dow,
              sessionId: ruleSessionId,
              sessionName: sessionObj?.name || ruleSessionId,
              startTime: sessionObj?.startTime || (sessionObj as any)?.start_time || '08:00',
              endTime: sessionObj?.endTime || (sessionObj as any)?.end_time || '10:00',
              ruleId: rule.id,
              subjectId: subject_id,
              classId: class_section_id,
              teacherId: ruleTeacherId,
              roomId: ruleRoomId,
              periodId: matchingPeriod?.id || (rule.periodIds?.[0] || ''),
              meetingIndex: 0 // populated after sorting
            });
          }
        }
        curr.setDate(curr.getDate() + 1);
      }
    }
  }

  // Sort chronological by date, then by session start time
  occurrences.sort((a, b) => {
    const dComp = a.date.localeCompare(b.date);
    if (dComp !== 0) return dComp;
    return a.startTime.localeCompare(b.startTime);
  });

  // Assign 1-based meeting indices
  occurrences.forEach((occ, idx) => {
    occ.meetingIndex = idx + 1;
  });

  return occurrences;
}

/**
 * Fast single-pass pre-aggregation of scheduled meeting counts for all (subject, class) pairs.
 * Evaluates active rules in a single pass O(Rules * DateRange) instead of O(Subjects * Classes * Rules * DateRange).
 */
export function getAllScheduledMeetingsCountMap(db: DatabaseState): Map<string, number> {
  const countMap = new Map<string, number>();

  if (db.meetings && db.meetings.length > 0) {
    for (const m of db.meetings) {
      if (m.status === 'cancelled') continue;
      const key = `${m.subject_id}_${m.class_id}`;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }
    return countMap;
  }
  const seenOccurrenceKeys = new Set<string>();
  const activeRules = (db.rules || []).filter((r) => r.active !== false);

  for (const rule of activeRules) {
    const subjectId = rule.subjectId || (rule as any).subject_id;
    const classId = rule.classId || (rule as any).class_id;
    if (!subjectId || !classId) continue;

    const key = `${subjectId}_${classId}`;

    const rawDays = rule.daysOfWeek || (rule as any).days_of_week;
    const ruleDays: DayOfWeek[] =
      Array.isArray(rawDays) && rawDays.length > 0
        ? (rawDays as DayOfWeek[])
        : [(rule.dayOfWeek || (rule as any).day_of_week || 'Monday') as DayOfWeek];

    const normalizedRanges = getNormalizedDateRangesForRule(rule, db.periods || []);
    const ruleSessionId = rule.sessionId || (rule as any).session_id || '';

    for (const range of normalizedRanges) {
      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) continue;

      const curr = new Date(start);
      while (curr <= end) {
        const jsDay = curr.getDay();
        const dow = JS_DOW_TO_DAYOFWEEK[jsDay];

        if (dow && ruleDays.includes(dow)) {
          const year = curr.getFullYear();
          const month = String(curr.getMonth() + 1).padStart(2, '0');
          const day = String(curr.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          const occurrenceKey = `${dateStr}_${ruleSessionId}_${rule.id}`;
          if (!seenOccurrenceKeys.has(occurrenceKey)) {
            seenOccurrenceKeys.add(occurrenceKey);
            countMap.set(key, (countMap.get(key) || 0) + 1);
          }
        }
        curr.setDate(curr.getDate() + 1);
      }
    }
  }

  return countMap;
}

export interface PacingSessionProjection {
  session: ScheduledSessionOccurrence;
  units: SyllabusUnit[];
  startWeightProgress: number;
  endWeightProgress: number;
  midpage?: number;
  isAdjusted?: boolean;
  isCheckpoint?: boolean;
}

/**
 * Pure proportional pacing calculation across a set of units and sessions.
 */
function runProportionalPacing(
  units: SyllabusUnit[],
  sessions: ScheduledSessionOccurrence[]
): PacingSessionProjection[] {
  if (sessions.length === 0) {
    return [];
  }

  if (units.length === 0) {
    return sessions.map((session) => ({
      session,
      units: [],
      startWeightProgress: 0,
      endWeightProgress: 0
    }));
  }

  // Compute unit weights and cumulative intervals
  const unitWeights = units.map(getUnitWeight);
  const totalWeight = unitWeights.reduce((acc, w) => acc + w, 0);

  // Cumulative positions for units: [C_k, C_{k+1}]
  const unitCumulative: Array<{ start: number; end: number; unit: SyllabusUnit }> = [];
  let currentCum = 0;
  for (let i = 0; i < units.length; i++) {
    const w = unitWeights[i];
    unitCumulative.push({
      start: currentCum,
      end: currentCum + w,
      unit: units[i]
    });
    currentCum += w;
  }

  const numSessions = sessions.length;
  const weightPerSession = totalWeight / numSessions;
  const EPSILON = 1e-6;

  // Track session cutoffs: when session i ends inside a material range (page_start - page_end),
  // calculate and save that midpage number for session i.
  const sessionEndCuts = new Map<number, { unitId: string; midpage: number }>();

  for (let i = 0; i < numSessions - 1; i++) {
    const sessionEnd = (i + 1) * weightPerSession;

    // Find if sessionEnd falls strictly in the middle of a unit range
    const splitUc = unitCumulative.find(
      (uc) => uc.start < sessionEnd - EPSILON && uc.end > sessionEnd + EPSILON
    );

    if (splitUc) {
      const pStart = typeof splitUc.unit.page_start === 'number'
        ? splitUc.unit.page_start
        : parseInt(String(splitUc.unit.page_start), 10);
      const pEnd = typeof splitUc.unit.page_end === 'number'
        ? splitUc.unit.page_end
        : parseInt(String(splitUc.unit.page_end), 10);

      if (!isNaN(pStart) && !isNaN(pEnd) && pEnd > pStart) {
        const span = pEnd - pStart + 1;
        const progressInUnit = sessionEnd - splitUc.start;
        const unitWeightSpan = splitUc.end - splitUc.start;
        const pagesElapsed = Math.round((progressInUnit / unitWeightSpan) * span);
        const clampedPages = Math.min(span - 1, Math.max(1, pagesElapsed));
        let computedMidpage = pStart + clampedPages - 1;

        // If the same unit was already split in a previous session, ensure midpage advances
        const prevCut = sessionEndCuts.get(i - 1);
        if (prevCut && prevCut.unitId === splitUc.unit.id && computedMidpage <= prevCut.midpage) {
          computedMidpage = Math.min(pEnd - 1, prevCut.midpage + 1);
        }

        sessionEndCuts.set(i, { unitId: splitUc.unit.id, midpage: computedMidpage });
      }
    }
  }

  return sessions.map((session, i) => {
    const sessionStart = i * weightPerSession;
    const sessionEnd = (i + 1) * weightPerSession;

    // A unit overlaps with session if interval [unit.start, unit.end] intersects [sessionStart, sessionEnd]
    const assignedUnits = unitCumulative
      .filter((uc) => {
        return uc.start < sessionEnd - EPSILON && uc.end > sessionStart + EPSILON;
      })
      .map((uc) => uc.unit);

    // Fallback: If discrete floating gap yields empty set, assign closest unit
    if (assignedUnits.length === 0) {
      const sessionMid = (sessionStart + sessionEnd) / 2;
      let closestUnit = units[0];
      let minDiff = Infinity;
      for (const uc of unitCumulative) {
        const unitMid = (uc.start + uc.end) / 2;
        const diff = Math.abs(sessionMid - unitMid);
        if (diff < minDiff) {
          minDiff = diff;
          closestUnit = uc.unit;
        }
      }
      assignedUnits.push(closestUnit);
    }

    // Adjust start/end page for units in this session based on midpage
    const prevCut = i > 0 ? sessionEndCuts.get(i - 1) : undefined;
    const currentCut = sessionEndCuts.get(i);

    const projectedUnits: SyllabusUnit[] = assignedUnits.map((origUnit, uIdx) => {
      const cloned: SyllabusUnit = {
        ...origUnit,
        raw_page_start: origUnit.raw_page_start ?? origUnit.page_start,
        raw_page_end: origUnit.raw_page_end ?? origUnit.page_end
      };

      // If previous session ended mid-range on this unit, this session starts at midpage + 1
      if (prevCut && prevCut.unitId === origUnit.id && uIdx === 0) {
        const midStart = prevCut.midpage + 1;
        cloned.page_start = midStart;
        cloned.display_page_start = midStart;
        cloned.isPartialStart = true;
      }

      // If this session ends mid-range on this unit, edit display page_end of this last material to show midpage
      if (currentCut && currentCut.unitId === origUnit.id && uIdx === assignedUnits.length - 1) {
        const midEnd = currentCut.midpage;
        cloned.page_end = midEnd;
        cloned.display_page_end = midEnd;
        cloned.isPartialEnd = true;
        cloned.midpage = midEnd;
      }

      // Safety check: ensure start <= end
      const numStart = typeof cloned.page_start === 'number' ? cloned.page_start : parseInt(String(cloned.page_start), 10);
      const numEnd = typeof cloned.page_end === 'number' ? cloned.page_end : parseInt(String(cloned.page_end), 10);
      if (!isNaN(numStart) && !isNaN(numEnd) && numStart > numEnd) {
        cloned.page_end = numStart;
        cloned.display_page_end = numStart;
      }

      return cloned;
    });

    return {
      session,
      units: projectedUnits,
      startWeightProgress: sessionStart,
      endWeightProgress: sessionEnd,
      midpage: currentCut?.midpage
    };
  });
}

/**
 * Builds the remaining units starting from checkpoint position and excluding cut units.
 */
function buildAdjustedRemainingUnits(
  units: SyllabusUnit[],
  adjustment: NonNullable<SyllabusScope['adjustment']>
): SyllabusUnit[] {
  let currUnitIdx = -1;
  if (adjustment.checkpointUnitId) {
    currUnitIdx = units.findIndex((u) => u.id === adjustment.checkpointUnitId);
  }
  if (currUnitIdx === -1 && typeof adjustment.checkpointPage === 'number') {
    currUnitIdx = units.findIndex((u) => {
      const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
      const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
      return !isNaN(pStart) && !isNaN(pEnd) && adjustment.checkpointPage >= pStart && adjustment.checkpointPage <= pEnd;
    });
  }

  const cutSet = new Set(adjustment.cutUnitIds || []);

  let remaining: SyllabusUnit[] = [];

  if (currUnitIdx !== -1) {
    const currentUnit = units[currUnitIdx];
    const uStart = typeof currentUnit.page_start === 'number' ? currentUnit.page_start : parseInt(String(currentUnit.page_start), 10);
    const uEnd = typeof currentUnit.page_end === 'number' ? currentUnit.page_end : parseInt(String(currentUnit.page_end), 10);

    // If checkpointPage is within this unit
    if (!isNaN(uEnd) && adjustment.checkpointPage <= uEnd) {
      const pageStart = Math.max(uStart, adjustment.checkpointPage);
      if (!cutSet.has(currentUnit.id)) {
        remaining.push({
          ...currentUnit,
          raw_page_start: currentUnit.raw_page_start ?? currentUnit.page_start,
          raw_page_end: currentUnit.raw_page_end ?? currentUnit.page_end,
          page_start: pageStart,
          display_page_start: pageStart,
          isPartialStart: pageStart > uStart
        });
      }
    }

    // Add subsequent units that are not cut
    for (let j = currUnitIdx + 1; j < units.length; j++) {
      if (!cutSet.has(units[j].id)) {
        remaining.push(units[j]);
      }
    }
  } else {
    // If unit ID not found, take all non-cut units
    remaining = units.filter((u) => !cutSet.has(u.id));
  }

  return remaining;
}

/**
 * Proportional pacing engine:
 * Spread unit weights proportionally across sessions.
 * Respects teacher/admin manual pacing adjustments (re-calibrations) or attendance checkpoints.
 * Excludes cancelled sessions from material allocations and pacing divisiveness.
 * Returns array of { session: ScheduledSessionOccurrence, units: SyllabusUnit[], midpage?: number }
 */
export function computePacingProjection(
  db: DatabaseState,
  subject_id: string,
  class_section_id: string
): PacingSessionProjection[] {
  const units = getScopedUnits(db, subject_id, class_section_id);
  const sessions = getScheduledSessionsForSubjectClass(db, subject_id, class_section_id);

  if (sessions.length === 0) {
    return [];
  }

  const activeSessions = sessions.filter((s) => !s.isCancelled);

  if (units.length === 0 || activeSessions.length === 0) {
    return sessions.map((session) => ({
      session,
      units: [],
      startWeightProgress: 0,
      endWeightProgress: 0
    }));
  }

  const scopes = Array.isArray(db.syllabusScopes) ? db.syllabusScopes : [];
  const targetSubject = (db.subjects || []).find((s) => s.id === subject_id || s.code === subject_id);
  const scope = scopes.find(
    (s) =>
      (s.subject_id === subject_id || (targetSubject && (s.subject_id === targetSubject.id || s.subject_id === targetSubject.code))) &&
      (s.class_section_id === class_section_id || (s as any).class_code === class_section_id || (s as any).classId === class_section_id)
  );
  let adjustment = scope?.adjustment;

  // If manual adjustment is not set, derive adjustment checkpoint from the latest meeting with recorded actual_page
  if (!adjustment) {
    const recordedActiveSessions = activeSessions.filter(
      (s) => typeof s.actual_page === 'number' && s.actual_page > 0
    );
    if (recordedActiveSessions.length > 0) {
      const latestRecorded = recordedActiveSessions[recordedActiveSessions.length - 1];
      let resolvedUnitId = latestRecorded.actual_materi_id || '';
      if (!resolvedUnitId && typeof latestRecorded.actual_page === 'number') {
        const matched = units.find((u) => {
          const s = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
          const e = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
          return !isNaN(s) && !isNaN(e) && latestRecorded.actual_page! >= Math.min(s, e) && latestRecorded.actual_page! <= Math.max(s, e);
        });
        if (matched) resolvedUnitId = matched.id;
      }
      adjustment = {
        checkpointSessionIndex: latestRecorded.meetingIndex,
        checkpointSessionId: latestRecorded.id,
        checkpointDate: latestRecorded.date,
        checkpointUnitId: resolvedUnitId,
        checkpointPage: latestRecorded.actual_page || 1,
        strategy: 'accelerate',
        cutUnitIds: []
      };
    }
  }

  let activeProjections: PacingSessionProjection[];

  // Standard projection if no teacher calibration has been set or derived
  if (!adjustment) {
    activeProjections = runProportionalPacing(units, activeSessions);
  } else {
    // Find checkpoint index in active sessions
    let checkpointIdx = activeSessions.findIndex(
      (s) => s.meetingIndex === adjustment!.checkpointSessionIndex
    );
    if (checkpointIdx === -1 && adjustment.checkpointSessionId) {
      checkpointIdx = activeSessions.findIndex((s) => s.id === adjustment!.checkpointSessionId);
    }
    if (checkpointIdx === -1 && adjustment.checkpointDate) {
      checkpointIdx = activeSessions.findIndex((s) => s.date === adjustment!.checkpointDate);
    }
    if (checkpointIdx === -1) {
      checkpointIdx = 0;
    }

    // If checkpoint is at the first active session
    if (checkpointIdx === 0) {
      const remainingUnits = buildAdjustedRemainingUnits(units, adjustment);
      activeProjections = runProportionalPacing(remainingUnits, activeSessions).map((p, idx) => ({
        ...p,
        isAdjusted: true,
        isCheckpoint: idx === 0
      }));
    } else {
      // Past active sessions keep their standard pacing from the full original academic year projection
      const fullOriginal = runProportionalPacing(units, activeSessions);
      const pastProjections = fullOriginal.slice(0, checkpointIdx);

      // Remaining active sessions from checkpoint onward take the remaining units
      const remainingSessions = activeSessions.slice(checkpointIdx);
      const remainingUnits = buildAdjustedRemainingUnits(units, adjustment);
      const remainingProjections = runProportionalPacing(remainingUnits, remainingSessions).map((p, idx) => ({
        ...p,
        isAdjusted: true,
        isCheckpoint: idx === 0
      }));

      activeProjections = [...pastProjections, ...remainingProjections];
    }
  }

  // Recombine activeProjections with cancelled sessions in exact chronological order
  const activeMap = new Map<string, PacingSessionProjection>();
  activeProjections.forEach((p) => activeMap.set(p.session.id, p));

  return sessions.map((session) => {
    if (session.isCancelled) {
      return {
        session,
        units: [],
        startWeightProgress: 0,
        endWeightProgress: 0
      };
    }
    return (
      activeMap.get(session.id) || {
        session,
        units: [],
        startWeightProgress: 0,
        endWeightProgress: 0
      }
    );
  });
}

/**
 * Core function per specification:
 * get_units_for_session(subject_id, class_section_id, session_id) -> list[SyllabusUnit]
 * 
 * Supports session_id as:
 * - scheduled session occurrence id (e.g. `${date}_${sessionId}_${ruleId}`)
 * - date string (`YYYY-MM-DD`)
 * - numeric meetingIndex (1, 2, ...)
 * - raw session id combined with date or first matching
 */
export function get_units_for_session(
  db: DatabaseState,
  subject_id: string,
  class_section_id: string,
  session_id: string | number
): SyllabusUnit[] {
  const projection = computePacingProjection(db, subject_id, class_section_id);
  if (projection.length === 0) return [];

  const sidStr = String(session_id).trim();

  // 1. Direct match on occurrence ID
  const directMatch = projection.find((p) => p.session.id === sidStr);
  if (directMatch) return directMatch.units;

  // 2. Match on 1-based meeting index if numeric
  const numericIndex = parseInt(sidStr, 10);
  if (!isNaN(numericIndex) && numericIndex >= 1 && numericIndex <= projection.length) {
    const idxMatch = projection.find((p) => p.session.meetingIndex === numericIndex);
    if (idxMatch) return idxMatch.units;
  }

  // 3. Match on date string (YYYY-MM-DD)
  const dateMatches = projection.filter((p) => p.session.date === sidStr);
  if (dateMatches.length === 1) return dateMatches[0].units;
  if (dateMatches.length > 1) {
    // If multiple sessions on that date, return union
    const unique = new Map<string, SyllabusUnit>();
    dateMatches.forEach((dm) => dm.units.forEach((u) => unique.set(u.id, u)));
    return Array.from(unique.values());
  }

  // 4. Partial or session slot id match (e.g. 'ses-1')
  const slotMatch = projection.find((p) => p.session.sessionId === sidStr);
  if (slotMatch) return slotMatch.units;

  // Default: empty list
  return [];
}

/**
 * Resolves all scheduled sessions across the entire school for a viewer
 * (Student Class, Teacher, or Admin) sorted chronologically.
 */
export function getViewerScheduledSessions(
  db: DatabaseState,
  viewerRole: 'student' | 'teacher' | 'admin',
  viewerId?: string
): ScheduledSessionOccurrence[] {
  const allOccurrences: ScheduledSessionOccurrence[] = [];
  const subjects = db.subjects || [];
  const classes = db.classes || [];

  for (const subject of subjects) {
    for (const cls of classes) {
      // Filter by viewer role
      if (viewerRole === 'student' && viewerId && cls.id !== viewerId) {
        continue;
      }
      
      const sessions = getScheduledSessionsForSubjectClass(db, subject.id, cls.id);
      
      if (viewerRole === 'teacher' && viewerId) {
        const teacherSessions = sessions.filter((s) => s.teacherId === viewerId);
        allOccurrences.push(...teacherSessions);
      } else {
        allOccurrences.push(...sessions);
      }
    }
  }

  // Sort chronologically
  allOccurrences.sort((a, b) => {
    const dComp = a.date.localeCompare(b.date);
    if (dComp !== 0) return dComp;
    return a.startTime.localeCompare(b.startTime);
  });

  return allOccurrences;
}

export interface ResolvedViewerClassStatus {
  currentClass: {
    occurrence: ScheduledSessionOccurrence;
    subjectName: string;
    subjectBook?: string;
    subjectColor: string;
    classColor?: string;
    className?: string;
    counterpartLabel: string;
    roomName: string;
    units: SyllabusUnit[];
    timeRemainingMinutes?: number;
  } | null;
  nextClass: {
    occurrence: ScheduledSessionOccurrence;
    subjectName: string;
    subjectBook?: string;
    subjectColor: string;
    classColor?: string;
    className?: string;
    counterpartLabel: string;
    roomName: string;
    units: SyllabusUnit[];
    isToday: boolean;
  } | null;
}

/**
 * Home tab resolution engine:
 * Resolves viewer's current class (today's date/time vs. their schedule)
 * and next class (walk forward, may be a future day).
 */
export function resolveViewerCurrentAndNextClass(
  db: DatabaseState,
  viewerRole: 'student' | 'teacher' | 'admin',
  viewerId?: string,
  referenceDate: Date = new Date()
): ResolvedViewerClassStatus {
  const occurrences = getViewerScheduledSessions(db, viewerRole, viewerId);

  const subjectMap = new Map((db.subjects || []).map((s) => [s.id, s]));
  const classMap = new Map((db.classes || []).map((c) => [c.id, c]));
  const teacherMap = new Map((db.teachers || []).map((t) => [t.id, t]));
  const roomMap = new Map((db.rooms || []).map((r) => [r.id, r]));

  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const currentHours = String(referenceDate.getHours()).padStart(2, '0');
  const currentMins = String(referenceDate.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMins}`;

  let currentOcc: ScheduledSessionOccurrence | null = null;
  let nextOcc: ScheduledSessionOccurrence | null = null;

  // 1. Check for current class today
  for (const occ of occurrences) {
    if (occ.date === todayStr) {
      if (currentTimeStr >= occ.startTime && currentTimeStr <= occ.endTime) {
        currentOcc = occ;
        break;
      }
    }
  }

  // 2. Resolve next class (walk forward: today after current time, or future days)
  for (const occ of occurrences) {
    if (occ.date > todayStr) {
      nextOcc = occ;
      break;
    } else if (occ.date === todayStr) {
      if (occ.startTime > currentTimeStr) {
        nextOcc = occ;
        break;
      }
    }
  }

  const formatCounterpart = (occ: ScheduledSessionOccurrence): string => {
    if (viewerRole === 'student') {
      const teacher = teacherMap.get(occ.teacherId);
      return teacher?.panggilan || teacher?.name || 'Ustadz / Guru';
    } else if (viewerRole === 'teacher') {
      const cls = classMap.get(occ.classId);
      return cls?.name || 'Kelas';
    } else {
      const teacher = teacherMap.get(occ.teacherId);
      const cls = classMap.get(occ.classId);
      return `${cls?.name || 'Kelas'} • ${teacher?.panggilan || teacher?.name || 'Guru'}`;
    }
  };

  let currentResult = null;
  if (currentOcc) {
    const sub = subjectMap.get(currentOcc.subjectId);
    const room = roomMap.get(currentOcc.roomId);
    const cls = classMap.get(currentOcc.classId);
    const units = get_units_for_session(db, currentOcc.subjectId, currentOcc.classId, currentOcc.id);

    // Calculate time remaining in minutes
    const [endH, endM] = currentOcc.endTime.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    const nowMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
    const diff = Math.max(0, endMinutes - nowMinutes);

    currentResult = {
      occurrence: currentOcc,
      subjectName: sub?.name || 'Mata Pelajaran',
      subjectBook: sub?.book || undefined,
      subjectColor: sub?.color || '#3B82F6',
      classColor: cls?.color || undefined,
      className: cls?.name || undefined,
      counterpartLabel: formatCounterpart(currentOcc),
      roomName: room?.name || 'Ruang Kelas',
      units,
      timeRemainingMinutes: diff
    };
  }

  let nextResult = null;
  if (nextOcc) {
    const sub = subjectMap.get(nextOcc.subjectId);
    const room = roomMap.get(nextOcc.roomId);
    const cls = classMap.get(nextOcc.classId);
    const units = get_units_for_session(db, nextOcc.subjectId, nextOcc.classId, nextOcc.id);

    nextResult = {
      occurrence: nextOcc,
      subjectName: sub?.name || 'Mata Pelajaran',
      subjectBook: sub?.book || undefined,
      subjectColor: sub?.color || '#3B82F6',
      classColor: cls?.color || undefined,
      className: cls?.name || undefined,
      counterpartLabel: formatCounterpart(nextOcc),
      roomName: room?.name || 'Ruang Kelas',
      units,
      isToday: nextOcc.date === todayStr
    };
  }

  return {
    currentClass: currentResult,
    nextClass: nextResult
  };
}
