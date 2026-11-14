import { useState, useCallback, useMemo, useRef } from 'react';
import type { AttendanceStatus, DatabaseState } from '../types';

export interface PendingStatusUpdate {
  meetingId: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface PendingRollCallLog {
  meetingId: string;
  teacherLog?: { id: string; status: AttendanceStatus; timestampStart?: string; timestampEnd?: string; note?: string };
  studentLogs?: Array<{
    studentId: string;
    status: AttendanceStatus;
    timestampStart?: string;
    timestampEnd?: string;
    note?: string;
  }>;
  meetingNotes?: string;
  materialProgress?: {
    materi?: string;
    hal?: number | string;
    unitId?: string;
    startMateri?: string;
    startHal?: number | string;
    startUnitId?: string;
  };
}

export interface MeetingSyncMetadata {
  meeting_date: string;
  meeting_index?: number;
  class_id: string;
  subject_id: string;
  teacher_id?: string;
  room_id?: string;
  session_id: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
}

export interface AttendancePendingStore {
  statusDrafts: Map<string, 'scheduled' | 'completed' | 'cancelled'>;
  rollCallDrafts: Map<string, PendingRollCallLog>;
  pendingCount: number;
  isDirty: boolean;
  setSessionStatusDraft: (meetingId: string, status: 'scheduled' | 'completed' | 'cancelled') => void;
  setRollCallDraft: (
    meetingId: string,
    payload: Omit<PendingRollCallLog, 'meetingId'>,
    options?: { preserveCancelled?: boolean }
  ) => void;
  getEffectiveStatus: (
    meetingId: string,
    serverStatus?: 'scheduled' | 'completed' | 'cancelled'
  ) => 'scheduled' | 'completed' | 'cancelled';
  getRollCallDraft: (meetingId: string) => PendingRollCallLog | undefined;
  isMeetingDrafted: (meetingId: string) => boolean;
  clearDrafts: () => void;
  discardDraft: (meetingId: string) => void;
  flushBatchSave: () => Promise<{ success: boolean; updatedCount: number }>;
  syncMeetingDraftToDb: (
    onUpdateDb: ((updater: (prev: DatabaseState) => DatabaseState) => void) | undefined,
    meetingId: string,
    payload: Omit<PendingRollCallLog, 'meetingId'>,
    meta: MeetingSyncMetadata
  ) => void;
  restoreMeetingDraftInDb: (
    onUpdateDb: ((updater: (prev: DatabaseState) => DatabaseState) => void) | undefined,
    meetingId: string
  ) => void;
}

export function useAttendancePendingStore(): AttendancePendingStore {
  const [statusDrafts, setStatusDrafts] = useState<Map<string, 'scheduled' | 'completed' | 'cancelled'>>(
    () => new Map()
  );
  const [rollCallDrafts, setRollCallDrafts] = useState<Map<string, PendingRollCallLog>>(
    () => new Map()
  );

  // Stores original pre-draft meeting row (or null if synthetic) per meetingId so discard restores cleanly
  const meetingSnapshotsRef = useRef<Map<string, any | null>>(new Map());

  const setSessionStatusDraft = useCallback(
    (meetingId: string, status: 'scheduled' | 'completed' | 'cancelled') => {
      setStatusDrafts((prev) => {
        const next = new Map(prev);
        next.set(meetingId, status);
        return next;
      });
    },
    []
  );

  const setRollCallDraft = useCallback(
    (
      meetingId: string,
      payload: Omit<PendingRollCallLog, 'meetingId'>,
      options?: { preserveCancelled?: boolean }
    ) => {
      setRollCallDrafts((prev) => {
        const next = new Map(prev);
        next.set(meetingId, { meetingId, ...payload });
        return next;
      });

      // Meeting status is ONLY promoted to 'completed' if attendance was logged AND the session is not cancelled.
      const hasAttendance =
        Boolean(payload.teacherLog?.status) ||
        Boolean(payload.studentLogs && payload.studentLogs.some((s) => Boolean(s.status)));

      setStatusDrafts((prev) => {
        const existingDraftStatus = prev.get(meetingId);
        if (existingDraftStatus === 'cancelled' || options?.preserveCancelled) {
          return prev;
        }
        if (hasAttendance) {
          if (existingDraftStatus === 'completed') return prev;
          const next = new Map(prev);
          next.set(meetingId, 'completed');
          return next;
        }
        if (existingDraftStatus === 'completed') {
          const next = new Map(prev);
          next.delete(meetingId);
          return next;
        }
        return prev;
      });
    },
    []
  );

  const getEffectiveStatus = useCallback(
    (
      meetingId: string,
      serverStatus: 'scheduled' | 'completed' | 'cancelled' = 'scheduled'
    ): 'scheduled' | 'completed' | 'cancelled' => {
      if (statusDrafts.has(meetingId)) {
        return statusDrafts.get(meetingId)!;
      }
      return serverStatus;
    },
    [statusDrafts]
  );

  const getRollCallDraft = useCallback(
    (meetingId: string): PendingRollCallLog | undefined => {
      return rollCallDrafts.get(meetingId);
    },
    [rollCallDrafts]
  );

  const isMeetingDrafted = useCallback(
    (meetingId: string): boolean => {
      return statusDrafts.has(meetingId) || rollCallDrafts.has(meetingId);
    },
    [statusDrafts, rollCallDrafts]
  );

  const clearDrafts = useCallback(() => {
    setStatusDrafts(new Map());
    setRollCallDrafts(new Map());
    meetingSnapshotsRef.current.clear();
  }, []);

  const discardDraft = useCallback((meetingId: string) => {
    setStatusDrafts((prev) => {
      if (!prev.has(meetingId)) return prev;
      const next = new Map(prev);
      next.delete(meetingId);
      return next;
    });
    setRollCallDrafts((prev) => {
      if (!prev.has(meetingId)) return prev;
      const next = new Map(prev);
      next.delete(meetingId);
      return next;
    });
  }, []);

  const syncMeetingDraftToDb = useCallback(
    (
      onUpdateDb: ((updater: (prev: DatabaseState) => DatabaseState) => void) | undefined,
      meetingId: string,
      payload: Omit<PendingRollCallLog, 'meetingId'>,
      meta: MeetingSyncMetadata
    ) => {
      if (!onUpdateDb) return;
      const mp = payload.materialProgress;
      const numHal =
        mp?.hal !== undefined && mp.hal !== '' && !isNaN(Number(mp.hal)) ? Number(mp.hal) : undefined;
      const numStartHal =
        mp?.startHal !== undefined && mp.startHal !== '' && !isNaN(Number(mp.startHal))
          ? Number(mp.startHal)
          : undefined;
      const nextMateriId = mp?.unitId || mp?.materi || undefined;
      const nextStartMateriId = mp?.startUnitId || mp?.startMateri || undefined;
      const nextNotes = payload.meetingNotes;

      onUpdateDb((prev) => {
        const meetings = prev.meetings || [];
        const idx = meetings.findIndex((m) => m.id === meetingId);
        if (idx === -1) {
          const hasPairInDb = meetings.some(
            (m) => m.subject_id === meta.subject_id && m.class_id === meta.class_id
          );
          if (!hasPairInDb) {
            return prev;
          }
        }
        if (!meetingSnapshotsRef.current.has(meetingId)) {
          meetingSnapshotsRef.current.set(meetingId, idx !== -1 ? { ...meetings[idx] } : null);
        }

        const updated =
          idx !== -1
            ? meetings.map((m, i) =>
                i === idx
                  ? {
                      ...m,
                      actual_materi_id: nextMateriId,
                      actual_page: numHal,
                      actual_start_materi_id: nextStartMateriId,
                      actual_start_page: numStartHal,
                      notes: nextNotes !== undefined ? nextNotes : m.notes,
                    }
                  : m
              )
            : [
                ...meetings,
                {
                  id: meetingId,
                  meeting_date: meta.meeting_date,
                  meeting_index: meta.meeting_index,
                  class_id: meta.class_id,
                  subject_id: meta.subject_id,
                  teacher_id: meta.teacher_id || '',
                  room_id: meta.room_id || '',
                  session_id: meta.session_id,
                  status: meta.status || 'scheduled',
                  actual_materi_id: nextMateriId,
                  actual_page: numHal,
                  actual_start_materi_id: nextStartMateriId,
                  actual_start_page: numStartHal,
                  notes: nextNotes,
                } as any,
              ];
        return { ...prev, meetings: updated };
      });
    },
    []
  );

  const restoreMeetingDraftInDb = useCallback(
    (
      onUpdateDb: ((updater: (prev: DatabaseState) => DatabaseState) => void) | undefined,
      meetingId: string
    ) => {
      if (!onUpdateDb || !meetingSnapshotsRef.current.has(meetingId)) return;
      const snapshot = meetingSnapshotsRef.current.get(meetingId);
      meetingSnapshotsRef.current.delete(meetingId);

      onUpdateDb((prev) => {
        const meetings = prev.meetings || [];
        if (snapshot === null) {
          return {
            ...prev,
            meetings: meetings.filter((m) => m.id !== meetingId),
          };
        }
        return {
          ...prev,
          meetings: meetings.map((m) => (m.id === meetingId ? { ...snapshot } : m)),
        };
      });
    },
    []
  );

  const pendingCount = useMemo(() => {
    const keys = new Set([...statusDrafts.keys(), ...rollCallDrafts.keys()]);
    return keys.size;
  }, [statusDrafts, rollCallDrafts]);

  const isDirty = pendingCount > 0;

  const flushBatchSave = useCallback(async (): Promise<{ success: boolean; updatedCount: number }> => {
    if (pendingCount === 0) {
      return { success: true, updatedCount: 0 };
    }

    const statusUpdates: Array<{ meetingId: string; status: 'scheduled' | 'completed' | 'cancelled' }> = [];
    statusDrafts.forEach((status, meetingId) => {
      statusUpdates.push({ meetingId, status });
    });

    const rollCallLogs: PendingRollCallLog[] = [];
    rollCallDrafts.forEach((log) => {
      rollCallLogs.push(log);
    });

    const res = await fetch('/api/attendance/batch-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusUpdates, rollCallLogs }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'Failed to batch save attendance');
    }

    const data = await res.json();
    clearDrafts();
    return data;
  }, [pendingCount, statusDrafts, rollCallDrafts, clearDrafts]);

  return {
    statusDrafts,
    rollCallDrafts,
    pendingCount,
    isDirty,
    setSessionStatusDraft,
    setRollCallDraft,
    getEffectiveStatus,
    getRollCallDraft,
    isMeetingDrafted,
    clearDrafts,
    discardDraft,
    flushBatchSave,
    syncMeetingDraftToDb,
    restoreMeetingDraftInDb,
  };
}
