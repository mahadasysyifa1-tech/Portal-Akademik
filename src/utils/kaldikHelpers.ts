import type { DatabaseState, ResolvedSlot, SyllabusUnit } from '../types';
import { get_units_for_session } from './pacingEngine';
import type { PacingSessionProjection } from './pacingEngine';

export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled';

/** Local-time YYYY-MM-DD. Avoids the UTC day shift of toISOString() in UTC+7. */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Reuse the server meeting id when a meeting exists, otherwise build the placeholder id. */
export function buildMeetingId(
  dateStr: string,
  classId: string,
  sessionId: string,
  existingId?: string
): string {
  return existingId || `mtg-${dateStr}-${classId}-${sessionId}`;
}

export interface ResolvedSlotUnits {
  units: SyllabusUnit[];
  meetingIndex?: number;
}

/**
 * Syllabus units for one class slot on one date.
 * Uses the pacing projection when the session matches, otherwise falls back to a direct lookup.
 */
export function resolveSlotUnits(
  db: DatabaseState,
  slot: ResolvedSlot,
  dateStr: string,
  dayPacingMap: Map<string, PacingSessionProjection[]>
): ResolvedSlotUnits {
  const projection = dayPacingMap.get(`${slot.subjectId}_${slot.classId}`) || [];
  const matched = projection.find(
    (p) =>
      p.session.date === dateStr &&
      (p.session.sessionId === slot.sessionId || p.session.ruleId === slot.ruleId)
  );

  if (matched) {
    return { units: matched.units, meetingIndex: matched.session.meetingIndex };
  }

  return {
    units: get_units_for_session(
      db,
      slot.subjectId,
      slot.classId,
      `${dateStr}_${slot.sessionId}_${slot.ruleId}`
    )
  };
}
